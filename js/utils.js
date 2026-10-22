/* =========================================================
   SiteLens — כלי עזר: רשת, גיאומטריה, עיצוב מספרים
   ========================================================= */
window.SA = window.SA || {};

(function (SA) {
  const U = (SA.util = {});

  /* ---------- DOM ---------- */
  U.$ = (sel, root = document) => root.querySelector(sel);
  U.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  U.esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  U.debounce = (fn, ms) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  /* ---------- storage (per-viewer conveniences only) ---------- */
  U.store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };
  const memCache = new Map();
  U.cache = {
    get(k) { return memCache.get(k); },
    set(k, v) { memCache.set(k, v); }
  };

  /* ---------- network ---------- */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  U.sleep = sleep;

  class HttpError extends Error {
    constructor(status) { super(status === 429 ? 'השרת עמוס (429)' : `שגיאת שרת ${status}`); this.status = status; }
  }

  /** בקשה בודדת עם הגבלת זמן */
  async function fetchOnce(url, opts, timeout) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    if (opts.signal) opts.signal.addEventListener('abort', () => ctrl.abort());
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      if (!res.ok) throw new HttpError(res.status);
      const txt = await res.text();
      try { return JSON.parse(txt); } catch (e) { throw new Error('תשובה לא תקינה מהשרת'); }
    } catch (e) {
      if (e.name === 'AbortError') { const err = new Error('תם הזמן להמתנה לשרת'); err.timeout = true; throw err; }
      throw e;
    } finally {
      clearTimeout(t);
    }
  }
  const retriable = (e) => e.timeout || e.status === 429 || (e.status >= 500) || e instanceof TypeError;

  /**
   * fetch JSON עם ניסיונות חוזרים: זמן המתנה גדל בכל ניסיון,
   * והמתנה הולכת וגדלה בין ניסיונות (429 / 5xx / ניתוק / timeout).
   */
  U.fetchJSON = async function (url, opts = {}) {
    const { timeout = 15000, retries = 1, ...rest } = opts;
    let last;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fetchOnce(url, rest, timeout * (1 + i * 0.6));
      } catch (e) {
        last = e;
        if (!retriable(e) || i === retries || (rest.signal && rest.signal.aborted)) break;
        await sleep((e.status === 429 ? 2500 : 700) * (i + 1));
      }
    }
    throw last;
  };

  /**
   * "בקשות מגודרות": שולחים לשרת הראשון, ואם לא ענה תוך hedgeMs —
   * שולחים במקביל גם לבא בתור. התשובה הראשונה שמצליחה מנצחת.
   */
  U.hedged = function (makers, { hedgeMs = 5000 } = {}) {
    return new Promise((resolve, reject) => {
      let done = false, failed = 0, started = 0, timer;
      const ctrls = [];
      const errs = [];
      const start = () => {
        if (done || started >= makers.length) return;
        const i = started++;
        const ctrl = new AbortController();
        ctrls.push(ctrl);
        makers[i](ctrl.signal).then((v) => {
          if (done) return;
          done = true; clearTimeout(timer);
          ctrls.forEach((c) => c !== ctrl && c.abort());
          resolve(v);
        }, (e) => {
          errs.push(e);
          if (++failed === makers.length) { done = true; reject(errs.find((x) => !x.timeout) || errs[0]); }
          else start();
        });
        if (started < makers.length) { clearTimeout(timer); timer = setTimeout(start, hedgeMs); }
      };
      start();
    });
  };

  let jsonpSeq = 0;
  U.jsonp = function (url, { timeout = 15000, param = 'callback' } = {}) {
    return new Promise((resolve, reject) => {
      const name = '__sl_jsonp_' + Date.now() + '_' + jsonpSeq++;
      const s = document.createElement('script');
      const cleanup = () => { window[name] = () => {}; s.remove(); clearTimeout(t); };
      const t = setTimeout(() => { cleanup(); const e = new Error('תם הזמן להמתנה לשרת'); e.timeout = true; reject(e); }, timeout);
      window[name] = (data) => { cleanup(); resolve(data); };
      s.onerror = () => { cleanup(); reject(new Error('השרת לא זמין')); };
      s.src = url + (url.includes('?') ? '&' : '?') + param + '=' + name;
      document.head.appendChild(s);
    });
  };

  /** fetch עם ניסיון חוזר דרך פרוקסי CORS (אם הוגדר) */
  U.fetchViaProxy = async function (url, opts = {}) {
    try {
      return await U.fetchJSON(url, opts);
    } catch (e) {
      const proxy = SA.config.corsProxy;
      if (!proxy) throw e;
      return U.fetchJSON(proxy + encodeURIComponent(url), opts);
    }
  };

  /**
   * בקשת ArcGIS REST: fetch (עם ניסיון חוזר), ואם נחסם ב-CORS — פרוקסי, ואז JSONP.
   * תוצאות נשמרות במטמון קבוע (IndexedDB) לשבוע.
   */
  const corsBlocked = new Set();
  U.arcgis = async function (url, params = {}, { timeout = 14000, ttl = 7 } = {}) {
    const qs = new URLSearchParams({ ...params, f: 'json' }).toString();
    const full = url + '?' + qs;
    const key = 'arc:' + full;
    const hit = await U.pcache.get(key);
    if (hit) return hit;
    const host = new URL(url).host;
    let data;
    if (!corsBlocked.has(host)) {
      try {
        data = await U.fetchViaProxy(full, { timeout, retries: 1 });
      } catch (e) {
        if (!(e instanceof TypeError) && !e.timeout) throw e; // שגיאת שרת אמיתית
        if (e instanceof TypeError) corsBlocked.add(host);
      }
    }
    if (!data) data = await U.jsonp(full, { timeout: timeout + 4000 });
    if (data && data.error) throw new Error(data.error.message || 'שגיאת ArcGIS');
    U.pcache.set(key, data, ttl);
    return data;
  };

  /* ---------- מטמון קבוע (IndexedDB) — ביקור חוזר באתר נטען מיד ---------- */
  let dbP = null;
  const db = () => {
    if (!dbP) dbP = new Promise((res) => {
      try {
        const r = indexedDB.open('sitelens', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('c');
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null);
      } catch (e) { res(null); }
    });
    return dbP;
  };
  U.pcache = {
    async get(k) {
      const m = U.cache.get(k);
      if (m !== undefined) return m;
      const d = await db();
      if (!d) return undefined;
      return new Promise((res) => {
        try {
          const q = d.transaction('c').objectStore('c').get(k);
          q.onsuccess = () => {
            const v = q.result;
            if (v && v.exp > Date.now()) { memCache.set(k, v.v); res(v.v); } else res(undefined);
          };
          q.onerror = () => res(undefined);
        } catch (e) { res(undefined); }
      });
    },
    async set(k, v, days = 7) {
      memCache.set(k, v);
      const d = await db();
      if (!d) return;
      try { d.transaction('c', 'readwrite').objectStore('c').put({ v, exp: Date.now() + days * 864e5 }, k); } catch (e) { /* quota */ }
    }
  };

  /** תור לשירותים עם מגבלת קצב (למשל Nominatim: בקשה לשנייה) */
  U.rateLimit = (gapMs) => {
    let chain = Promise.resolve();
    return (fn) => {
      const p = chain.then(fn);
      chain = p.catch(() => {}).then(() => sleep(gapMs));
      return p;
    };
  };

  /* ---------- coordinates ---------- */
  if (window.proj4) {
    proj4.defs(
      'EPSG:2039',
      '+proj=tmerc +lat_0=31.7343936111111 +lon_0=35.2045169444444 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 ' +
        '+ellps=GRS80 +towgs84=-24.0024,-17.1032,-17.8444,-0.33077,-1.85269,1.66969,5.4248 +units=m +no_defs'
    );
  }
  U.toITM = (lat, lon) => {
    if (!window.proj4) return null;
    const [x, y] = proj4('EPSG:4326', 'EPSG:2039', [lon, lat]);
    return { x: Math.round(x), y: Math.round(y) };
  };
  U.fromITM = (x, y) => {
    const [lon, lat] = proj4('EPSG:2039', 'EPSG:4326', [x, y]);
    return { lat, lon };
  };

  /* ---------- geometry ---------- */
  const R = 6371008.8;
  const rad = (d) => (d * Math.PI) / 180;
  U.haversine = (a, b) => {
    const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  /** הקרנה מקומית שטוחה (מטרים) סביב נקודת ייחוס */
  U.localProj = (origin) => {
    const kx = Math.cos(rad(origin.lat)) * R * (Math.PI / 180);
    const ky = R * (Math.PI / 180);
    return (p) => [(p.lon - origin.lon) * kx, (p.lat - origin.lat) * ky];
  };
  /** מרחק מינימלי מנקודה לקו שבור (מערך {lat,lon}) */
  U.distToLine = (pt, line) => {
    const P = U.localProj(pt);
    let best = Infinity;
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, ay] = P(line[i]), [bx, by] = P(line[i + 1]);
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      let t = len2 ? -(ax * dx + ay * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const x = ax + t * dx, y = ay + t * dy;
      best = Math.min(best, Math.hypot(x, y));
    }
    if (line.length === 1) best = U.haversine(pt, line[0]);
    return best;
  };
  /** שטח פוליגון במ"ר */
  U.areaM2 = (ring) => {
    if (!ring || ring.length < 3) return 0;
    const P = U.localProj(ring[0]);
    let s = 0;
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = P(ring[i]), [x2, y2] = P(ring[(i + 1) % ring.length]);
      s += x1 * y2 - x2 * y1;
    }
    return Math.abs(s) / 2;
  };
  /** נקודה בתוך פוליגון — ring: [[x,y],...] */
  U.pointInRing = (x, y, ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  U.bearing = (a, b) => {
    const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
    const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  };
  /** נקודת יעד לפי כיוון ומרחק */
  U.destination = (p, bearingDeg, dist) => {
    const d = dist / R, b = rad(bearingDeg), la = rad(p.lat), lo = rad(p.lon);
    const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
    return { lat: (la2 * 180) / Math.PI, lon: (lo2 * 180) / Math.PI };
  };

  /* ---------- formatting ---------- */
  const nf = new Intl.NumberFormat('he-IL');
  U.num = (n, digits = 0) =>
    n == null || isNaN(n) ? '—' : new Intl.NumberFormat('he-IL', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);
  U.int = (n) => (n == null || isNaN(n) ? '—' : nf.format(Math.round(n)));
  U.dist = (m) => (m == null || !isFinite(m) ? '—' : m < 1000 ? `${Math.round(m / 10) * 10} מ'` : `${U.num(m / 1000, 1)} ק"מ`);
  U.walk = (m) => `${Math.max(1, Math.round(m / 80))} דק' הליכה`;
  U.dir8 = (deg) => ['צפון', 'צפון-מזרח', 'מזרח', 'דרום-מזרח', 'דרום', 'דרום-מערב', 'מערב', 'צפון-מערב'][Math.round(deg / 45) % 8];
  U.time = (d) => (d instanceof Date && !isNaN(d) ? d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' }) : '—');
})(window.SA);

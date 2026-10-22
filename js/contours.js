/* =========================================================
   SiteLens — קווי גובה (טופוגרפיה) על המפה
   מפענח אריחי גבהים (Terrarium PNG, מבוסס SRTM ~30 מ') לרשת
   גבהים, ומחשב קווי גובה בשיטת Marching Squares.
   ========================================================= */
window.SA = window.SA || {};

(function (SA) {
  const T = (SA.topo = {});
  const TS = 256;

  const lon2x = (lon, z) => ((lon + 180) / 360) * TS * 2 ** z;
  const lat2y = (lat, z) => {
    const s = Math.sin((lat * Math.PI) / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TS * 2 ** z;
  };
  const x2lon = (x, z) => (x / (TS * 2 ** z)) * 360 - 180;
  const y2lat = (y, z) => (180 / Math.PI) * Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / (TS * 2 ** z)));

  function loadImg(url, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const t = setTimeout(() => { img.src = ''; reject(new Error('תם הזמן לטעינת אריח גבהים')); }, timeout);
      img.onload = () => { clearTimeout(t); resolve(img); };
      img.onerror = () => { clearTimeout(t); reject(new Error('אריח גבהים לא נטען')); };
      img.src = url;
    });
  }

  /** מרווח "עגול" בין קווי גובה לפי טווח הגבהים */
  function niceInterval(range) {
    const target = range / 14;
    return [2, 5, 10, 20, 25, 50, 100].find((v) => v >= target) || 100;
  }

  /** חיבור מקטעים בודדים לקווים רציפים */
  function join(segs) {
    const key = (p) => p[0].toFixed(3) + ',' + p[1].toFixed(3);
    const adj = new Map();
    segs.forEach((s, i) => s.forEach((p) => {
      const k = key(p);
      if (!adj.has(k)) adj.set(k, []);
      adj.get(k).push(i);
    }));
    const used = new Uint8Array(segs.length);
    const lines = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = 1;
      const line = [segs[i][0], segs[i][1]];
      for (const fwd of [true, false]) {
        for (;;) {
          const end = fwd ? line[line.length - 1] : line[0];
          const ek = key(end);
          const j = (adj.get(ek) || []).find((n) => !used[n]);
          if (j === undefined) break;
          used[j] = 1;
          const nxt = key(segs[j][0]) === ek ? segs[j][1] : segs[j][0];
          if (fwd) line.push(nxt); else line.unshift(nxt);
        }
      }
      lines.push(line);
    }
    return lines;
  }

  // טבלת Marching Squares: לכל מקרה — זוגות צלעות (0=עליונה 1=ימנית 2=תחתונה 3=שמאלית)
  const CASES = {
    1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[0, 1]], 5: [[3, 0], [2, 1]], 6: [[0, 2]], 7: [[3, 0]],
    8: [[3, 0]], 9: [[0, 2]], 10: [[3, 2], [0, 1]], 11: [[0, 1]], 12: [[3, 1]], 13: [[2, 1]], 14: [[3, 2]]
  };

  T.contours = async function (lat, lon, radius) {
    const z = radius <= 800 ? 15 : 14;
    const ext = Math.max(radius * 1.4, 600);
    const dLat = ext / 111320, dLon = ext / (111320 * Math.cos((lat * Math.PI) / 180));
    const gx0 = lon2x(lon - dLon, z), gx1 = lon2x(lon + dLon, z);
    const gy0 = lat2y(lat + dLat, z), gy1 = lat2y(lat - dLat, z);
    const tx0 = Math.floor(gx0 / TS), tx1 = Math.floor(gx1 / TS);
    const ty0 = Math.floor(gy0 / TS), ty1 = Math.floor(gy1 / TS);
    const nx = tx1 - tx0 + 1, ny = ty1 - ty0 + 1;
    if (nx * ny > 25) throw new Error('אזור גדול מדי לקווי גובה');

    const cv = document.createElement('canvas');
    cv.width = nx * TS; cv.height = ny * TS;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const tpl = SA.config.terrainTiles;
    const jobs = [];
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++)
        jobs.push(loadImg(tpl.replace('{z}', z).replace('{x}', tx).replace('{y}', ty))
          .then((img) => ctx.drawImage(img, (tx - tx0) * TS, (ty - ty0) * TS)));
    await Promise.all(jobs);
    const W = cv.width;
    const d = ctx.getImageData(0, 0, W, cv.height).data;

    // רשת גבהים (כל 2 פיקסלים) + החלקה 3×3 להפחתת רעש
    const ox = tx0 * TS, oy = ty0 * TS, step = 2;
    const px0 = Math.floor(gx0 - ox), py0 = Math.floor(gy0 - oy);
    const cols = Math.floor((Math.ceil(gx1 - ox) - px0) / step) + 1;
    const rows = Math.floor((Math.ceil(gy1 - oy) - py0) / step) + 1;
    const raw = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const i = ((py0 + r * step) * W + (px0 + c * step)) * 4;
        raw[r * cols + c] = d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768;
      }
    const g = new Float32Array(cols * rows);
    let min = Infinity, max = -Infinity;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        let s = 0, n = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr, cc = c + dc;
            if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) { s += raw[rr * cols + cc]; n++; }
          }
        const v = s / n;
        g[r * cols + c] = v;
        if (v < min) min = v;
        if (v > max) max = v;
      }

    const interval = niceInterval(max - min);
    const major = interval * 5;
    const toLL = ([c, r]) => [y2lat(oy + py0 + r * step, z), x2lon(ox + px0 + c * step, z)];
    const lines = [];

    for (let L = Math.ceil(min / interval) * interval; L <= max; L += interval) {
      const segs = [];
      for (let r = 0; r < rows - 1; r++)
        for (let c = 0; c < cols - 1; c++) {
          const a = g[r * cols + c], b = g[r * cols + c + 1];
          const cc = g[(r + 1) * cols + c + 1], dd = g[(r + 1) * cols + c];
          const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (cc > L ? 2 : 0) | (dd > L ? 1 : 0);
          if (idx === 0 || idx === 15) continue;
          const edge = (e) =>
            e === 0 ? [c + (L - a) / (b - a), r]
              : e === 1 ? [c + 1, r + (L - b) / (cc - b)]
                : e === 2 ? [c + (L - dd) / (cc - dd), r + 1]
                  : [c, r + (L - a) / (dd - a)];
          for (const [e1, e2] of CASES[idx]) segs.push([edge(e1), edge(e2)]);
        }
      for (const ln of join(segs)) {
        if (ln.length < 3) continue;
        lines.push({ level: L, major: L % major === 0, coords: ln.map(toLL) });
      }
    }
    /* ---------- דגימה, נקודות גובה, שיפועים, שכבת צבע גבהים ---------- */
    const X0 = ox + px0, Y0 = oy + py0;
    const sample = (la, lo) => {
      const c = (lon2x(lo, z) - X0) / step, r = (lat2y(la, z) - Y0) / step;
      if (c < 0 || r < 0 || c > cols - 1 || r > rows - 1) return null;
      const c0 = Math.floor(c), r0 = Math.floor(r), c1 = Math.min(c0 + 1, cols - 1), r1 = Math.min(r0 + 1, rows - 1);
      const fc = c - c0, fr = r - r0;
      const v = (rr, cc) => g[rr * cols + cc];
      return (v(r0, c0) * (1 - fc) + v(r0, c1) * fc) * (1 - fr) + (v(r1, c0) * (1 - fc) + v(r1, c1) * fc) * fr;
    };
    const cellM = (step * 156543.034 * Math.cos((lat * Math.PI) / 180)) / 2 ** z; // מטרים לתא
    const kx = Math.cos((lat * Math.PI) / 180) * 111320;
    let hi = null, lo = null, slopeSum = 0, slopeN = 0, steep = 0;
    const shade = new Float32Array(cols * rows);
    const az = (315 * Math.PI) / 180, alt = (45 * Math.PI) / 180;
    const LX = Math.sin(az) * Math.cos(alt), LY = Math.cos(az) * Math.cos(alt), LZ = Math.sin(alt);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const cl = c > 0 ? g[i - 1] : g[i], cr = c < cols - 1 ? g[i + 1] : g[i];
        const ru = r > 0 ? g[i - cols] : g[i], rd = r < rows - 1 ? g[i + cols] : g[i];
        const dzdx = (cr - cl) / (2 * cellM), dzdy = (ru - rd) / (2 * cellM);
        const sl = Math.atan(Math.hypot(dzdx, dzdy));
        // נורמל לפני השטח (x=מזרח, y=צפון) · כיוון האור (צפון-מערב, 45°)
        const nl = Math.hypot(dzdx, dzdy, 1);
        shade[i] = Math.max(0, (-dzdx * LX - dzdy * LY + LZ) / nl);
        const la = y2lat(Y0 + r * step, z), lo2 = x2lon(X0 + c * step, z);
        const dist = Math.hypot((lo2 - lon) * kx, (la - lat) * 110540);
        if (dist <= radius) {
          if (!hi || g[i] > hi.v) hi = { v: g[i], lat: la, lon: lo2 };
          if (!lo || g[i] < lo.v) lo = { v: g[i], lat: la, lon: lo2 };
          const pct = Math.tan(sl) * 100;
          slopeSum += pct; slopeN++;
          if (pct > 10) steep++;
        }
      }

    // צבעי גבהים (היפסומטרי) משולבים בהצללת תבליט
    const RAMP = [[0, [44, 123, 182]], [0.02, [116, 173, 120]], [0.25, [171, 210, 131]], [0.5, [254, 224, 139]], [0.75, [235, 160, 92]], [1, [168, 98, 60]]];
    const color = (t) => {
      for (let k = 1; k < RAMP.length; k++) if (t <= RAMP[k][0]) {
        const [t0, c0] = RAMP[k - 1], [t1, c1] = RAMP[k], f = (t - t0) / (t1 - t0 || 1);
        return c0.map((v, j) => v + (c1[j] - v) * f);
      }
      return RAMP[RAMP.length - 1][1];
    };
    const lo0 = Math.max(min, 0), span = Math.max(1, max - lo0);
    const tc = document.createElement('canvas');
    tc.width = cols; tc.height = rows;
    const tctx = tc.getContext('2d');
    const img = tctx.createImageData(cols, rows);
    for (let i = 0; i < cols * rows; i++) {
      const t = g[i] <= 0.5 ? 0 : 0.02 + 0.98 * Math.min(1, Math.max(0, (g[i] - lo0) / span));
      const [cr, cg, cb] = color(t);
      const sh = 0.55 + 0.6 * shade[i];
      img.data[i * 4] = Math.min(255, cr * sh); img.data[i * 4 + 1] = Math.min(255, cg * sh); img.data[i * 4 + 2] = Math.min(255, cb * sh);
      img.data[i * 4 + 3] = 255;
    }
    tctx.putImageData(img, 0, 0);
    const bounds = [[y2lat(Y0 + (rows - 1) * step, z), x2lon(X0, z)], [y2lat(Y0, z), x2lon(X0 + (cols - 1) * step, z)]];
    const ramp = RAMP.slice(1).map(([t, c]) => ({ v: lo0 + ((t - 0.02) / 0.98) * span, color: `rgb(${c.join(',')})` }));

    return {
      interval, major, min, max, lines, sample, cellM,
      tint: { url: tc.toDataURL('image/png'), bounds, ramp, lo: lo0, hi: max },
      spots: { hi, lo },
      slopeMean: slopeN ? slopeSum / slopeN : null,
      steepShare: slopeN ? steep / slopeN : null,
      site: sample(lat, lon)
    };
  };

  /** חתך טופוגרפי בין שתי נקודות */
  T.profile = function (res, a, b, n = 120) {
    const pts = [];
    const len = SA.util.haversine(a, b);
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const p = { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f };
      const v = res.sample(p.lat, p.lon);
      if (v != null) pts.push({ d: f * len, v });
    }
    return { len, pts };
  };
})(window.SA);

/* =========================================================
   SiteLens — פרופיל גילאים לאזור הסטטיסטי של האתר
   מקורות לפי סדר: שכבת אזורים סטטיסטיים של הלמ"ס (ArcGIS),
   data.gov.il, וקובץ אקסל/CSV של הלמ"ס שהמשתמש מעלה.
   ========================================================= */
window.SA = window.SA || {};

(function (SA) {
  const U = SA.util;
  const D = (SA.demo = {});

  // ממוצע ארצי בקירוב (למ"ס, סוף 2022) — להשוואה בלבד
  D.national = { kids: 33, seniors: 12.3 };

  const num = (v) => {
    if (typeof v === 'number') return v;
    if (typeof v !== 'string') return NaN;
    const t = v.replace(/[,\s%]/g, '');
    return /^-?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : NaN;
  };

  /** זיהוי עמודות גיל: "0-4", "גיל 15_19", "AGE_65_PLUS", "75 ומעלה", "בני 0-17 (%)" */
  D.parse = function (attrs, aliases = {}) {
    const buckets = [], extra = [];
    let total = null, area = '', areaName = '', locality = '';
    for (const [k, raw] of Object.entries(attrs || {})) {
      const label = aliases[k] && aliases[k] !== k ? aliases[k] : k;
      const both = `${k} ${label}`;
      const v = num(raw);
      if (/אזור.?סטטיסטי|stat_?a|stat.?area|^sta$|^stat$/i.test(both) && raw != null && raw !== '' && !/גיל|age/i.test(both)) {
        if (isNaN(v) || /שם|name/i.test(both)) areaName = areaName || String(raw); else area = area || String(raw);
        continue;
      }
      if (/יישוב|ישוב|locality|settl|city/i.test(both) && typeof raw === 'string') { locality = locality || raw; continue; }
      if (isNaN(v)) continue;
      if (/^(objectid|fid|shape|oid|id)/i.test(k)) continue;
      const pct = /%|אחוז|pct|percent|_p$|^p_/i.test(both);
      let m = both.match(/(?:^|[^\d])(\d{1,2})\s*(?:[-_–]|עד|to)\s*(\d{1,2})(?:[^\d]|$)/i);
      if (m && /גיל|age|בני|pop|אוכל|^\D*\d|גילאי|_\d/i.test(both) && +m[2] > +m[1] && +m[2] < 100) {
        buckets.push({ from: +m[1], to: +m[2], label: `${m[1]}–${m[2]}`, value: v, pct, key: k });
        continue;
      }
      m = both.match(/(?:^|[^\d])(\d{2})[\s_]*(?:\+|ומעלה|ויותר|plus|up|over|פלוס)/i);
      if (m && +m[1] >= 50 && +m[1] < 100) {
        buckets.push({ from: +m[1], to: 120, label: `${m[1]}+`, value: v, pct, key: k });
        continue;
      }
      if (total == null && /סה"?כ.?אוכלוס|total.?pop|pop.?total|^pop(ulation)?$|^tot_?pop|אוכלוסייה$|אוכלוסיה$|מספר.?תושבים/i.test(both)) { total = v; continue; }
      if (/משק.?בית|household|גודל.?משק|אשכול|cluster|socio|חברתי.?כלכלי|צפיפות|density|גיל.?חציוני|median|ממוצע|זכר|נקב|male|female|עולים|ילידי|דת|religion|שנות.?לימוד|אקדמ|תעסוק|הכנסה|income|רכב|דירות|נפשות/i.test(both)) {
        extra.push([label, v]);
      }
    }
    if (!buckets.length) return null;

    // אם כל הערכים מסתכמים ל-~100 — אחוזים
    const sum = buckets.reduce((s, b) => s + b.value, 0);
    const allPct = buckets.every((b) => b.pct) || (sum > 90 && sum < 110 && buckets.every((b) => b.value <= 100));
    // בחירת סדרה לא חופפת (קבוצות גיל עוקבות) — עדיפות לרזולוציה הגבוהה
    buckets.sort((a, b) => a.from - b.from || a.to - b.to);
    const series = [];
    let next = 0;
    for (const b of buckets) if (b.from === next || (series.length === 0 && b.from <= 1)) { series.push(b); next = b.to + 1; }
    const useSeries = series.length >= 3 ? series : buckets;

    const base = allPct ? 100 : total || useSeries.reduce((s, b) => s + b.value, 0);
    const share = (b) => (allPct ? b.value : (b.value / base) * 100);
    const sumRange = (lo, hi) => {
      const sel = useSeries.filter((b) => b.from >= lo && b.to <= hi);
      return sel.length ? sel.reduce((s, b) => s + share(b), 0) : null;
    };
    const direct = (lo, hi) => { const b = buckets.find((x) => x.from === lo && x.to === hi); return b ? share(b) : null; };
    const kids = direct(0, 17) ?? direct(0, 19) ?? sumRange(0, 19);
    const seniors = direct(65, 120) ?? sumRange(65, 120);
    return {
      series: useSeries.map((b) => ({ label: b.label, from: b.from, to: b.to, share: share(b), value: b.value })),
      isPct: allPct, total: total ?? (allPct ? null : base),
      kids, seniors,
      dependency: kids != null && seniors != null ? ((kids + seniors) / Math.max(1, 100 - kids - seniors)) * 100 : null,
      area, areaName, locality, extra: extra.slice(0, 12)
    };
  };

  /* ---------- 1. שכבת אזורים סטטיסטיים של הלמ"ס ---------- */
  D.fromServices = async function (lat, lon) {
    let layers = [];
    for (const root of SA.config.statRoots || []) {
      try { layers = layers.concat(await SA.api.discover(root, /stat|census|מפקד|pop|demog|אוכלוס|אזור|gis/i, 1)); } catch (e) { /* root unreachable */ }
    }
    const statLayers = layers.filter((l) => l.type !== 'Group Layer' && /stat|סטטיסט|אזור|census|מפקד/i.test(l.name));
    if (!statLayers.length) throw new Error('שכבת האזורים הסטטיסטיים של הלמ"ס לא נמצאה');
    const bySvc = {};
    statLayers.forEach((l) => (bySvc[l.svc] = bySvc[l.svc] || []).push(l));
    let best = null;
    for (const [svc, ls] of Object.entries(bySvc)) {
      const d = 0.0006;
      try {
        const idf = await U.arcgis(svc + '/identify', {
          geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', sr: 4326,
          layers: 'all:' + ls.map((l) => l.id).join(','), tolerance: 1,
          mapExtent: `${lon - d},${lat - d},${lon + d},${lat + d}`, imageDisplay: '400,400,96',
          returnGeometry: true, returnFieldName: true
        });
        for (const r of idf.results || []) {
          const meta = ls.find((l) => l.id === r.layerId) || { aliases: {} };
          const p = D.parse(r.attributes, meta.aliases);
          if (p && (!best || p.series.length > best.series.length)) {
            best = { ...p, source: `למ"ס · ${r.layerName}`, rings: (r.geometry && r.geometry.rings || []).map((rg) => rg.map(([x, y]) => ({ lat: y, lon: x }))) };
          }
        }
      } catch (e) { /* next */ }
    }
    if (!best) throw new Error('לא נמצאו נתוני גילאים בשכבת הלמ"ס');
    return best;
  };

  /* ---------- 2. data.gov.il ---------- */
  D.fromCkan = async function (city, statArea) {
    const base = SA.config.ckan;
    const queries = ['אזורים סטטיסטיים גיל', 'מפקד 2022 אזור סטטיסטי', 'אוכלוסייה לפי גיל אזור סטטיסטי'];
    const token = (city || '').split(/[\s\-–]/)[0];
    for (const q of queries) {
      const ps = await U.fetchViaProxy(`${base}/package_search?q=${encodeURIComponent(q)}&rows=5`).catch(() => null);
      for (const p of (ps && ps.result && ps.result.results) || []) {
        for (const r of p.resources || []) {
          if (!r.datastore_active) continue;
          try {
            const ds = await U.fetchViaProxy(`${base}/datastore_search?resource_id=${r.id}&q=${encodeURIComponent(statArea || token)}&limit=200`);
            const recs = ((ds.result && ds.result.records) || []).map((x) => ({ rec: x, p: D.parse(x) })).filter((x) => x.p);
            if (recs.length) return { options: recs.map((x) => ({ ...x.p, source: `data.gov.il · ${p.title}` })), dataset: p.title };
          } catch (e) { /* next */ }
        }
      }
    }
    throw new Error('לא נמצא מאגר גילאים לפי אזור סטטיסטי ב-data.gov.il');
  };

  /* ---------- 3. קובץ שהמשתמש מעלה (xlsx / csv של הלמ"ס) ---------- */
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('טעינת ספריית האקסל נכשלה'));
      document.head.appendChild(s);
    });
  }
  D.fromFile = async function (file, city) {
    if (!window.XLSX) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const options = [];
    const token = (city || '').replace(/[-–]/g, ' ').split(/\s+/)[0];
    for (const name of wb.SheetNames.slice(0, 6)) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });
      // שורת כותרת = השורה עם הכי הרבה טקסט ב-25 השורות הראשונות; מצרפים את השורה שמעליה (כותרות ממוזגות)
      let hi = 0, hc = -1;
      rows.slice(0, 25).forEach((r, i) => { const c = r.filter((x) => typeof x === 'string' && x.trim()).length; if (c > hc) { hc = c; hi = i; } });
      const above = rows[hi - 1] || [];
      let carry = '';
      const headers = rows[hi].map((h, j) => {
        if (String(above[j] || '').trim()) carry = String(above[j]).trim();
        return `${carry ? carry + ' ' : ''}${String(h || '').trim()}`.trim() || `col${j}`;
      });
      for (const r of rows.slice(hi + 1)) {
        const line = r.join(' ');
        if (token && !line.includes(token)) continue;
        const rec = {};
        headers.forEach((h, j) => (rec[h] = r[j]));
        const p = D.parse(rec);
        if (p) options.push({ ...p, source: `קובץ: ${file.name}`, label: r.filter((x) => String(x).trim()).slice(0, 3).join(' · ') });
      }
    }
    if (!options.length) throw new Error(token ? `לא נמצאו שורות עם עמודות גיל עבור "${token}"` : 'לא נמצאו עמודות גיל בקובץ');
    return { options: options.slice(0, 400), dataset: file.name };
  };
})(window.SA);

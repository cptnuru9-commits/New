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
    return { interval, major, min, max, lines };
  };
})(window.SA);

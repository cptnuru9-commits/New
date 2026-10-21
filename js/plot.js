/* =========================================================
   SiteLens — גבול מגרש, מידות צלעות, חזית לרחוב,
   וקווי בניין (היסט פנימי של הגבול לפי מרווחים)
   ========================================================= */
window.SA = window.SA || {};

(function (SA) {
  const U = SA.util;
  const P = (SA.plot = {});

  function proj(origin) {
    const kx = Math.cos((origin.lat * Math.PI) / 180) * 111320, ky = 110540;
    return {
      fwd: (p) => [(p.lon - origin.lon) * kx, (p.lat - origin.lat) * ky],
      inv: ([x, y]) => ({ lat: origin.lat + y / ky, lon: origin.lon + x / kx })
    };
  }

  /** ניקוי טבעת: הסרת נקודה כפולה, צלעות זעירות ונקודות כמעט-קוליניאריות */
  function clean(pts) {
    let a = pts.slice();
    if (a.length > 1 && Math.hypot(a[0][0] - a[a.length - 1][0], a[0][1] - a[a.length - 1][1]) < 0.01) a.pop();
    let changed = true;
    while (changed && a.length > 3) {
      changed = false;
      for (let i = 0; i < a.length; i++) {
        const p0 = a[(i - 1 + a.length) % a.length], p1 = a[i], p2 = a[(i + 1) % a.length];
        const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
        const cross = ((p1[0] - p0[0]) * (p2[1] - p1[1]) - (p1[1] - p0[1]) * (p2[0] - p1[0])) / (l1 * l2 || 1);
        if (l1 < 0.4 || Math.abs(cross) < 0.035) { a.splice(i, 1); changed = true; break; }
      }
    }
    return a;
  }
  const signedArea = (a) => a.reduce((s, p, i) => { const q = a[(i + 1) % a.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

  /**
   * ניתוח גבול המגרש: שטח, היקף, צלעות, סיווג חזית/צד/אחור.
   * streets — [{name, geom:[{lat,lon}]}]
   */
  P.analyze = function (ring, streets = []) {
    if (!ring || ring.length < 3) return null;
    const origin = ring.reduce((o, p) => ({ lat: o.lat + p.lat / ring.length, lon: o.lon + p.lon / ring.length }), { lat: 0, lon: 0 });
    const pr = proj(origin);
    let pts = clean(ring.map(pr.fwd));
    if (pts.length < 3) return null;
    if (signedArea(pts) < 0) pts.reverse(); // נגד כיוון השעון → הפנים משמאל לצלע
    const n = pts.length;

    // קווי רחוב במערכת המקומית
    const sLines = streets.map((s) => ({ name: s.name, pts: s.geom.map(pr.fwd) }));
    const distToStreets = (x, y) => {
      let best = Infinity, name = '';
      for (const s of sLines)
        for (let i = 0; i < s.pts.length - 1; i++) {
          const [ax, ay] = s.pts[i], [bx, by] = s.pts[i + 1];
          const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
          const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
          const d = Math.hypot(ax + t * dx - x, ay + t * dy - y);
          if (d < best) { best = d; name = s.name; }
        }
      return { d: best, name };
    };

    const edges = [];
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      const out = [dy / len, -dx / len]; // נורמל חיצוני
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const probe = distToStreets(mid[0] + out[0] * 6, mid[1] + out[1] * 6);
      edges.push({ i, a, b, len, out, mid, street: probe, kind: 'side' });
    }

    // חזית: צלעות שהצד החיצוני שלהן פונה לרחוב הקרוב ביותר
    const minD = Math.min(...edges.map((e) => e.street.d));
    if (isFinite(minD) && minD < 30) edges.forEach((e) => { if (e.street.d <= minD + 4 && e.len > 2) e.kind = 'front'; });
    else edges.reduce((m, e) => (e.len > m.len ? e : m)).kind = 'front';
    // אחורית: הצלע הפונה הכי הפוך לחזית
    const fr = edges.filter((e) => e.kind === 'front');
    const fn = fr.reduce((s, e) => [s[0] + e.out[0] * e.len, s[1] + e.out[1] * e.len], [0, 0]);
    const fl = Math.hypot(fn[0], fn[1]) || 1;
    let rear = null, best = -0.5;
    edges.forEach((e) => {
      if (e.kind === 'front') return;
      const dot = -(e.out[0] * fn[0] + e.out[1] * fn[1]) / fl;
      if (dot > best) { best = dot; rear = e; }
    });
    if (rear) rear.kind = 'rear';

    return {
      pr, pts, edges,
      area: Math.abs(signedArea(pts)),
      perimeter: edges.reduce((s, e) => s + e.len, 0),
      frontage: fr.reduce((s, e) => s + e.len, 0),
      frontStreet: (fr.find((e) => e.street.name) || {}).street?.name || '',
      ringLL: pts.map(pr.inv),
      edgesLL: edges.map((e) => ({ kind: e.kind, len: e.len, a: pr.inv(e.a), b: pr.inv(e.b), mid: pr.inv(e.mid), street: e.street.name }))
    };
  };

  /** קווי בניין: היסט פנימי של כל צלע לפי סוגה (קדמי/צדדי/אחורי) */
  P.envelope = function (lot, sb) {
    if (!lot) return null;
    const { pts, edges, pr } = lot;
    const n = pts.length;
    const lines = edges.map((e) => {
      const d = e.kind === 'front' ? sb.front : e.kind === 'rear' ? sb.rear : sb.side;
      const inn = [-e.out[0], -e.out[1]];
      return { p: [e.a[0] + inn[0] * d, e.a[1] + inn[1] * d], v: [e.b[0] - e.a[0], e.b[1] - e.a[1]] };
    });
    const out = [];
    for (let i = 0; i < n; i++) {
      const L1 = lines[(i - 1 + n) % n], L2 = lines[i];
      const cr = L1.v[0] * L2.v[1] - L1.v[1] * L2.v[0];
      if (Math.abs(cr) < 1e-9) { out.push(L2.p); continue; }
      const t = ((L2.p[0] - L1.p[0]) * L2.v[1] - (L2.p[1] - L1.p[1]) * L2.v[0]) / cr;
      out.push([L1.p[0] + L1.v[0] * t, L1.p[1] + L1.v[1] * t]);
    }
    const area = signedArea(out);
    // מרווחים גדולים מדי → המעטפת "מתהפכת"
    if (area <= 1 || area > Math.abs(signedArea(pts))) return null;
    const inside = out.every(([x, y]) => U.pointInRing(x, y, pts));
    if (!inside) return null;
    return { ring: out.map(pr.inv), area };
  };
})(window.SA);

/* =========================================================
   SiteLens — גרפים ב-SVG (ללא ספריות): מסלול שמש, שושנת רוחות,
   אקלים חודשי, אוכלוסייה לאורך זמן, מד ציון
   ========================================================= */
window.SA = window.SA || {};

(function (SA) {
  const U = SA.util;
  const CH = (SA.charts = {});
  const f1 = (n) => Math.round(n * 10) / 10;
  const MONTHS = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

  /* ---------------- שמש ---------------- */
  const toBearing = (az) => ((az * 180) / Math.PI + 180) % 360; // SunCalc: 0 = דרום
  const toDeg = (r) => (r * 180) / Math.PI;

  CH.sunData = function (lat, lon) {
    const y = new Date().getFullYear();
    const days = [
      { key: 'summer', label: 'היפוך קיץ · 21.6', date: new Date(Date.UTC(y, 5, 21)) },
      { key: 'equinox', label: 'שוויון · 20.3', date: new Date(Date.UTC(y, 2, 20)) },
      { key: 'winter', label: 'היפוך חורף · 21.12', date: new Date(Date.UTC(y, 11, 21)) }
    ];
    return days.map((d) => {
      const noonish = new Date(d.date.getTime() + 10 * 3600e3);
      const t = SunCalc.getTimes(noonish, lat, lon);
      const path = [], hours = [];
      const start = d.date.getTime() - 3 * 3600e3;
      for (let m = 0; m <= 24 * 60; m += 10) {
        const dt = new Date(start + m * 60e3);
        const p = SunCalc.getPosition(dt, lat, lon);
        const alt = toDeg(p.altitude);
        if (alt > -1) path.push({ az: toBearing(p.azimuth), alt: Math.max(0, alt), dt });
        if (m % 60 === 0 && alt > 0) hours.push({ az: toBearing(p.azimuth), alt, h: U.time(dt).slice(0, 2) });
      }
      const noon = SunCalc.getPosition(t.solarNoon, lat, lon);
      return {
        ...d, path, hours,
        sunrise: t.sunrise, sunset: t.sunset,
        riseAz: toBearing(SunCalc.getPosition(t.sunrise, lat, lon).azimuth),
        setAz: toBearing(SunCalc.getPosition(t.sunset, lat, lon).azimuth),
        noonAlt: toDeg(noon.altitude),
        dayLength: (t.sunset - t.sunrise) / 3600e3
      };
    });
  };

  CH.sunPath = function (lat, lon, data) {
    const S = 300, c = S / 2, R = 120;
    const pt = (az, alt) => {
      const r = ((90 - alt) / 90) * R, b = (az * Math.PI) / 180;
      return [c + r * Math.sin(b), c - r * Math.cos(b)];
    };
    let s = `<svg viewBox="0 0 ${S} ${S}" class="chart sunpath" role="img" aria-label="דיאגרמת מסלול השמש">`;
    [0, 30, 60].forEach((a) => {
      s += `<circle cx="${c}" cy="${c}" r="${((90 - a) / 90) * R}" class="grid"/>`;
      if (a) s += `<text x="${c + 3}" y="${c - ((90 - a) / 90) * R + 11}" class="tick">${a}°</text>`;
    });
    for (let b = 0; b < 360; b += 30) {
      const [x, y] = pt(b, 0);
      s += `<line x1="${c}" y1="${c}" x2="${f1(x)}" y2="${f1(y)}" class="grid"/>`;
    }
    [['צ', 0], ['מז', 90], ['ד', 180], ['מע', 270]].forEach(([l, b]) => {
      const r = R + 14, rad = (b * Math.PI) / 180;
      s += `<text x="${f1(c + r * Math.sin(rad))}" y="${f1(c - r * Math.cos(rad) + 4)}" class="axis" text-anchor="middle">${l}</text>`;
    });
    data.forEach((d) => {
      const pts = d.path.map((p) => pt(p.az, p.alt).map(f1).join(',')).join(' ');
      s += `<polyline points="${pts}" class="sun-${d.key}"/>`;
      if (d.key !== 'equinox') {
        d.hours.forEach((h) => {
          const [x, y] = pt(h.az, h.alt);
          s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="2.6" class="dot-${d.key}"/>`;
          if (d.key === 'summer' && +h.h % 3 === 0) s += `<text x="${f1(x)}" y="${f1(y - 6)}" class="tick" text-anchor="middle">${h.h}</text>`;
        });
      }
    });
    const now = SunCalc.getPosition(new Date(), lat, lon);
    if (now.altitude > 0) {
      const [x, y] = pt(toBearing(now.azimuth), toDeg(now.altitude));
      s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="6" class="sun-now"><title>מיקום השמש עכשיו</title></circle>`;
    }
    return s + '</svg>';
  };

  /* ---------------- רוח ---------------- */
  CH.windRose = function (cl) {
    const S = 300, c = S / 2, R = 118;
    const totals = cl.rose.map((r) => r.reduce((a, b) => a + b, 0));
    const max = Math.max(...totals) || 1;
    let s = `<svg viewBox="0 0 ${S} ${S}" class="chart windrose" role="img" aria-label="שושנת רוחות">`;
    [0.25, 0.5, 0.75, 1].forEach((k) => {
      s += `<circle cx="${c}" cy="${c}" r="${R * k}" class="grid"/>`;
      s += `<text x="${c + 3}" y="${c - R * k + 11}" class="tick">${f1(max * k)}%</text>`;
    });
    const wedge = (i, r0, r1) => {
      const a0 = ((i * 22.5 - 9.5) * Math.PI) / 180, a1 = ((i * 22.5 + 9.5) * Math.PI) / 180;
      const p = (r, a) => `${f1(c + r * Math.sin(a))},${f1(c - r * Math.cos(a))}`;
      return `M${p(r0, a0)} L${p(r1, a0)} A${r1},${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0},${r0} 0 0 0 ${p(r0, a0)}Z`;
    };
    cl.rose.forEach((bins, i) => {
      let acc = 0;
      bins.forEach((v, b) => {
        if (!v) return;
        const r0 = (acc / max) * R; acc += v;
        const r1 = (acc / max) * R;
        s += `<path d="${wedge(i, r0, r1)}" class="wbin wbin-${b}"><title>${U.dir8(i * 22.5)} · ${f1(v)}%</title></path>`;
      });
    });
    [['צ', 0], ['מז', 90], ['ד', 180], ['מע', 270]].forEach(([l, b]) => {
      const r = R + 16, rad = (b * Math.PI) / 180;
      s += `<text x="${f1(c + r * Math.sin(rad))}" y="${f1(c - r * Math.cos(rad) + 4)}" class="axis" text-anchor="middle">${l}</text>`;
    });
    return s + '</svg>';
  };

  /* ---------------- אקלים חודשי ---------------- */
  CH.climate = function (monthly) {
    const W = 360, H = 190, pl = 30, pr = 30, pt = 14, pb = 24;
    const iw = W - pl - pr, ih = H - pt - pb, bw = iw / 12;
    const tMax = Math.ceil(Math.max(...monthly.map((m) => m.tmax)) / 5) * 5;
    const tMin = Math.min(0, Math.floor(Math.min(...monthly.map((m) => m.tmin)) / 5) * 5);
    const rMax = Math.max(50, Math.ceil(Math.max(...monthly.map((m) => m.rain)) / 50) * 50);
    const ty = (t) => pt + ih - ((t - tMin) / (tMax - tMin)) * ih;
    const x = (i) => pl + bw * i + bw / 2;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart climate" role="img" aria-label="טמפרטורה ומשקעים חודשיים">`;
    for (let t = tMin; t <= tMax; t += 10) {
      s += `<line x1="${pl}" x2="${W - pr}" y1="${f1(ty(t))}" y2="${f1(ty(t))}" class="grid"/>`;
      s += `<text x="${pl - 4}" y="${f1(ty(t) + 3)}" class="tick" text-anchor="end">${t}°</text>`;
    }
    s += `<text x="${W - pr + 4}" y="${pt + 8}" class="tick">${rMax}מ"מ</text>`;
    monthly.forEach((m, i) => {
      const h = (m.rain / rMax) * ih;
      s += `<rect x="${f1(x(i) - bw * 0.32)}" y="${f1(pt + ih - h)}" width="${f1(bw * 0.64)}" height="${f1(h)}" rx="2" class="rain"><title>${MONTHS[i]}: ${Math.round(m.rain)} מ"מ</title></rect>`;
      s += `<text x="${f1(x(i))}" y="${H - 8}" class="tick" text-anchor="middle">${MONTHS[i]}</text>`;
    });
    const line = (k, cls) => {
      s += `<polyline points="${monthly.map((m, i) => `${f1(x(i))},${f1(ty(m[k]))}`).join(' ')}" class="${cls}"/>`;
      monthly.forEach((m, i) => (s += `<circle cx="${f1(x(i))}" cy="${f1(ty(m[k]))}" r="2.5" class="${cls}-dot"><title>${MONTHS[i]}: ${f1(m[k])}°</title></circle>`));
    };
    line('tmax', 'tmax');
    line('tmin', 'tmin');
    return s + '</svg>';
  };

  /* ---------------- אוכלוסייה ---------------- */
  CH.population = function (series) {
    if (!series || series.length < 2) return '';
    const W = 360, H = 170, pl = 46, pr = 12, pt = 16, pb = 22;
    const iw = W - pl - pr, ih = H - pt - pb;
    const y0 = series[0].year, y1 = series[series.length - 1].year;
    const vMax = Math.max(...series.map((d) => d.value)) * 1.08;
    const vMin = Math.min(...series.map((d) => d.value)) * 0.9;
    const X = (y) => pl + ((y - y0) / Math.max(1, y1 - y0)) * iw;
    const Y = (v) => pt + ih - ((v - vMin) / (vMax - vMin)) * ih;
    const fmt = (v) => (v >= 1e6 ? f1(v / 1e6) + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'K' : Math.round(v));
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart pop" role="img" aria-label="גידול אוכלוסייה">`;
    for (let k = 0; k <= 3; k++) {
      const v = vMin + ((vMax - vMin) * k) / 3;
      s += `<line x1="${pl}" x2="${W - pr}" y1="${f1(Y(v))}" y2="${f1(Y(v))}" class="grid"/>`;
      s += `<text x="${pl - 6}" y="${f1(Y(v) + 3)}" class="tick" text-anchor="end">${fmt(v)}</text>`;
    }
    const pts = series.map((d) => `${f1(X(d.year))},${f1(Y(d.value))}`);
    s += `<path d="M${pts[0]} L${pts.join(' L')} L${f1(X(y1))},${pt + ih} L${f1(X(y0))},${pt + ih}Z" class="area"/>`;
    s += `<polyline points="${pts.join(' ')}" class="line"/>`;
    series.forEach((d) => (s += `<circle cx="${f1(X(d.year))}" cy="${f1(Y(d.value))}" r="2.6" class="dot"><title>${d.year}: ${U.int(d.value)}</title></circle>`));
    s += `<text x="${pl}" y="${H - 6}" class="tick">${y0}</text><text x="${W - pr}" y="${H - 6}" class="tick" text-anchor="end">${y1}</text>`;
    return s + '</svg>';
  };

  /* ---------------- מד ציון ---------------- */
  CH.gauge = function (score) {
    const W = 200, H = 116, c = 100, cy = 104, R = 84;
    const a = Math.PI * (1 - score / 100);
    const p = (ang) => `${f1(c + R * Math.cos(ang))},${f1(cy - R * Math.sin(ang))}`;
    const cls = score >= 70 ? 'good' : score >= 45 ? 'mid' : 'low';
    return `<svg viewBox="0 0 ${W} ${H}" class="chart gauge" role="img" aria-label="ציון נגישות ${score}">
      <path d="M${p(Math.PI)} A${R},${R} 0 0 1 ${p(0)}" class="track"/>
      <path d="M${p(Math.PI)} A${R},${R} 0 0 1 ${p(a)}" class="val ${cls}"/>
      <text x="${c}" y="${cy - 14}" text-anchor="middle" class="big">${score}</text>
      <text x="${c}" y="${cy + 2}" text-anchor="middle" class="tick">מתוך 100</text></svg>`;
  };
})(window.SA);

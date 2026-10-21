/* =========================================================
   SiteLens — תבניות HTML לכל לשונית
   ========================================================= */
window.SA = window.SA || {};

(function (SA) {
  const U = SA.util;
  const esc = U.esc;
  const R = (SA.render = {});

  /* ---------- רכיבים ---------- */
  R.sk = (n = 3) => `<div class="sk-wrap">${Array.from({ length: n }, (_, i) => `<div class="sk" style="width:${92 - i * 14}%"></div>`).join('')}</div>`;
  R.card = (title, body, { icon = '', status = '', extra = '', cls = '' } = {}) =>
    `<article class="card ${cls}"><header class="card-h"><h3>${icon ? `<span class="ci">${icon}</span>` : ''}${title}</h3>${status ? R.status(status) : ''}${extra}</header><div class="card-b">${body}</div></article>`;
  R.status = (s) => {
    const m = { loading: ['טוען', 'loading'], ok: ['נטען', 'ok'], error: ['לא זמין', 'err'], partial: ['חלקי', 'warn'] }[s] || [s, ''];
    return `<span class="st st-${m[1]}">${m[0]}</span>`;
  };
  R.err = (msg, links = '') => `<div class="err-box"><p>⚠️ ${esc(msg)}</p>${links}</div>`;
  R.kpi = (label, value, sub = '', tone = '') =>
    `<div class="kpi ${tone}"><span class="kpi-l">${label}</span><span class="kpi-v">${value}</span>${sub ? `<span class="kpi-s">${sub}</span>` : ''}</div>`;
  R.dl = (rows) => `<dl class="dl">${rows.filter((r) => r && r[1] != null && r[1] !== '' && r[1] !== '—').map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  R.link = (href, label, cls = 'lnk') => `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">${label}<span aria-hidden="true"> ↗</span></a>`;
  R.chip = (txt, tone = '') => `<span class="chip-s ${tone}">${txt}</span>`;
  R.row = (it, extra = '') => {
    const c = SA.CATS[it.cat];
    return `<li class="row" data-id="${esc(it.id)}" tabindex="0" role="button">
      <span class="row-dot" style="--c:${c.color}">${c.icon}</span>
      <span class="row-main"><b>${esc(it.name)}</b><small>${esc(it.subLabel)}${extra}</small></span>
      <span class="row-dist">${U.dist(it.dist)}<small>${U.walk(it.dist)}</small></span></li>`;
  };

  /* ---------- קישורים חיצוניים ---------- */
  R.links = (s) => {
    const itm = U.toITM(s.lat, s.lon) || { x: 0, y: 0 };
    return {
      govmap: `https://www.govmap.gov.il/?c=${itm.x},${itm.y}&z=10&b=0`,
      govmapParcel: `https://www.govmap.gov.il/?c=${itm.x},${itm.y}&z=11&lay=PARCEL_ALL,SUB_GUSH_ALL`,
      mavat: 'https://mavat.iplan.gov.il/SV3',
      streetview: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${s.lat},${s.lon}`,
      gmaps: `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}`,
      transit: `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}&travelmode=transit`,
      moovit: `https://moovitapp.com/?to=${encodeURIComponent(s.addr || 'יעד')}&tll=${s.lat}_${s.lon}&lang=he`,
      waze: `https://waze.com/ul?ll=${s.lat},${s.lon}&navigate=yes`,
      osm: `https://www.openstreetmap.org/#map=18/${s.lat}/${s.lon}`,
      nadlan: 'https://www.nadlan.gov.il/',
      cbs: 'https://www.cbs.gov.il/he/settlements/Pages/default.aspx',
      datagov: 'https://data.gov.il/',
      iplan: 'https://www.gov.il/he/departments/iplan',
      edu: 'https://shkifut.education.gov.il/',
      muniGis: `https://www.google.com/search?q=${encodeURIComponent('GIS הנדסה מידע תכנוני ' + (s.city || ''))}`,
      taGis: 'https://gisn.tel-aviv.gov.il/iview2js4/index.aspx'
    };
  };

  /* =========================================================
     סקירה
     ========================================================= */
  const SCORE = [
    ['תחנת אוטובוס', (i) => i.sub === 'bus_stop', 400, 15],
    ['רכבת / רכבת קלה', (i) => /station|halt|light_rail|tram_stop/.test(i.sub), 1200, 15],
    ['גן ילדים / מעון', (i) => /kindergarten|childcare/.test(i.sub), 500, 10],
    ['בית ספר', (i) => i.sub === 'school', 800, 10],
    ['פארק / גינה', (i) => /park|garden|playground/.test(i.sub), 400, 15],
    ['מכולת / סופר', (i) => /supermarket|marketplace|mall/.test(i.sub), 600, 10],
    ['מרפאה', (i) => /clinic|doctors|hospital/.test(i.sub), 800, 10],
    ['בית מרקחת', (i) => i.sub === 'pharmacy', 800, 5],
    ['מתנ"ס / ספרייה', (i) => /community_centre|library/.test(i.sub), 1000, 10]
  ];
  R.score = (items) => {
    let total = 0;
    const parts = SCORE.map(([label, fn, lim, w]) => {
      const it = items.find(fn);
      const d = it ? it.dist : Infinity;
      const k = d <= lim ? 1 : Math.max(0, 1 - (d - lim) / (lim * 1.5));
      total += w * k;
      return { label, d, k, w, lim };
    });
    return { score: Math.round(total), parts };
  };

  R.overview = (S) => {
    const st = S.status;
    const poi = S.poi && S.poi.items;
    const near = (fn, max = Infinity) => (poi ? poi.filter((i) => fn(i) && i.dist <= max) : null);
    const rail = poi && poi.find((i) => /station|halt|light_rail|tram_stop/.test(i.sub));
    const plans = S.plans && S.plans.atSite;
    const loadingV = '<span class="sk sk-inline"></span>';
    const v = (key, fn) => (st[key] === 'ok' ? fn() : st[key] === 'error' ? '—' : loadingV);

    const kpis = [
      R.kpi('תב״ע החלות באתר', v('plans', () => plans.length || '0'), plans && plans[0] ? esc(plans[0].number) : ''),
      R.kpi('גוש / חלקה', v('parcel', () => `${esc(S.parcel.gush ?? '?')} / ${esc(S.parcel.helka ?? '?')}`), S.parcel && S.parcel.area ? `${U.int(S.parcel.area)} מ"ר` : ''),
      R.kpi('תחנות אוטובוס ≤400 מ׳', v('poi', () => near((i) => i.sub === 'bus_stop', 400).length)),
      R.kpi('רכבת / רק״ל קרובה', v('poi', () => (rail ? U.dist(rail.dist) : 'מעל 2.5 ק"מ')), rail ? esc(rail.name) : ''),
      R.kpi('חינוך ברדיוס', v('poi', () => near((i) => i.cat === 'education').length), 'בתי ספר, גנים ומעונות'),
      R.kpi('פארקים וגינות', v('poi', () => near((i) => i.cat === 'green' && /park|garden|playground/.test(i.sub)).length),
        S.poi ? `${U.int(S.poi.parks.reduce((s, p) => s + p.area, 0) / 1000)} דונם ירוק` : ''),
      R.kpi('מרחק מקו החוף', v('env', () => (isFinite(S.env.coastDist) ? U.dist(S.env.coastDist) : 'מעל 6 ק"מ')), '',
        S.env && S.env.coastDist < 300 ? 'alert' : ''),
      R.kpi('גובה / שיפוע', v('elev', () => `${U.int(S.elev.elevation)} מ'`), S.elev ? `שיפוע ${U.num(S.elev.slopePct, 1)}% לכיוון ${U.dir8(S.elev.aspect)}` : '')
    ].join('');

    let scoreHtml = R.sk(4);
    if (st.poi === 'ok') {
      const sc = R.score(poi);
      scoreHtml = `<div class="score">${SA.charts.gauge(sc.score)}
        <ul class="score-list">${sc.parts.map((p) => `<li><span class="bar"><i style="width:${Math.round(p.k * 100)}%"></i></span><span>${p.label}</span><small>${isFinite(p.d) ? U.dist(p.d) : 'לא ברדיוס'}</small></li>`).join('')}</ul></div>
        <p class="muted small">ציון משוקלל לפי מרחק הליכה לשירותים חיוניים (בהשראת Walk Score). מוגבל לרדיוס הניתוח שנבחר.</p>`;
    } else if (st.poi === 'error') scoreHtml = R.err('לא ניתן לחשב — נתוני השירותים לא נטענו');

    const check = [
      ['מיקום וכתובת', st.addr], ['גוש וחלקה', st.parcel], ['תב״ע ותכניות', st.plans], ['תחבורה ציבורית', st.poi],
      ['דרכי הגעה', st.env], ['מוסדות חינוך', st.poi], ['גנים ופארקים', st.poi], ['אוכלוסייה', st.pop],
      ['קו המים / חוף', st.env], ['טופוגרפיה', st.elev], ['שמש והצללה', 'ok'], ['רוח ואקלים', st.climate],
      ['מרקם בנוי וגובה', st.env], ['גבול מגרש', st.lot], ['קווי בניין', st.lot === 'ok' ? (S.pdetail && S.pdetail.lines.length ? 'ok' : 'manual') : st.lot],
      ['ייעודי קרקע ושצ״פ', st.pdetail], ['פרופיל גילאים', st.ages], ['היסטוריה ושימור', 'manual'], ['רעש ומטרדים', 'manual'], ['צילום וסיור באתר', 'manual']
    ];
    const ico = { ok: '✓', error: '!', loading: '…', manual: '✎' };
    const checklist = `<ul class="checklist">${check.map(([l, s]) => `<li class="ck ck-${s || 'loading'}"><span>${ico[s] || '…'}</span>${l}</li>`).join('')}</ul>
      <p class="muted small">✎ = נושא שדורש עבודת שטח / ארכיון. ! = מקור לא זמין — ראו לשונית "מקורות".</p>`;

    const L = R.links(S);
    const quick = `<div class="quick">${R.link(L.govmap, 'GovMap', 'qbtn')}${R.link(L.mavat, 'מבא״ת', 'qbtn')}${R.link(L.streetview, 'Street View', 'qbtn')}${R.link(L.osm, 'OSM', 'qbtn')}${R.link(L.nadlan, 'עסקאות נדל״ן', 'qbtn')}</div>`;

    return `<div class="kpis">${kpis}</div>
      ${R.card('ציון נגישות לשירותים', scoreHtml, { icon: '🚶' })}
      ${R.card('צ׳קליסט ניתוח אתר', checklist, { icon: '📋' })}
      ${R.card('קישורים מהירים', quick, { icon: '🔗' })}`;
  };

  /* =========================================================
     תכנון
     ========================================================= */
  R.planning = (S) => {
    const L = R.links(S);
    const st = S.status;

    // חלקה
    let parcel;
    if (st.parcel === 'loading') parcel = R.sk(3);
    else if (st.parcel === 'error')
      parcel = R.err(S.errors.parcel || 'לא נמצאו נתוני גוש/חלקה', `<p class="small">שכבת הגושים והחלקות זמינה ישירות ב-GovMap:</p><div class="quick">${R.link(L.govmapParcel, 'פתח גוש/חלקה ב-GovMap', 'qbtn')}</div>`);
    else {
      const p = S.parcel;
      parcel = `<div class="parcel-big"><div><span>גוש</span><b>${esc(p.gush ?? '—')}</b></div><div><span>חלקה</span><b>${esc(p.helka ?? '—')}</b></div>${p.area ? `<div><span>שטח רשום</span><b>${U.int(p.area)}<small> מ"ר</small></b></div>` : ''}</div>
        ${R.dl([['סטטוס', esc(p.status || '')], ['יישוב', esc(p.locality || '')]])}
        <div class="quick">${R.link(L.govmapParcel, 'GovMap', 'qbtn')}<button class="qbtn" data-copy="גוש ${esc(p.gush)} חלקה ${esc(p.helka)}">העתק גוש/חלקה</button><button class="qbtn" data-act="fitParcel">הצג במפה</button></div>
        <details class="raw"><summary>כל השדות</summary>${R.dl(Object.entries(p.raw || {}).filter(([k, v]) => v != null && typeof v !== 'object').map(([k, v]) => [esc(k), esc(v)]))}</details>`;
    }

    // תכניות
    let plans;
    if (st.plans === 'loading') plans = R.sk(5);
    else if (st.plans === 'error')
      plans = R.err(S.errors.plans || 'שרת מנהל התכנון לא זמין', `<p class="small">שכבת הקווים הכחולים מוצגת במפה (אם השרת זמין). ניתן לבדוק ידנית:</p><div class="quick">${R.link(L.mavat, 'מבא״ת', 'qbtn')}${R.link(L.govmap, 'GovMap', 'qbtn')}</div>`);
    else {
      const { atSite, nearby, others } = S.plans;
      plans = atSite.length
        ? atSite.map((p, i) => planCard(p, i === 0)).join('')
        : `<p class="muted">לא אותרו תכניות החלות על הנקודה עצמה. בדקו את רשימת התכניות בסביבה ואת שכבת הקווים הכחולים במפה.</p>`;
      if (nearby.length)
        plans += `<details class="nearby" ${atSite.length ? '' : 'open'}><summary>תכניות נוספות ברדיוס (${nearby.length})</summary><ul class="plan-list">${nearby.slice(0, 60).map((p) =>
          `<li><span class="pn">${esc(p.number)}</span><span class="pname">${esc(p.name || '')}</span>${p.status ? R.chip(esc(p.status), SA.api.planStatusClass(p.status)) : ''}</li>`).join('')}</ul></details>`;
      if (others.length)
        plans += `<details class="raw"><summary>שכבות נוספות בנקודה (${others.length})</summary>${others.map((o) => `<h4>${esc(o.layer)}</h4>${R.dl(Object.entries(o.attrs).filter(([k, v]) => v != null && v !== '' && v !== 'Null').slice(0, 14).map(([k, v]) => [esc(o.aliases[k] || k), esc(v)]))}`).join('')}</details>`;
    }

    // היתרים (ת"א)
    let permits = '';
    if (S.permits && S.permits.length)
      permits = R.card(`היתרי בנייה בסביבה (${S.permits.length})`, `<p class="muted small">מתוך ה-GIS של עיריית תל אביב-יפו, רדיוס ~120 מ'.</p>${S.permits.slice(0, 15).map((p) =>
        `<details class="raw"><summary>${esc(Object.values(p.attrs).find((v) => typeof v === 'string' && v.length > 3) || p.layer)}</summary>${R.dl(Object.entries(p.attrs).filter(([k, v]) => v != null && v !== '').slice(0, 14).map(([k, v]) => [esc(p.aliases[k] || k), esc(typeof v === 'number' && v > 1e11 ? new Date(v).toLocaleDateString('he-IL') : v)]))}</details>`).join('')}`, { icon: '🏗️' });

    const docs = `<ul class="bullets">
      <li><b>תיק מידע להיתר</b> — מהוועדה המקומית: זכויות, קווי בניין, הנחיות מרחביות.</li>
      <li><b>הוראות התכנית + תשריט</b> — במבא״ת לפי מספר התכנית: ייעוד, אחוזי בנייה, מס׳ קומות, תכסית.</li>
      <li><b>נספח בינוי / תנועה / סביבה</b> — אם קיימים בתכנית.</li>
      <li><b>תכניות מתאר ארציות ומחוזיות</b> — תמ״א 35, תמ״א 38/תכנית ההתחדשות, תמ״א 13 (חופים), תמ״מ המחוזית.</li>
      <li><b>היתרים קודמים ותיק בניין</b> — בארכיון ההנדסה של הרשות.</li>
      <li><b>הנחיות מרחביות ותכנית מתאר כוללנית</b> — של הרשות המקומית.</li></ul>
      <div class="quick">${R.link(L.muniGis, `GIS הנדסה — ${esc(S.city || 'הרשות')}`, 'qbtn')}${/תל.?אביב/.test(S.city || '') ? R.link(L.taGis, 'GIS תל אביב', 'qbtn') : ''}${R.link(L.iplan, 'מנהל התכנון', 'qbtn')}</div>`;

    return R.card('גוש וחלקה', parcel, { icon: '🧾', status: st.parcel }) +
      R.card('גבול המגרש וקווי בניין', R.lotHtml(S), { icon: '📏', status: S.status.lot }) +
      R.card('ייעודי קרקע ושצ״פ', R.landuseHtml(S), { icon: '🟩', status: S.status.pdetail }) +
      R.card('תב״ע — תכניות החלות על האתר', plans, { icon: '📐', status: st.plans }) +
      permits +
      R.card('מסמכים ואישורים לאסוף', docs, { icon: '🗂️' });
  };

  /* =========================================================
     גבול מגרש וקווי בניין
     ========================================================= */
  const KIND = { front: 'חזית', side: 'צד', rear: 'אחור' };
  R.lotHtml = (S) => {
    const st = S.status.lot;
    if (st === 'loading' || (!st && S.status.parcel === 'loading')) return R.sk(4);
    if (!S.lot) return R.err(S.errors.lot || 'אין גבול חלקה לחישוב — נדרשים נתוני גוש/חלקה', `<div class="quick">${R.link(R.links(S).govmapParcel, 'GovMap', 'qbtn')}</div>`);
    const lot = S.lot, sb = S.setbacks;
    const pd = S.pdetail;
    const official = pd && pd.lines.length;
    const planLot = pd && pd.lots.find((l) => l.contains);
    const edges = lot.edgesLL.map((e, i) => `<tr><td>${i + 1}</td><td><span class="kind kind-${e.kind}">${KIND[e.kind]}</span></td><td>${U.num(e.len, 1)} מ׳</td><td>${esc(e.street || '')}</td></tr>`).join('');
    return `<div class="kpis">${R.kpi('שטח (מחושב)', `${U.int(lot.area)} מ"ר`, S.parcel && S.parcel.area ? `רשום: ${U.int(S.parcel.area)} מ"ר` : '')}${R.kpi('היקף', `${U.num(lot.perimeter, 1)} מ׳`)}${R.kpi('חזית לרחוב', `${U.num(lot.frontage, 1)} מ׳`, lot.frontStreet ? 'רח׳ ' + esc(lot.frontStreet) : '')}${R.kpi('צלעות', lot.edgesLL.length)}</div>
      ${planLot ? `<p class="small">✓ נמצא גם <b>מגרש לפי התכנית</b>${planLot.number ? ` (${esc(planLot.number)})` : ''} — מוצג במפה בקו מקווקו חום.</p>` : ''}
      <details class="raw"><summary>מידות הצלעות</summary><table class="tbl"><thead><tr><th>#</th><th>סוג</th><th>אורך</th><th>רחוב</th></tr></thead><tbody>${edges}</tbody></table></details>
      <h4>קווי בניין ${official ? '' : '(משוערים)'}</h4>
      ${official ? `<p class="small ok-note">✓ נמצאו ${pd.lines.length} קווי בניין בשכבת "${esc(pd.searched.lines.join(', '))}" — מוצגים במפה בקו אדום רציף.</p>` : `<p class="small muted">לא נמצאה שכבת קווי בניין פתוחה לאתר זה. הזינו את המרווחים מהוראות התב״ע / תיק המידע, והמעטפת תחושב ותוצג במפה בקו אדום מקווקו.</p>`}
      <div class="sb-grid">
        <label>קדמי (מ׳)<input type="number" min="0" step="0.5" data-sb="front" value="${sb.front}"></label>
        <label>צדדי (מ׳)<input type="number" min="0" step="0.5" data-sb="side" value="${sb.side}"></label>
        <label>אחורי (מ׳)<input type="number" min="0" step="0.5" data-sb="rear" value="${sb.rear}"></label>
        <label>קומות<input type="number" min="1" step="1" data-sb="floors" value="${sb.floors}"></label>
        <label>תכסית מרבית %<input type="number" min="0" max="100" step="1" data-sb="coverage" value="${sb.coverage}" placeholder="—"></label>
      </div>
      <div class="kpis k3" id="envKpis">${R.envKpis(S)}</div>
      <p class="muted small">חזית = הצלע הפונה לרחוב הקרוב (OSM); אחור = הצלע שמולה; השאר צדדיות. החישוב גיאומטרי בלבד — הקובע הוא התב״ע, תיק המידע וההנחיות המרחביות.</p>`;
  };
  R.envKpis = (S) => {
    const env = S.envelope, sb = S.setbacks, lot = S.lot;
    if (!env) return `<div class="kpi alert" style="grid-column:1/-1"><span class="kpi-l">שטח בין קווי הבניין</span><span class="kpi-v">—</span><span class="kpi-s">המרווחים גדולים מדי למגרש או שצורתו מורכבת</span></div>`;
    const cap = sb.coverage ? (lot.area * sb.coverage) / 100 : Infinity;
    const fp = Math.min(env.area, cap);
    return R.kpi('שטח בין קווי הבניין', `${U.int(env.area)} מ"ר`, `${U.num((env.area / lot.area) * 100, 0)}% מהמגרש`) +
      R.kpi('תכסית לחישוב', `${U.int(fp)} מ"ר`, isFinite(cap) && cap < env.area ? `מוגבל ל-${sb.coverage}% תכסית` : 'לפי קווי הבניין') +
      R.kpi(`שטח ברוטו ×${sb.floors}`, `${U.int(fp * sb.floors)} מ"ר`, `רח״ק ≈ ${U.num((fp * sb.floors) / lot.area, 2)}`);
  };

  /* =========================================================
     ייעודי קרקע ושצ"פ
     ========================================================= */
  R.landuseHtml = (S) => {
    const st = S.status.pdetail, pd = S.pdetail;
    const osmGreen = S.poi ? S.poi.parks.filter((p) => /park|garden/.test(p.sub)) : [];
    const osmFallback = () => {
      if (!S.poi) return '';
      const near = S.poi.items.filter((i) => /park|garden/.test(i.sub)).slice(0, 5);
      return `<h4>שטחים ירוקים לפי OSM (קירוב לשצ״פ)</h4>${near.length ? `<ul class="rows">${near.map((i) => R.row(i)).join('')}</ul>` : '<p class="muted">לא נמצאו ברדיוס</p>'}
        <p class="muted small">סה״כ ${U.int(osmGreen.reduce((s, p) => s + p.area, 0) / 1000)} דונם פארקים וגינות ברדיוס הניתוח. שצ״פ סטטוטורי — לפי תשריט התב״ע במבא״ת.</p>`;
    };
    if (st === 'loading') return R.sk(4);
    if (st === 'error' || !pd || !pd.landuse.length) {
      return `<p class="small">${st === 'error' ? `⚠️ ${esc(S.errors.pdetail || 'שירותי התכנון לא זמינים')}` : `לא נמצאה שכבת ייעודי קרקע פתוחה לאזור זה${pd && pd.layerCount ? ` (נסרקו ${pd.layerCount} שכבות)` : ''}.`} ייעודי הקרקע מופיעים בתשריט התב״ע במבא״ת וב-GovMap.</p>
        <div class="quick">${R.link(R.links(S).mavat, 'מבא״ת', 'qbtn')}${R.link(R.links(S).govmap, 'GovMap', 'qbtn')}</div>${osmFallback()}`;
    }
    const site = pd.landuse.find((u) => u.dist === 0);
    const opens = pd.landuse.filter((u) => u.open);
    const groups = {};
    pd.landuse.forEach((u) => { (groups[u.group] = groups[u.group] || { area: 0, color: u.color }).area += u.area; });
    const tot = Object.values(groups).reduce((s, g) => s + g.area, 0);
    const bars = Object.entries(groups).sort((a, b) => b[1].area - a[1].area).map(([g, v]) =>
      `<li><span class="lu-sw" style="background:${v.color}"></span><span>${g}</span><span class="bar"><i style="width:${(v.area / tot) * 100}%;background:${v.color}"></i></span><small>${U.num((v.area / tot) * 100, 0)}%</small></li>`).join('');
    return `${site ? `<div class="lu-site"><span class="lu-sw" style="background:${site.color}"></span><div><small>ייעוד הקרקע באתר</small><b>${esc(site.designation)}</b></div></div>` : ''}
      <div class="kpis k3">${R.kpi('שצ״פ ב-300 מ׳', opens.length ? `${U.num(opens.reduce((s, u) => s + u.area, 0) / 1000, 1)} ד׳` : '0', `${opens.length} שטחים`)}${R.kpi('שצ״פ קרוב', opens.length ? U.dist(Math.min(...opens.map((u) => u.dist))) : '—')}${R.kpi('ייעודים שונים', Object.keys(groups).length)}</div>
      <h4>תמהיל ייעודים ברדיוס 300 מ׳</h4><ul class="lu-list">${bars}</ul>
      ${opens.length ? `<h4>שצ״פים קרובים</h4><ul class="simple">${opens.slice(0, 6).map((u) => `<li><span class="lu-sw" style="background:#22c55e"></span><span>${esc(u.designation)}<small> · ${U.int(u.area)} מ"ר</small></span><b>${u.dist === 0 ? 'באתר' : U.dist(u.dist)}</b></li>`).join('')}</ul>` : osmFallback()}
      <p class="muted small">מקור: ${esc(pd.searched.landuse.join(', '))}. שטחים מחושבים מהפוליגונים — ייתכנו חפיפות בין תכניות.</p>`;
  };

  /* =========================================================
     פרופיל גילאים
     ========================================================= */
  R.agesHtml = (S) => {
    const st = S.status.ages, a = S.ages;
    const upload = `<label class="upload">📄 העלאת קובץ למ״ס (xlsx / csv)<input type="file" accept=".xlsx,.xls,.csv" data-act="agesFile"></label>`;
    if (st === 'loading') return R.sk(5);
    if (!a) {
      return `<p class="small">⚠️ ${esc(S.errors.ages || 'לא נמצאו נתוני גילאים לאזור הסטטיסטי')}</p>
        <p class="small">הלמ״ס מפרסמת נתוני מפקד 2022 לפי <b>אזור סטטיסטי</b> (כמה בלוקים סביב האתר). להורדת הקובץ: אתר המפקד ← "נתונים נבחרים לפי יישובים ואזורים סטטיסטיים", ואז להעלות אותו כאן — האתר ימצא את שורות ${esc(S.city || 'היישוב')} ויציג את התפלגות הגילאים.</p>
        <div class="quick">${R.link('https://census.cbs.gov.il/', 'אתר מפקד 2022', 'qbtn')}${R.link(R.links(S).cbs, 'למ״ס — יישובים', 'qbtn')}</div>${upload}`;
    }
    const pick = S.agesOptions && S.agesOptions.length > 1
      ? `<label class="pick">אזור סטטיסטי:<select data-act="agesPick">${S.agesOptions.map((o, i) => `<option value="${i}" ${o === a ? 'selected' : ''}>${esc(o.label || [o.locality, o.areaName || o.area].filter(Boolean).join(' · ') || 'שורה ' + (i + 1))}</option>`).join('')}</select></label>` : '';
    const max = Math.max(...a.series.map((b) => b.share));
    const bars = a.series.map((b) => `<li><span>${b.label}</span><span class="bar age"><i style="width:${(b.share / max) * 100}%"></i></span><small>${U.num(b.share, 1)}%</small></li>`).join('');
    const cmp = (v, nat) => v == null ? '' : v > nat + 3 ? `מעל הממוצע הארצי (~${nat}%)` : v < nat - 3 ? `מתחת לממוצע הארצי (~${nat}%)` : `קרוב לממוצע הארצי (~${nat}%)`;
    return `${pick}<div class="kpis">${R.kpi('אזור סטטיסטי', esc(a.areaName || a.area || '—'), esc(a.locality || ''))}${R.kpi('תושבים באזור', a.total ? U.int(a.total) : '—')}${R.kpi('ילדים ונוער', a.kids != null ? `${U.num(a.kids, 0)}%` : '—', cmp(a.kids, SA.demo.national.kids))}${R.kpi('בני 65+', a.seniors != null ? `${U.num(a.seniors, 0)}%` : '—', cmp(a.seniors, SA.demo.national.seniors))}</div>
      <h4>התפלגות גילאים</h4><ul class="age-list">${bars}</ul>
      ${a.dependency != null ? `<p class="small">יחס תלות: <b>${U.num(a.dependency, 0)}</b> תלויים (ילדים + מבוגרים) לכל 100 בגיל העבודה.</p>` : ''}
      ${a.extra.length ? `<details class="raw"><summary>נתונים נוספים לאזור (${a.extra.length})</summary>${R.dl(a.extra.map(([k, v]) => [esc(k), U.num(v, 1)]))}</details>` : ''}
      <p class="muted small">מקור: ${esc(a.source)}. האזור הסטטיסטי מסומן במפה בקו סגול מקווקו (אם השכבה זמינה).</p>${upload}`;
  };

  function planCard(p, primary) {
    const cls = SA.api.planStatusClass(p.status);
    const rows = [
      ['שם התכנית', esc(p.name || '')], ['סוג', esc(p.type || '')], ['סמכות', esc(p.authority || '')],
      ['מרחב תכנון', esc(p.county || '')], ['שטח', p.area ? `${U.num(p.area, 1)} דונם` : ''], ['תאריך', esc(p.date || '')],
      ['ייעודי קרקע', esc(p.landuse || '')], ['מטרות', esc(p.objectives || '')]
    ];
    const raw = Object.entries(p.raw || {}).filter(([k, v]) => v != null && v !== '' && v !== 'Null' && typeof v !== 'object');
    return `<div class="plan ${primary ? 'primary' : ''}">
      <div class="plan-h"><span class="plan-no">${esc(p.number)}</span>${p.status ? R.chip(esc(p.status), cls) : ''}</div>
      ${R.dl(rows)}
      <div class="quick">${p.url ? R.link(p.url, 'מסמכי התכנית', 'qbtn primary') : ''}<button class="qbtn" data-copy="${esc(p.number)}" data-open="https://mavat.iplan.gov.il/SV3">חיפוש במבא״ת</button></div>
      <details class="raw"><summary>כל השדות (${raw.length})</summary>${R.dl(raw.map(([k, v]) => [esc(p.aliases[k] || k), esc(v)]))}</details></div>`;
  }

  /* =========================================================
     תחבורה
     ========================================================= */
  R.transport = (S) => {
    const st = S.status, L = R.links(S);
    let pt;
    if (st.poi === 'loading') pt = R.sk(5);
    else if (st.poi === 'error') pt = R.err(S.errors.poi || 'Overpass לא זמין');
    else {
      const items = S.poi.items.filter((i) => i.cat === 'transit');
      const rail = items.filter((i) => /station|halt|light_rail|tram_stop/.test(i.sub)).slice(0, 6);
      const bus = items.filter((i) => i.sub === 'bus_stop');
      const lines = new Set();
      bus.filter((b) => b.dist <= 500).forEach((b) => b.routes.split(/[;,]/).map((x) => x.trim()).filter(Boolean).forEach((x) => lines.add(x)));
      const bikes = items.filter((i) => i.sub === 'bicycle_rental');
      pt = `<div class="kpis k3">${R.kpi('תחנות ≤400 מ׳', bus.filter((b) => b.dist <= 400).length)}${R.kpi('קווים ייחודיים ≤500 מ׳', lines.size || '—', lines.size ? '' : 'אין נתוני קווים ב-OSM')}${R.kpi('תחנות אופניים', bikes.length)}</div>
        <h4>רכבת ורכבת קלה</h4>${rail.length ? `<ul class="rows">${rail.map((r) => R.row(r)).join('')}</ul>` : '<p class="muted">אין תחנה ברדיוס 2.5 ק"מ</p>'}
        <h4>תחנות אוטובוס קרובות</h4>${bus.length ? `<ul class="rows">${bus.slice(0, 12).map((b) => R.row(b, b.routes ? ` · קווים ${esc(b.routes)}` : '')).join('')}</ul>` : '<p class="muted">לא נמצאו תחנות ברדיוס</p>'}
        ${lines.size ? `<div class="lines">${[...lines].sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b)).slice(0, 60).map((l) => `<span class="line-chip">${esc(l)}</span>`).join('')}</div>` : ''}`;
    }

    let roads;
    if (st.env === 'loading') roads = R.sk(4);
    else if (st.env === 'error') roads = R.err(S.errors.env || 'לא זמין');
    else {
      const cls = { motorway: 'כביש מהיר', trunk: 'דרך ראשית', primary: 'עורק ראשי', secondary: 'עורק משני' };
      roads = `<h4>דרכים עיקריות קרובות</h4>${S.env.roadGroups.length ? `<ul class="simple">${S.env.roadGroups.slice(0, 8).map((r) =>
        `<li><span class="road road-${r.cls}">${esc(r.ref || '—')}</span><span>${esc(r.name || cls[r.cls])}<small> · ${cls[r.cls]}</small></span><b>${U.dist(r.dist)}</b></li>`).join('')}</ul>` : '<p class="muted">אין דרכים עיקריות ברדיוס 1.2 ק"מ</p>'}
        <h4>מחלפים קרובים</h4>${S.env.junctions.length ? `<ul class="simple">${S.env.junctions.slice(0, 5).map((j) => `<li><span class="road road-motorway">${esc(j.ref || 'מחלף')}</span><span>${esc(j.name)}</span><b>${U.dist(j.dist)}</b></li>`).join('')}</ul>` : '<p class="muted">אין מחלפים ברדיוס 5 ק"מ</p>'}`;
    }
    const iso = `<p class="small">${st.iso === 'ok' ? 'האיזוכרונים במפה מחושבים לפי רשת ההליכה בפועל (Valhalla / OSM).' : st.iso === 'error' ? 'שירות האיזוכרונים לא זמין — במפה מוצגים מעגלי הליכה משוערים.' : 'מחשב איזוכרונים…'}</p>
      <div class="iso-legend"><span style="--c:#0d9488">5 דק׳</span><span style="--c:#0ea5e9">10 דק׳</span><span style="--c:#6366f1">15 דק׳</span></div>`;
    const nav = `<div class="quick">${R.link(L.moovit, 'Moovit', 'qbtn')}${R.link(L.transit, 'Google — תחב״צ', 'qbtn')}${R.link(L.waze, 'Waze', 'qbtn')}</div>`;

    return R.card('תחבורה ציבורית', pt, { icon: '🚌', status: st.poi }) +
      R.card('דרכי הגעה ברכב', roads, { icon: '🛣️', status: st.env }) +
      R.card('טווחי הליכה', iso, { icon: '🚶', status: st.iso }) +
      R.card('ניווט ותכנון מסלול', nav, { icon: '🧭' });
  };

  /* =========================================================
     שירותים
     ========================================================= */
  R.services = (S) => {
    const st = S.status;
    if (st.poi === 'loading') return R.card('שירותים בסביבה', R.sk(6), { icon: '📍', status: 'loading' });
    if (st.poi === 'error') return R.card('שירותים בסביבה', R.err(S.errors.poi || 'Overpass לא זמין'), { icon: '📍', status: 'error' });
    const { items, parks } = S.poi;
    const cats = Object.keys(SA.CATS).filter((k) => k !== 'transit');
    let out = '';
    const greenArea = parks.reduce((s, p) => s + p.area, 0);
    const circle = Math.PI * S.r * S.r;
    out += R.card('שטחים ירוקים', `<div class="kpis k3">${R.kpi('שטח ירוק ברדיוס', `${U.int(greenArea / 1000)} דונם`)}${R.kpi('אחוז מהשטח', `${U.num((greenArea / circle) * 100, 1)}%`)}${R.kpi('הפארק הגדול', parks.length ? U.int(Math.max(...parks.map((p) => p.area)) / 1000) + ' ד׳' : '—', parks.length ? esc(parks.reduce((a, b) => (b.area > a.area ? b : a)).name) : '')}</div>
      <p class="muted small">מחושב מפוליגונים של OSM (פארקים, גינות, גני שעשועים ושמורות) בתוך רדיוס הניתוח. מומלץ להשוות לתקן שצ״פ של הרשות.</p>`, { icon: '🌳' });
    for (const k of cats) {
      const list = items.filter((i) => i.cat === k);
      const c = SA.CATS[k];
      const bySub = {};
      list.forEach((i) => (bySub[i.subLabel] = (bySub[i.subLabel] || 0) + 1));
      const subs = Object.entries(bySub).sort((a, b) => b[1] - a[1]).map(([l, n]) => R.chip(`${esc(l)} · ${n}`)).join('');
      const body = list.length
        ? `<div class="chips-row">${subs}</div><ul class="rows">${list.slice(0, 8).map((i) => R.row(i)).join('')}</ul>${list.length > 8 ? `<details><summary>עוד ${list.length - 8}</summary><ul class="rows">${list.slice(8, 80).map((i) => R.row(i)).join('')}</ul></details>` : ''}`
        : '<p class="muted">לא נמצאו ברדיוס הנבחר</p>';
      out += R.card(`${c.label} <span class="count">${list.length}</span>`, body, { icon: c.icon });
    }
    const L = R.links(S);
    out += R.card('השלמות', `<p class="small">מידע על בתי ספר (שכבות גיל, מספר תלמידים) — בפורטל השקיפות של משרד החינוך. נתוני OSM תלויים בעדכניות המיפוי — מומלץ לאמת בשטח.</p><div class="quick">${R.link(L.edu, 'שקיפות במשרד החינוך', 'qbtn')}${R.link(L.gmaps, 'Google Maps', 'qbtn')}</div>`, { icon: '➕' });
    return out;
  };

  /* =========================================================
     אוכלוסייה ומרקם
     ========================================================= */
  R.population = (S) => {
    const st = S.status, L = R.links(S);
    let pop;
    if (st.pop === 'loading') pop = R.sk(5);
    else if (st.pop === 'error' && !S.pop) pop = R.err(S.errors.pop || 'לא נמצאו נתוני אוכלוסייה', `<div class="quick">${R.link(L.cbs, 'למ״ס — יישובים', 'qbtn')}</div>`);
    else {
      const p = S.pop || {};
      const w = p.wd || {};
      const latest = w.latest ? w.latest.value : p.osmPopulation;
      const year = w.latest ? w.latest.year : p.osmPopulationDate;
      const density = latest && w.area ? latest / w.area : null;
      let growth = '';
      if (w.series && w.series.length > 1) {
        const a = w.series.find((d) => d.year >= w.latest.year - 10) || w.series[0];
        if (a !== w.latest) {
          const g = (Math.pow(w.latest.value / a.value, 1 / (w.latest.year - a.year)) - 1) * 100;
          growth = `${U.num(g, 1)}% לשנה (${a.year}–${w.latest.year})`;
        }
      }
      pop = `<div class="kpis">${R.kpi('תושבים', U.int(latest), year ? `נכון ל-${esc(year)}` : '')}${R.kpi('שטח שיפוט', w.area ? `${U.num(w.area, 1)} קמ"ר` : '—')}${R.kpi('צפיפות', density ? `${U.int(density)}` : '—', 'נפש לקמ"ר')}${R.kpi('קצב גידול', growth ? growth.split(' ')[0] : '—', growth ? growth.split(' ').slice(1).join(' ') : '')}</div>
        ${w.series && w.series.length > 1 ? `<div class="chart-box">${SA.charts.population(w.series)}</div>` : ''}
        ${R.dl([['שנת ייסוד', w.founded || ''], ['גובה ממוצע (Wikidata)', w.elevation ? `${U.int(w.elevation)} מ'` : '']])}
        <div class="quick">${w.wiki ? R.link(w.wiki, 'ויקיפדיה', 'qbtn') : ''}${p.wikidata ? R.link(`https://www.wikidata.org/wiki/${p.wikidata}`, 'Wikidata', 'qbtn') : ''}${R.link(L.cbs, 'למ״ס — פרופיל יישוב', 'qbtn')}</div>
        ${S.ckan ? `<details class="raw"><summary>data.gov.il · ${esc(S.ckan.dataset)}</summary>${R.dl(Object.entries(S.ckan.records[0]).filter(([k]) => k !== '_id').slice(0, 18).map(([k, v]) => [esc(k), esc(v)]))}${R.link(S.ckan.url, 'למאגר המלא')}</details>` : ''}
        <p class="muted small">נתוני אוכלוסייה ברמת יישוב (מקור: למ״ס דרך Wikidata / OSM). לנתונים ברמת אזור סטטיסטי — מפת האזורים הסטטיסטיים של הלמ״ס.</p>`;
    }

    let morph;
    if (st.env === 'loading') morph = R.sk(3);
    else if (st.env === 'error') morph = R.err(S.errors.env || 'לא זמין');
    else {
      const m = S.env.morph;
      morph = `<div class="kpis">${R.kpi('מבנים', U.int(m.count))}${R.kpi('תכסית', `${U.num(m.coverage * 100, 0)}%`)}${R.kpi('ממוצע קומות', m.avgLevels ? U.num(m.avgLevels, 1) : '—', `ידוע ל-${m.levelsKnown} מבנים`)}${R.kpi('רח״ק משוער', U.num(m.far, 2), 'שטח רצפות / שטח')}</div>
        <div class="legend-row">${SA.map.levelColors.map(([l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div>
        <p class="muted small">חישוב ברדיוס 250 מ' מטביעות רגל של מבנים ב-OSM. מבנים ללא נתוני קומות מחושבים לפי הממוצע. אומדן בלבד.</p>`;
    }
    return R.card('פרופיל גילאים — האזור הסטטיסטי של האתר', R.agesHtml(S), { icon: '🧒', status: st.ages }) +
      R.card(`אוכלוסייה — ${esc(S.city || 'היישוב')}`, pop, { icon: '👥', status: st.pop }) +
      R.card('מרקם בנוי וצפיפות מקומית', morph, { icon: '🏙️', status: st.env });
  };

  /* =========================================================
     סביבה
     ========================================================= */
  R.environment = (S) => {
    const st = S.status;
    let water;
    if (st.env === 'loading') water = R.sk(3);
    else if (st.env === 'error') water = R.err(S.errors.env || 'לא זמין');
    else {
      const e = S.env;
      let zone = '';
      if (e.coastDist < 100) zone = R.chip('בתוך 100 מ׳ מקו החוף — תחום חוף הים: בנייה אסורה ככלל', 'bad');
      else if (e.coastDist < 300) zone = R.chip('בתוך 300 מ׳ — סביבה חופית: נדרש דיון בולחו״ף', 'warn');
      const river = e.rivers.slice().sort((a, b) => a.dist - b.dist)[0];
      const wb = e.water.slice().sort((a, b) => a.dist - b.dist)[0];
      water = `<div class="kpis k3">${R.kpi('קו החוף', isFinite(e.coastDist) ? U.dist(e.coastDist) : '>6 ק"מ', '', e.coastDist < 300 ? 'alert' : '')}${R.kpi('נחל / ערוץ', river ? U.dist(river.dist) : '>2 ק"מ', river ? esc(river.name) : '')}${R.kpi('גוף מים', wb ? U.dist(wb.dist) : '>2 ק"מ', wb ? esc(wb.name) : '')}</div>
        ${zone ? `<div class="chips-row">${zone}</div>` : ''}
        <p class="muted small">קו החוף מתוך OSM. חוק שמירת הסביבה החופית ותמ״א 13 קובעים מגבלות בתחום 100 מ׳ ו-300 מ׳ מקו המים. קו החוף הרשמי — בשכבות GovMap ובמסמכי הוועדה לשמירת הסביבה החופית.</p>`;
    }

    let topo;
    if (st.elev === 'loading') topo = R.sk(2);
    else if (st.elev === 'error') topo = R.err(S.errors.elev || 'לא זמין');
    else {
      const t = S.elev;
      topo = `<div class="kpis">${R.kpi('גובה', `${U.int(t.elevation)} מ'`, 'מעל פני הים')}${R.kpi('שיפוע', `${U.num(t.slopePct, 1)}%`, t.slopePct < 2 ? 'כמעט מישורי' : t.slopePct < 8 ? 'מתון' : t.slopePct < 15 ? 'בינוני' : 'תלול')}${R.kpi('מפנה', U.dir8(t.aspect), `${Math.round(t.aspect)}°`)}${R.kpi('הפרש גבהים', `${U.int(t.max - t.min)} מ'`, 'ברדיוס 120 מ׳')}</div>
        <p class="muted small">מודל גבהים דיגיטלי (Copernicus DEM, ~90 מ׳) דרך Open-Meteo. לתכנון מפורט נדרשת מדידה טופוגרפית.</p>`;
    }
    const cn = S.contours;
    topo += st.contours === 'ok'
      ? `<div class="contour-info"><span class="key-sw">〰️</span><span><b>קווי גובה מוצגים במפה</b> · כל ${cn.interval} מ׳, קו ראשי (עבה, עם ערך) כל ${cn.major} מ׳ · טווח ${Math.round(cn.min)}–${Math.round(cn.max)} מ׳</span></div>`
      : st.contours === 'error'
        ? `<p class="small">⚠️ לא ניתן לחשב קווי גובה (${esc(S.errors.contours || '')}). אפשר לבחור "מפה טופוגרפית" בכפתור השכבות.</p>`
        : '<p class="muted small">מחשב קווי גובה למפה…</p>';

    const sun = S.sun;
    const sunHtml = `<div class="chart-box sq">${SA.charts.sunPath(S.lat, S.lon, sun)}</div>
      <div class="legend-row"><span><i class="lg-summer"></i>קיץ</span><span><i class="lg-equinox"></i>שוויון</span><span><i class="lg-winter"></i>חורף</span><span><i class="lg-now"></i>עכשיו</span></div>
      <table class="tbl"><thead><tr><th></th>${sun.map((d) => `<th>${d.label.split('·')[0]}</th>`).join('')}</tr></thead><tbody>
        <tr><th>זריחה</th>${sun.map((d) => `<td>${U.time(d.sunrise)}</td>`).join('')}</tr>
        <tr><th>שקיעה</th>${sun.map((d) => `<td>${U.time(d.sunset)}</td>`).join('')}</tr>
        <tr><th>אורך יום</th>${sun.map((d) => `<td>${U.num(d.dayLength, 1)} ש׳</td>`).join('')}</tr>
        <tr><th>זווית בצהריים</th>${sun.map((d) => `<td>${Math.round(d.noonAlt)}°</td>`).join('')}</tr>
        <tr><th>אזימוט זריחה</th>${sun.map((d) => `<td>${Math.round(d.riseAz)}°</td>`).join('')}</tr>
        <tr><th>אזימוט שקיעה</th>${sun.map((d) => `<td>${Math.round(d.setAz)}°</td>`).join('')}</tr></tbody></table>
      <p class="muted small">חזית דרומית: הצללה אופקית יעילה (שמש גבוהה בקיץ ~${Math.round(sun[0].noonAlt)}°). חזיתות מזרח/מערב: הצללה אנכית. שכבת "כיווני זריחה ושקיעה" במפה מציגה את הכיוונים בהיפוכים.</p>`;

    let wind;
    if (st.climate === 'loading') wind = R.sk(4);
    else if (st.climate === 'error') wind = R.err(S.errors.climate || 'לא זמין');
    else {
      const c = S.climate;
      wind = `<div class="chart-box sq">${SA.charts.windRose(c)}</div>
        <div class="legend-row"><span><i class="wbin-0"></i>&lt;2 מ/ש</span><span><i class="wbin-1"></i>2–4</span><span><i class="wbin-2"></i>4–6</span><span><i class="wbin-3"></i>&gt;6</span></div>
        <div class="kpis k3">${R.kpi('רוח שולטת', U.dir8(c.prevailing), `${Math.round(c.prevailing)}°`)}${R.kpi('מהירות ממוצעת', `${U.num(c.meanSpeed, 1)} מ/ש`)}${R.kpi('שקט', `${U.num(c.calm, 0)}%`, 'מהשעות')}</div>`;
    }
    let climate = '';
    if (st.climate === 'ok') {
      const c = S.climate;
      climate = R.card(`אקלים ${c.year}`, `<div class="chart-box">${SA.charts.climate(c.monthly)}</div>
        <div class="legend-row"><span><i class="lg-tmax"></i>מקס׳</span><span><i class="lg-tmin"></i>מינ׳</span><span><i class="lg-rain"></i>משקעים</span></div>
        <div class="kpis k3">${R.kpi('משקעים שנתיים', `${U.int(c.annualRain)} מ"מ`)}${R.kpi('החודש החם', `${U.num(Math.max(...c.monthly.map((m) => m.tmax)), 0)}°`)}${R.kpi('החודש הקר', `${U.num(Math.min(...c.monthly.map((m) => m.tmin)), 0)}°`)}</div>
        <p class="muted small">ERA5 reanalysis דרך Open-Meteo, שנה קלנדרית מלאה אחרונה.</p>`, { icon: '🌡️' });
    }

    return R.card('קו המים ומים עיליים', water, { icon: '🌊', status: st.env }) +
      R.card('טופוגרפיה', topo, { icon: '⛰️', status: st.elev }) +
      R.card('מסלול השמש', sunHtml, { icon: '☀️' }) +
      R.card(`משטר רוחות${S.climate ? ' ' + S.climate.year : ''}`, wind, { icon: '🌬️', status: st.climate }) +
      climate;
  };

  /* =========================================================
     מקורות
     ========================================================= */
  R.sources = (S) => {
    const st = S.status, L = R.links(S);
    const rows = [
      ['כתובת וגיאוקודינג', 'OpenStreetMap · Nominatim', st.addr, 'https://nominatim.org/'],
      ['גוש וחלקה', 'המרכז למיפוי ישראל · GovMap opendata', st.parcel, L.govmapParcel],
      ['תכניות (תב״ע)', 'מנהל התכנון · XPLAN ArcGIS', st.plans, L.mavat],
      ['שירותים ותחבורה', 'OpenStreetMap · Overpass API', st.poi, 'https://overpass-api.de/'],
      ['דרכים, מים, מבנים', 'OpenStreetMap · Overpass API', st.env, 'https://overpass-api.de/'],
      ['אוכלוסייה', 'למ״ס דרך Wikidata · data.gov.il', st.pop, L.cbs],
      ['טופוגרפיה', 'Copernicus DEM · Open-Meteo', st.elev, 'https://open-meteo.com/'],
      ['קווי גובה', 'SRTM · AWS Terrain Tiles', st.contours, 'https://registry.opendata.aws/terrain-tiles/'],
      ['ייעודי קרקע, שצ״פ, קווי בניין', 'מנהל התכנון · סריקת שכבות', st.pdetail, L.mavat],
      ['גבול מגרש וחזית', 'GovMap + OSM', st.lot, L.govmapParcel],
      ['פרופיל גילאים', 'למ״ס · אזורים סטטיסטיים / data.gov.il', st.ages, 'https://census.cbs.gov.il/'],
      ['רוח ואקלים', 'ERA5 · Open-Meteo Archive', st.climate, 'https://open-meteo.com/'],
      ['איזוכרונים', 'Valhalla · FOSSGIS', st.iso, 'https://valhalla.github.io/valhalla/'],
      ['שמש', 'SunCalc (חישוב מקומי)', 'ok', 'https://github.com/mourner/suncalc']
    ];
    const tbl = `<ul class="sources">${rows.map(([t, src, s, href]) => `<li><span class="src-st src-${s || 'loading'}"></span><span><b>${t}</b><small>${src}</small></span>${R.link(href, 'מקור')}</li>`).join('')}</ul>`;
    const more = `<ul class="bullets">
      <li>${R.link(L.govmap, 'GovMap')} — שכבות רשמיות: קדסטר, תכניות, רמ״י, עתיקות, שימור, תשתיות.</li>
      <li>${R.link(L.mavat, 'מבא״ת')} — מסמכי תכניות, הוראות ותשריטים.</li>
      <li>${R.link(L.datagov, 'data.gov.il')} — מאגרי מידע ממשלתיים פתוחים (API).</li>
      <li>${R.link(L.cbs, 'הלשכה המרכזית לסטטיסטיקה')} — פרופיל יישובים ואזורים סטטיסטיים.</li>
      <li>${R.link(L.nadlan, 'nadlan.gov.il')} — עסקאות נדל״ן בסביבה.</li>
      <li>${R.link(L.streetview, 'Google Street View')} — סיור וירטואלי באתר.</li></ul>`;
    return R.card('סטטוס מקורות המידע', tbl + `<div class="quick"><button class="qbtn" data-act="settings">הגדרות מקורות / פרוקסי</button><button class="qbtn" data-act="retry">טען מחדש</button></div>`, { icon: '🛰️' }) +
      R.card('מקורות נוספים לניתוח', more, { icon: '📚' }) +
      R.card('הערה חשובה', `<p class="small">המידע נאסף ממקורות פתוחים לצורכי לימוד וניתוח ראשוני. אין להסתמך עליו כמידע תכנוני מחייב — יש לאמת מול הוועדה המקומית, מבא״ת ו-GovMap.</p>`, { icon: 'ℹ️' });
  };
})(window.SA);

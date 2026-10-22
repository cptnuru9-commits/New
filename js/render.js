/* =========================================================
   SiteLens — תוכן הפאנל והמקרא
   כל לשונית = נושא בניתוח אתר אדריכלי. כל כרטיס יודע להציג
   מצב טעינה, שגיאה עם "נסו שוב", ונתונים.
   ========================================================= */
window.SA = window.SA || {};

(function (SA) {
  const U = SA.util;
  const esc = U.esc;
  const R = (SA.render = {});

  /* =========================================================
     לשוניות
     ========================================================= */
  R.TABS = [
    { key: 'overview', label: 'סיכום', icon: '◎' },
    { key: 'lot', label: 'מגרש', icon: '▱' },
    { key: 'planning', label: 'תכנון', icon: '▦' },
    { key: 'topo', label: 'טופוגרפיה', icon: '⛰' },
    { key: 'climate', label: 'אקלים', icon: '☀' },
    { key: 'transport', label: 'תנועה', icon: '⇄' },
    { key: 'services', label: 'שירותים', icon: '⌂' },
    { key: 'fabric', label: 'מרקם', icon: '▤' },
    { key: 'population', label: 'אוכלוסייה', icon: '☺' },
    { key: 'sources', label: 'מקורות', icon: 'ⓘ' }
  ];

  /* =========================================================
     רכיבים
     ========================================================= */
  R.sk = (n = 3) => `<div class="sk-wrap">${Array.from({ length: n }, (_, i) => `<div class="sk" style="width:${92 - i * 14}%"></div>`).join('')}<p class="slow-hint">השרת איטי — ממשיכים לנסות ברקע…</p></div>`;
  R.card = (title, body, { icon = '', status = '', sub = '', cls = '', id = '' } = {}) =>
    `<article class="card ${cls}" ${id ? `id="${id}"` : ''}><header class="card-h">${icon ? `<span class="ci" aria-hidden="true">${icon}</span>` : ''}<div class="card-t"><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div>${status ? R.status(status) : ''}</header><div class="card-b">${body}</div></article>`;
  R.status = (s) => {
    const m = { loading: ['טוען', 'loading'], ok: ['', 'ok'], error: ['לא זמין', 'err'], partial: ['חלקי', 'warn'] }[s];
    return m && m[0] ? `<span class="st st-${m[1]}">${m[0]}</span>` : '';
  };
  R.err = (msg, key, extra = '') =>
    `<div class="err-box"><div><b>לא הצלחנו לטעון את המידע</b><p>${esc(msg || 'השירות לא זמין כרגע')}</p></div>${key ? `<button class="btn ghost sm" data-retry="${key}">↻ נסו שוב</button>` : ''}</div>${extra}`;
  /** מצב טעינה/שגיאה/תוכן לפי מקור */
  R.state = (S, key, fn, extra = '') => {
    const st = S.status[key];
    if (st === 'loading' || st == null) return R.sk(4);
    if (st === 'error') return R.err(S.errors[key], key, extra);
    try { return fn(); } catch (e) { console.error(e); return R.err('שגיאה בעיבוד הנתונים: ' + e.message, key); }
  };
  R.kpi = (label, value, sub = '', tone = '') =>
    `<div class="kpi ${tone}"><span class="kpi-l">${label}</span><span class="kpi-v">${value}</span>${sub ? `<span class="kpi-s">${sub}</span>` : ''}</div>`;
  R.kpis = (arr, cols = 2) => `<div class="kpis k${cols}">${arr.join('')}</div>`;
  R.dl = (rows) => `<dl class="dl">${rows.filter((r) => r && r[1] != null && r[1] !== '' && r[1] !== '—').map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  R.link = (href, label, cls = 'lnk') => `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">${label}<span class="ext" aria-hidden="true">↗</span></a>`;
  R.chip = (txt, tone = '') => `<span class="chip-s ${tone}">${txt}</span>`;
  R.note = (html, tone = '') => `<div class="note ${tone}">${html}</div>`;
  R.tip = (html) => `<div class="tip"><span aria-hidden="true">💡</span><div>${html}</div></div>`;
  R.row = (it, extra = '') => {
    const c = SA.CATS[it.cat];
    return `<li class="row" data-id="${esc(it.id)}" tabindex="0" role="button">
      <span class="row-dot" style="--c:${c.color}">${c.icon}</span>
      <span class="row-main"><b>${esc(it.name)}</b><small>${esc(it.subLabel)}${extra}</small></span>
      <span class="row-dist">${U.dist(it.dist)}<small>${U.walk(it.dist)}</small></span></li>`;
  };
  R.bars = (rows) => `<ul class="hbars">${rows.map((r) => `<li><span class="hb-l">${r.label}</span><span class="bar"><i style="width:${Math.max(0, Math.min(100, r.pct))}%;${r.color ? `background:${r.color}` : ''}"></i></span><small>${r.val}</small></li>`).join('')}</ul>`;

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
      census: 'https://census.cbs.gov.il/',
      datagov: 'https://data.gov.il/',
      iplan: 'https://www.gov.il/he/departments/iplan',
      edu: 'https://shkifut.education.gov.il/',
      iaa: 'https://www.iaa-archaeology.org.il/',
      muniGis: `https://www.google.com/search?q=${encodeURIComponent('GIS הנדסה מידע תכנוני ' + (s.city || ''))}`,
      taGis: 'https://gisn.tel-aviv.gov.il/iview2js4/index.aspx',
      history: `https://www.google.com/search?q=${encodeURIComponent('היסטוריה ' + [s.address && s.address.neighbourhood, s.city].filter(Boolean).join(' '))}`,
      aerial: `https://www.govmap.gov.il/?c=${itm.x},${itm.y}&z=10&b=2`
    };
  };

  /* =========================================================
     עזרי חישוב משותפים
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
  const nearest = (S, fn) => (S.poi ? S.poi.items.find(fn) : null);
  const railOf = (S) => nearest(S, (i) => /station|halt|light_rail|tram_stop/.test(i.sub));
  const slopeWord = (p) => (p < 2 ? 'מישורי' : p < 5 ? 'מתון מאוד' : p < 10 ? 'מתון' : p < 20 ? 'בינוני–תלול' : 'תלול');
  const siteElev = (S) => (S.contours && S.contours.site != null ? S.contours.site : S.elev ? S.elev.elevation : null);
  const siteLanduse = (S) => S.pdetail && S.pdetail.landuse.find((u) => u.dist === 0);

  /* =========================================================
     SWOT אוטומטי
     ========================================================= */
  R.swot = (S) => {
    const s = [], w = [], o = [], t = [];
    if (S.poi) {
      const it = S.poi.items;
      const bus = it.filter((i) => i.sub === 'bus_stop' && i.dist <= 400).length;
      const rail = railOf(S);
      const park = it.find((i) => /park|garden/.test(i.sub));
      const sc = R.score(it).score;
      if (bus >= 3) s.push(`${bus} תחנות אוטובוס במרחק הליכה (עד 400 מ׳)`); else if (bus === 0) w.push('אין תחנת אוטובוס ב-400 מ׳');
      if (rail && rail.dist <= 1000) s.push(`${rail.subLabel} במרחק ${U.dist(rail.dist)}`);
      if (park && park.dist <= 300) s.push(`שטח ירוק קרוב (${U.dist(park.dist)})`); else if (!park || park.dist > 600) w.push('מחסור בשטחים ירוקים קרובים');
      if (sc >= 70) s.push(`נגישות גבוהה לשירותים (ציון ${sc})`); else if (sc < 45) w.push(`נגישות נמוכה לשירותים (ציון ${sc})`);
      if (!it.find((i) => i.sub === 'school' && i.dist <= 800)) w.push('אין בית ספר במרחק 800 מ׳');
    }
    if (S.env) {
      const e = S.env;
      if (isFinite(e.coastDist) && e.coastDist < 1500) s.push(`קרבה לים (${U.dist(e.coastDist)}) — פוטנציאל נוף ובריזה`);
      if (e.coastDist < 300) t.push('בתחום הסביבה החופית — מגבלות בנייה (חוק החופים)');
      if (e.noise.level === 2) t.push(`חשיפה לרעש: ${e.noise.sources[0].label} במרחק ${U.dist(e.noise.sources[0].d)}`);
      else if (e.noise.level === 0) s.push('סביבה שקטה יחסית (רחוקה מכבישים ראשיים ומסילות)');
      if (e.riverDist < 200) t.push(`ערוץ זרימה במרחק ${U.dist(e.riverDist)} — לבדוק סיכון הצפה`);
      if (e.cycleKm > 1) s.push(`${U.num(e.cycleKm, 1)} ק"מ שבילי אופניים בסביבה`);
    }
    if (S.contours && S.contours.slopeMean != null) {
      if (S.contours.slopeMean > 12) t.push(`טופוגרפיה תלולה (שיפוע ממוצע ${U.num(S.contours.slopeMean, 0)}%) — עלויות פיתוח`);
      if (S.contours.slopeMean > 6) o.push('הפרשי גובה — הזדמנות למפלסים, מבטים ומרתפים חשופים');
    }
    if (S.fabric) {
      const m = S.fabric.morph;
      if (m.coverage > 0.45) w.push(`מרקם צפוף (תכסית ${U.num(m.coverage * 100, 0)}%) — מעט מרחב פתוח`);
      if (m.coverage < 0.2 && m.count) o.push('מרקם דליל — פוטנציאל לציפוף והתחדשות');
      if (S.fabric.heritage.filter((h) => h.heritage && h.dist < 300).length) t.push('אתרי מורשת / שימור בקרבת האתר — מגבלות עיצוב');
      if (S.fabric.heritage.filter((h) => h.heritage).length) o.push('ערכי מורשת בסביבה — עוגן לזהות המקום');
    }
    if (S.plans) {
      const dep = S.plans.nearby.filter((p) => SA.api.planStatusClass(p.status) === 'warn');
      if (dep.length) o.push(`${dep.length} תכניות בהליך בסביבה — שינוי צפוי באזור`);
    }
    const lu = siteLanduse(S);
    if (lu) o.push(`ייעוד הקרקע באתר: ${lu.designation}`);
    if (S.pdetail && S.pdetail.landuse.some((u) => u.open && u.dist < 150)) s.push('שצ״פ סטטוטורי צמוד לאתר');
    if (S.ages && S.ages.kids != null && S.ages.kids > 38) o.push('שיעור ילדים גבוה — ביקוש למבני חינוך ומשחק');
    if (S.ages && S.ages.seniors != null && S.ages.seniors > 18) o.push('שיעור מבוגרים גבוה — נגישות ושירותים לגיל השלישי');
    return { s, w, o, t };
  };

  /* =========================================================
     1. סיכום
     ========================================================= */
  R.overview = (S) => {
    const st = S.status;
    const v = (key, fn) => (st[key] === 'ok' ? fn() : st[key] === 'error' ? '—' : '<span class="sk sk-inline"></span>');
    const rail = railOf(S);
    const plans = S.plans && S.plans.atSite;
    const lu = siteLanduse(S);
    const el = siteElev(S);
    const kpis = R.kpis([
      R.kpi('גוש / חלקה', v('parcel', () => `${esc(S.parcel.gush ?? '?')} / ${esc(S.parcel.helka ?? '?')}`), S.lot ? `${U.int(S.lot.area)} מ"ר · חזית ${U.num(S.lot.frontage, 0)} מ׳` : ''),
      R.kpi('תב״ע', v('plans', () => (plans[0] ? esc(plans[0].number) : 'לא אותרה')), lu ? esc(lu.designation) : plans && plans[0] ? esc(plans[0].status || '') : ''),
      R.kpi('תחב״צ', v('poi', () => `${S.poi.items.filter((i) => i.sub === 'bus_stop' && i.dist <= 400).length} תחנות`), rail ? `${esc(rail.subLabel)} · ${U.dist(rail.dist)}` : 'עד 400 מ׳'),
      R.kpi('נגישות לשירותים', v('poi', () => `${R.score(S.poi.items).score}<small>/100</small>`), 'ציון הליכתיות'),
      R.kpi('גובה ושיפוע', el != null ? `${U.int(el)} מ׳` : v('elev', () => '—'), S.contours && S.contours.slopeMean != null ? `שיפוע ממוצע ${U.num(S.contours.slopeMean, 1)}%` : ''),
      R.kpi('רוח שולטת', v('climate', () => U.dir8(S.climate.prevailing)), S.climate ? `${U.num(S.climate.meanSpeed, 1)} מ/ש` : ''),
      R.kpi('רעש', v('env', () => S.env.noise.label), S.env && S.env.noise.sources[0] ? esc(S.env.noise.sources[0].label) : '', S.env && S.env.noise.level === 2 ? 'alert' : ''),
      R.kpi('מרקם', v('fabric', () => `${U.num(S.fabric.morph.coverage * 100, 0)}% תכסית`), S.fabric && S.fabric.morph.avgLevels ? `ממוצע ${U.num(S.fabric.morph.avgLevels, 1)} קומות` : '')
    ]);

    const sw = R.swot(S);
    const q = (title, cls, list) => `<div class="swot-q ${cls}"><h4>${title}</h4>${list.length ? `<ul>${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted small">ממתין לנתונים / אין ממצאים</p>'}</div>`;
    const swot = `<div class="swot">${q('חוזקות', 'qs', sw.s)}${q('חולשות', 'qw', sw.w)}${q('הזדמנויות', 'qo', sw.o)}${q('איומים', 'qt', sw.t)}</div>
      <p class="muted small">נגזר אוטומטית מהנתונים — נקודת פתיחה לדיון, לא מסקנה. הוסיפו תובנות מהסיור באתר בהערות.</p>`;

    // מפת הניתוח — כל הנושאים עם מצב מוכנות
    const ready = (keys) => (keys.some((k) => st[k] === 'loading') ? 'loading' : keys.every((k) => st[k] === 'error') ? 'error' : keys.some((k) => st[k] === 'error') ? 'partial' : 'ok');
    const topics = [
      ['lot', 'מגרש וקווי בניין', ['parcel', 'lot']], ['planning', 'תכנון סטטוטורי', ['plans', 'pdetail']],
      ['topo', 'טופוגרפיה ומים', ['contours', 'env']], ['climate', 'שמש, רוח ואקלים', ['climate']],
      ['transport', 'תנועה ונגישות', ['poi', 'env']], ['services', 'שירותים וירוק', ['poi']],
      ['fabric', 'מרקם ומורשת', ['fabric']], ['population', 'אוכלוסייה וגילאים', ['pop', 'ages']]
    ];
    const grid = `<div class="topic-grid">${topics.map(([k, l, keys]) => `<button class="topic t-${ready(keys)}" data-goto="${k}"><span class="tdot"></span>${l}</button>`).join('')}</div>
      <h4>עבודת שטח והשלמות</h4>
      <ul class="todo">
        <li><span>📷</span><div><b>סיור וצילום</b> — חזיתות, רחוב, מבטים מהאתר ואליו, חומרים ואופי בנייה.</div></li>
        <li><span>📜</span><div><b>היסטוריה והתפתחות</b> — תצלומי אוויר היסטוריים, שלבי בנייה, אירועים. ${R.link(R.links(S).aerial, 'תצ״א ב-GovMap')}</div></li>
        <li><span>🔊</span><div><b>חוויית המקום</b> — רעש בפועל, תנועת הולכי רגל בשעות שונות, צל ושמש.</div></li>
        <li><span>👥</span><div><b>משתמשים</b> — מי משתמש במקום, צרכים, ראיונות קצרים.</div></li>
      </ul>`;

    const L = R.links(S);
    const notes = `<textarea class="notes" data-notes rows="5" placeholder="רשמו כאן תובנות, רעיונות וממצאים מהסיור… (נשמר בדפדפן לכתובת הזו)">${esc(S.notes || '')}</textarea>`;
    const quick = `<div class="quick">${R.link(L.govmap, 'GovMap', 'qbtn')}${R.link(L.mavat, 'מבא״ת', 'qbtn')}${R.link(L.streetview, 'Street View', 'qbtn')}${R.link(L.nadlan, 'עסקאות נדל״ן', 'qbtn')}${R.link(L.osm, 'OSM', 'qbtn')}</div>`;

    return kpis +
      R.card('SWOT — חוזקות, חולשות, הזדמנויות ואיומים', swot, { icon: '◈' }) +
      R.card('מפת הניתוח', grid, { icon: '◎', sub: 'לחצו על נושא כדי לעבור אליו' }) +
      R.card('הערות שלי', notes, { icon: '✎' }) +
      R.card('קישורים מהירים', quick, { icon: '↗' });
  };

  /* =========================================================
     2. מגרש
     ========================================================= */
  const KIND = { front: 'חזית', side: 'צד', rear: 'אחור' };
  R.lot = (S) => {
    const L = R.links(S);
    const parcel = R.state(S, 'parcel', () => {
      const p = S.parcel;
      return `<div class="parcel-big"><div><span>גוש</span><b>${esc(p.gush ?? '—')}</b></div><div><span>חלקה</span><b>${esc(p.helka ?? '—')}</b></div>${p.area ? `<div><span>שטח רשום</span><b>${U.int(p.area)}<small> מ"ר</small></b></div>` : ''}</div>
        ${R.dl([['סטטוס', esc(p.status || '')], ['יישוב', esc(p.locality || '')]])}
        <div class="quick">${R.link(L.govmapParcel, 'GovMap', 'qbtn')}<button class="qbtn" data-copy="גוש ${esc(p.gush)} חלקה ${esc(p.helka)}">העתקה</button><button class="qbtn" data-act="fitParcel">התמקדות במפה</button></div>
        <details class="raw"><summary>כל השדות</summary>${R.dl(Object.entries(p.raw || {}).filter(([, v]) => v != null && typeof v !== 'object').map(([k, v]) => [esc(k), esc(v)]))}</details>`;
    }, `<div class="quick">${R.link(L.govmapParcel, 'חיפוש גוש/חלקה ב-GovMap', 'qbtn')}</div>`);

    const lotBody = S.status.parcel === 'error' ? R.note('גבול המגרש מחושב מגבול החלקה — יופיע כשנתוני הגוש/חלקה ייטענו.')
      : R.state(S, 'lot', () => {
        const lot = S.lot, pd = S.pdetail;
        const planLot = pd && pd.lots.find((l) => l.contains);
        const edges = lot.edgesLL.map((e, i) => `<tr><td>${i + 1}</td><td><span class="kind kind-${e.kind}">${KIND[e.kind]}</span></td><td>${U.num(e.len, 1)} מ׳</td><td>${esc(e.street || '')}</td></tr>`).join('');
        return R.kpis([
          R.kpi('שטח מחושב', `${U.int(lot.area)} מ"ר`, S.parcel && S.parcel.area ? `רשום: ${U.int(S.parcel.area)} מ"ר` : ''),
          R.kpi('חזית לרחוב', `${U.num(lot.frontage, 1)} מ׳`, lot.frontStreet ? 'רח׳ ' + esc(lot.frontStreet) : ''),
          R.kpi('היקף', `${U.num(lot.perimeter, 1)} מ׳`),
          R.kpi('יחס עומק/חזית', lot.frontage ? U.num(lot.area / lot.frontage / lot.frontage, 2) : '—', 'צורת המגרש')
        ]) + (planLot ? R.note(`נמצא גם <b>מגרש לפי התכנית</b>${planLot.number ? ` (${esc(planLot.number)})` : ''} — בקו חום מקווקו במפה.`, 'ok') : '') +
          `<details class="raw"><summary>מידות כל הצלעות (${lot.edgesLL.length})</summary><table class="tbl"><thead><tr><th>#</th><th>סוג</th><th>אורך</th><th>רחוב</th></tr></thead><tbody>${edges}</tbody></table></details>`;
      });

    let setback = '';
    if (S.lot) {
      const pd = S.pdetail, sb = S.setbacks;
      const official = pd && pd.lines.length;
      setback = (official ? R.note(`נמצאו ${pd.lines.length} קווי בניין בשכבת "${esc(pd.searched.lines.join(', '))}" — בקו אדום רציף במפה.`, 'ok')
        : R.note('לא נמצאה שכבת קווי בניין פתוחה. הזינו מרווחים מהוראות התב״ע או מתיק המידע — המעטפת תחושב ותוצג במפה.')) +
        `<div class="sb-grid">
          <label>קדמי<input type="number" inputmode="decimal" min="0" step="0.5" data-sb="front" value="${sb.front}"><small>מ׳</small></label>
          <label>צדדי<input type="number" inputmode="decimal" min="0" step="0.5" data-sb="side" value="${sb.side}"><small>מ׳</small></label>
          <label>אחורי<input type="number" inputmode="decimal" min="0" step="0.5" data-sb="rear" value="${sb.rear}"><small>מ׳</small></label>
          <label>קומות<input type="number" inputmode="numeric" min="1" step="1" data-sb="floors" value="${sb.floors}"><small>&nbsp;</small></label>
          <label>תכסית<input type="number" inputmode="numeric" min="0" max="100" step="1" data-sb="coverage" value="${sb.coverage}" placeholder="—"><small>% מרבי</small></label>
        </div>
        <div id="envKpis">${R.envKpis(S)}</div>` +
        R.tip('החזית מזוהה לפי הרחוב הקרוב ביותר (OSM), האחורית — הצלע שמולה, והשאר צדדיות. הקובע הוא התב״ע, תיק המידע וההנחיות המרחביות.');
    }

    return R.card('גוש וחלקה', parcel, { icon: '▱', status: S.status.parcel }) +
      R.card('גבול המגרש', lotBody, { icon: '📐', status: S.status.lot, sub: 'מידות הצלעות והחזית מסומנות על המפה' }) +
      (setback ? R.card('קווי בניין ומעטפת', setback, { icon: '▣', sub: 'שטח הבנייה האפשרי לפי מרווחים' }) : '');
  };
  R.envKpis = (S) => {
    const env = S.envelope, sb = S.setbacks, lot = S.lot;
    if (!env) return R.kpis([`<div class="kpi alert" style="grid-column:1/-1"><span class="kpi-l">שטח בין קווי הבניין</span><span class="kpi-v">—</span><span class="kpi-s">המרווחים גדולים מדי למגרש, או שצורתו מורכבת</span></div>`]);
    const cap = sb.coverage ? (lot.area * sb.coverage) / 100 : Infinity;
    const fp = Math.min(env.area, cap);
    return R.kpis([
      R.kpi('שטח בין קווי הבניין', `${U.int(env.area)} מ"ר`, `${U.num((env.area / lot.area) * 100, 0)}% מהמגרש`),
      R.kpi('תכסית לחישוב', `${U.int(fp)} מ"ר`, isFinite(cap) && cap < env.area ? `מוגבל ל-${sb.coverage}% תכסית` : 'לפי קווי הבניין'),
      R.kpi(`שטח ברוטו (${sb.floors} קומות)`, `${U.int(fp * sb.floors)} מ"ר`, `רח״ק ≈ ${U.num((fp * sb.floors) / lot.area, 2)}`)
    ], 3);
  };

  /* =========================================================
     3. תכנון
     ========================================================= */
  function planCard(p, primary) {
    const cls = SA.api.planStatusClass(p.status);
    const rows = [
      ['שם', esc(p.name || '')], ['סוג', esc(p.type || '')], ['סמכות', esc(p.authority || '')],
      ['מרחב תכנון', esc(p.county || '')], ['שטח', p.area ? `${U.num(p.area, 1)} דונם` : ''], ['תאריך', esc(p.date || '')],
      ['ייעודי קרקע', esc(p.landuse || '')], ['מטרות', esc(p.objectives || '')]
    ];
    const raw = Object.entries(p.raw || {}).filter(([, v]) => v != null && v !== '' && v !== 'Null' && typeof v !== 'object');
    return `<div class="plan ${primary ? 'primary' : ''}">
      <div class="plan-h"><span class="plan-no">${esc(p.number)}</span>${p.status ? R.chip(esc(p.status), cls) : ''}</div>
      ${R.dl(rows)}
      <div class="quick">${p.url ? R.link(p.url, 'מסמכי התכנית', 'qbtn primary') : ''}<button class="qbtn" data-copy="${esc(p.number)}" data-open="https://mavat.iplan.gov.il/SV3">חיפוש במבא״ת</button></div>
      <details class="raw"><summary>כל השדות (${raw.length})</summary>${R.dl(raw.map(([k, v]) => [esc(p.aliases[k] || k), esc(v)]))}</details></div>`;
  }

  R.planning = (S) => {
    const L = R.links(S);
    const plans = R.state(S, 'plans', () => {
      const { atSite, nearby, others } = S.plans;
      let h = atSite.length ? atSite.map((p, i) => planCard(p, i === 0)).join('')
        : R.note('לא אותרו תכניות החלות על הנקודה עצמה. בדקו את התכניות בסביבה ואת שכבת "קווים כחולים" במפה.');
      if (nearby.length)
        h += `<details class="nearby" ${atSite.length ? '' : 'open'}><summary>תכניות נוספות ברדיוס (${nearby.length})</summary><ul class="plan-list">${nearby.slice(0, 60).map((p) =>
          `<li><span class="pn">${esc(p.number)}</span><span class="pname">${esc(p.name || '')}</span>${p.status ? R.chip(esc(p.status), SA.api.planStatusClass(p.status)) : ''}</li>`).join('')}</ul></details>`;
      if (others.length)
        h += `<details class="raw"><summary>שכבות נוספות בנקודה (${others.length})</summary>${others.map((o) => `<h4>${esc(o.layer)}</h4>${R.dl(Object.entries(o.attrs).filter(([, v]) => v != null && v !== '' && v !== 'Null').slice(0, 14).map(([k, v]) => [esc(o.aliases[k] || k), esc(v)]))}`).join('')}</details>`;
      return h;
    }, `<div class="quick">${R.link(L.mavat, 'מבא״ת', 'qbtn')}${R.link(L.govmap, 'GovMap', 'qbtn')}</div>`);

    const osmMix = () => {
      if (!S.fabric || !S.fabric.landuseMix.length) return '';
      const tot = S.fabric.landuseMix.reduce((s, [, a]) => s + a, 0);
      return `<h4>שימושי קרקע בפועל (OSM, 500 מ׳)</h4>` + R.bars(S.fabric.landuseMix.slice(0, 7).map(([k, a]) => {
        const c = SA.OSM_LU[k] || ['#cbd5e1', k];
        return { label: `<i class="lu-sw" style="background:${c[0]}"></i>${c[1]}`, pct: (a / tot) * 100, val: `${U.num((a / tot) * 100, 0)}%`, color: c[0] };
      }));
    };
    const lu = R.state(S, 'pdetail', () => {
      const pd = S.pdetail;
      if (!pd.landuse.length)
        return R.note(`לא נמצאה שכבת ייעודי קרקע פתוחה לאזור זה (נסרקו ${pd.layerCount} שכבות). הייעודים מופיעים בתשריט התב״ע במבא״ת.`) + osmMix();
      const site = siteLanduse(S);
      const opens = pd.landuse.filter((u) => u.open);
      const groups = {};
      pd.landuse.forEach((u) => { (groups[u.group] = groups[u.group] || { area: 0, color: u.color }).area += u.area; });
      const tot = Object.values(groups).reduce((s, g) => s + g.area, 0);
      return `${site ? `<div class="lu-site"><span class="lu-sw" style="background:${site.color}"></span><div><small>ייעוד הקרקע באתר</small><b>${esc(site.designation)}</b></div></div>` : ''}` +
        R.kpis([
          R.kpi('שצ״פ ב-300 מ׳', opens.length ? `${U.num(opens.reduce((s, u) => s + u.area, 0) / 1000, 1)} ד׳` : '0', `${opens.length} שטחים`),
          R.kpi('שצ״פ קרוב', opens.length ? U.dist(Math.min(...opens.map((u) => u.dist))) : '—'),
          R.kpi('ייעודים', Object.keys(groups).length)
        ], 3) +
        `<h4>תמהיל ייעודים (תכנון)</h4>` + R.bars(Object.entries(groups).sort((a, b) => b[1].area - a[1].area).map(([g, v]) => ({ label: `<i class="lu-sw" style="background:${v.color}"></i>${g}`, pct: (v.area / tot) * 100, val: `${U.num((v.area / tot) * 100, 0)}%`, color: v.color }))) +
        (opens.length ? `<h4>שצ״פים קרובים</h4><ul class="simple">${opens.slice(0, 6).map((u) => `<li><i class="lu-sw" style="background:#22c55e"></i><span>${esc(u.designation)}<small> · ${U.int(u.area)} מ"ר</small></span><b>${u.dist === 0 ? 'באתר' : U.dist(u.dist)}</b></li>`).join('')}</ul>` : '') +
        `<p class="muted small">מקור: ${esc(pd.searched.landuse.join(', '))}.</p>`;
    }, osmMix());

    let permits = '';
    if (S.permits && S.permits.length)
      permits = R.card(`היתרי בנייה בסביבה (${S.permits.length})`, `<p class="muted small">GIS עיריית תל אביב-יפו, רדיוס ~120 מ׳.</p>${S.permits.slice(0, 15).map((p) =>
        `<details class="raw"><summary>${esc(Object.values(p.attrs).find((v) => typeof v === 'string' && v.length > 3) || p.layer)}</summary>${R.dl(Object.entries(p.attrs).filter(([, v]) => v != null && v !== '').slice(0, 14).map(([k, v]) => [esc(p.aliases[k] || k), esc(typeof v === 'number' && v > 1e11 ? new Date(v).toLocaleDateString('he-IL') : v)]))}</details>`).join('')}`, { icon: '🏗' });

    const docs = `<ul class="todo">
      <li><span>1</span><div><b>תיק מידע להיתר</b> — מהוועדה המקומית: זכויות, קווי בניין, הנחיות מרחביות.</div></li>
      <li><span>2</span><div><b>הוראות התכנית + תשריט</b> — במבא״ת: ייעוד, אחוזי בנייה, קומות, תכסית.</div></li>
      <li><span>3</span><div><b>נספחי בינוי, תנועה וסביבה</b> — אם קיימים בתכנית.</div></li>
      <li><span>4</span><div><b>תכניות ארציות ומחוזיות</b> — תמ״א 35, תמ״א 38 / תכנית ההתחדשות, תמ״א 13 (חופים), תמ״מ.</div></li>
      <li><span>5</span><div><b>היתרים קודמים</b> — בארכיון ההנדסה של הרשות.</div></li>
      <li><span>6</span><div><b>תכנית מתאר כוללנית והנחיות מרחביות</b> — של הרשות המקומית.</div></li></ul>
      <div class="quick">${R.link(L.muniGis, `GIS הנדסה — ${esc(S.city || 'הרשות')}`, 'qbtn')}${/תל.?אביב/.test(S.city || '') ? R.link(L.taGis, 'GIS תל אביב', 'qbtn') : ''}${R.link(L.mavat, 'מבא״ת', 'qbtn')}</div>`;

    return R.card('תב״ע — תכניות החלות על האתר', plans, { icon: '▦', status: S.status.plans }) +
      R.card('ייעודי קרקע ושצ״פ', lu, { icon: '▩', status: S.status.pdetail, sub: 'צבעי הייעודים מוסברים במקרא המפה' }) +
      permits +
      R.card('מסמכים לאסוף', docs, { icon: '🗂' });
  };

  /* =========================================================
     4. טופוגרפיה ומים
     ========================================================= */
  R.topo = (S) => {
    const main = R.state(S, 'contours', () => {
      const c = S.contours;
      const range = c.spots.hi && c.spots.lo ? c.spots.hi.v - c.spots.lo.v : c.max - c.min;
      const aspect = S.elev ? S.elev.aspect : null;
      return R.kpis([
        R.kpi('גובה האתר', `${U.int(c.site)} מ׳`, 'מעל פני הים'),
        R.kpi('שיפוע ממוצע', `${U.num(c.slopeMean, 1)}%`, slopeWord(c.slopeMean) + ` · ברדיוס ${S.r} מ׳`),
        R.kpi('הפרש גבהים', `${U.int(range)} מ׳`, c.spots.hi ? `${U.int(c.spots.lo.v)}–${U.int(c.spots.hi.v)} מ׳` : ''),
        R.kpi('מפנה (כיוון השיפוע)', aspect != null ? U.dir8(aspect) : '—', aspect != null ? `${Math.round(aspect)}° · ${S.elev.slopePct < 2 ? 'כמעט מישורי' : 'שיפוע ' + U.num(S.elev.slopePct, 1) + '% באתר'}` : '')
      ]) + R.kpis([
        R.kpi('שטח תלול (>10%)', `${U.num(c.steepShare * 100, 0)}%`, 'מהשטח ברדיוס'),
        R.kpi('קווי גובה', `כל ${c.interval} מ׳`, `קו ראשי כל ${c.major} מ׳`)
      ]);
    });
    const sections = S.contours && S.sections
      ? S.sections.map((s) => `<div class="chart-box">${SA.charts.profile(s.prof, s.labels)}</div>`).join('') +
        R.tip('הקווים A–A׳ (מערב–מזרח) ו-B–B׳ (דרום–צפון) מסומנים במפה. ההגזמה האנכית מדגישה את הפרשי הגובה.')
      : '';

    const water = R.state(S, 'env', () => {
      const e = S.env;
      let zone = '';
      if (e.coastDist < 100) zone = R.note('בתוך 100 מ׳ מקו החוף — <b>תחום חוף הים</b>: בנייה אסורה ככלל.', 'bad');
      else if (e.coastDist < 300) zone = R.note('בתוך 300 מ׳ מקו החוף — <b>סביבה חופית</b>: נדרש אישור הוועדה לשמירת הסביבה החופית (ולחו״ף).', 'warn');
      const river = e.rivers.slice().sort((a, b) => a.dist - b.dist)[0];
      const wb = e.water.slice().sort((a, b) => a.dist - b.dist)[0];
      return R.kpis([
        R.kpi('קו החוף', isFinite(e.coastDist) ? U.dist(e.coastDist) : 'מעל 5 ק"מ', '', e.coastDist < 300 ? 'alert' : ''),
        R.kpi('נחל / ערוץ', river ? U.dist(river.dist) : 'מעל 1.5 ק"מ', river ? esc(river.name) : ''),
        R.kpi('גוף מים', wb ? U.dist(wb.dist) : 'מעל 1.5 ק"מ', wb ? esc(wb.name) : '')
      ], 3) + zone;
    });

    const design = S.contours ? R.tip(
      S.contours.slopeMean < 3 ? 'שטח מישורי: לתכנן ניקוז עילי ושיפועים מינימליים (1–2%) והתאמה לגובה הרחוב.'
        : S.contours.slopeMean < 10 ? 'שיפוע מתון: אפשר לתכנן מפלסים מדורגים קלים, כניסה מהצד הגבוה וניצול הפרש למרתף חלקי.'
          : 'שיפוע משמעותי: לשקול טרסות, מבנה מדורג לפי קווי הגובה, וקירות תומכים. הצד הנמוך — פוטנציאל לחזית פתוחה ונוף.') : '';

    return R.card('תבליט ושיפועים', main + design, { icon: '⛰', status: S.status.contours, sub: 'מבוסס על מודל גבהים (~30 מ׳)' }) +
      (sections ? R.card('חתכים טופוגרפיים', sections, { icon: '⟋' }) : '') +
      R.card('קו המים ומים עיליים', water, { icon: '🌊', status: S.status.env }) +
      R.card('איך לקרוא את המפה', R.legendText('topo', S), { icon: '?', cls: 'explain' });
  };

  /* =========================================================
     5. אקלים
     ========================================================= */
  R.climate = (S) => {
    const sun = S.sun;
    const sunHtml = `<div class="chart-box sq">${SA.charts.sunPath(S.lat, S.lon, sun)}</div>
      <div class="legend-row"><span><i class="lg-summer"></i>קיץ</span><span><i class="lg-equinox"></i>שוויון</span><span><i class="lg-winter"></i>חורף</span><span><i class="lg-now"></i>עכשיו</span></div>
      <table class="tbl"><thead><tr><th></th>${sun.map((d) => `<th>${d.label.split('·')[0]}</th>`).join('')}</tr></thead><tbody>
        <tr><th>זריחה</th>${sun.map((d) => `<td>${U.time(d.sunrise)}</td>`).join('')}</tr>
        <tr><th>שקיעה</th>${sun.map((d) => `<td>${U.time(d.sunset)}</td>`).join('')}</tr>
        <tr><th>אורך יום</th>${sun.map((d) => `<td>${U.num(d.dayLength, 1)} ש׳</td>`).join('')}</tr>
        <tr><th>גובה בצהריים</th>${sun.map((d) => `<td>${Math.round(d.noonAlt)}°</td>`).join('')}</tr>
        <tr><th>כיוון זריחה</th>${sun.map((d) => `<td>${Math.round(d.riseAz)}°</td>`).join('')}</tr>
        <tr><th>כיוון שקיעה</th>${sun.map((d) => `<td>${Math.round(d.setAz)}°</td>`).join('')}</tr></tbody></table>` +
      R.tip(`<b>חזית דרום:</b> הצללה אופקית (בקיץ השמש גבוהה — ${Math.round(sun[0].noonAlt)}°, בחורף נמוכה — ${Math.round(sun[2].noonAlt)}° ונכנסת פנימה). <b>מזרח ומערב:</b> הצללה אנכית / תריסים — שמש נמוכה וחזקה. <b>צפון:</b> אור עקיף ויציב.`);

    const wind = R.state(S, 'climate', () => {
      const c = S.climate;
      return `<div class="chart-box sq">${SA.charts.windRose(c)}</div>
        <div class="legend-row"><span><i class="wbin-0"></i>&lt;2 מ/ש</span><span><i class="wbin-1"></i>2–4</span><span><i class="wbin-2"></i>4–6</span><span><i class="wbin-3"></i>&gt;6</span></div>` +
        R.kpis([R.kpi('רוח שולטת', U.dir8(c.prevailing), `${Math.round(c.prevailing)}°`), R.kpi('מהירות ממוצעת', `${U.num(c.meanSpeed, 1)} מ/ש`), R.kpi('שעות שקט', `${U.num(c.calm, 0)}%`)], 3) +
        R.tip(`לאוורור טבעי: פתחים בחזית ה${U.dir8(c.prevailing)}ית ופתחי יציאה בצד הנגדי (אוורור מפולש). שושנת הרוחות מראה <b>מאיפה</b> הרוח נושבת — ככל שהעלה ארוך יותר, הרוח מהכיוון הזה שכיחה יותר.`);
    });
    const clim = R.state(S, 'climate', () => {
      const c = S.climate;
      return `<div class="chart-box">${SA.charts.climate(c.monthly)}</div>
        <div class="legend-row"><span><i class="lg-tmax"></i>מקסימום</span><span><i class="lg-tmin"></i>מינימום</span><span><i class="lg-rain"></i>משקעים</span></div>` +
        R.kpis([R.kpi('משקעים בשנה', `${U.int(c.annualRain)} מ"מ`), R.kpi('החודש החם', `${U.num(Math.max(...c.monthly.map((m) => m.tmax)), 0)}°`), R.kpi('החודש הקר', `${U.num(Math.min(...c.monthly.map((m) => m.tmin)), 0)}°`)], 3) +
        `<p class="muted small">ERA5 דרך Open-Meteo · שנת ${c.year}.</p>`;
    });
    return R.card('מסלול השמש', sunHtml, { icon: '☀', sub: 'כיווני הזריחה והשקיעה מסומנים על המפה' }) +
      R.card('משטר רוחות', wind, { icon: '🌬', status: S.status.climate, sub: 'חץ הרוח השולטת מסומן על המפה' }) +
      R.card('טמפרטורות ומשקעים', clim, { icon: '🌡', status: S.status.climate });
  };

  /* =========================================================
     6. תנועה
     ========================================================= */
  R.transport = (S) => {
    const L = R.links(S);
    const pt = R.state(S, 'poi', () => {
      const items = S.poi.items.filter((i) => i.cat === 'transit');
      const rail = items.filter((i) => /station|halt|light_rail|tram_stop/.test(i.sub)).slice(0, 5);
      const bus = items.filter((i) => i.sub === 'bus_stop');
      const lines = new Set();
      bus.filter((b) => b.dist <= 500).forEach((b) => b.routes.split(/[;,]/).map((x) => x.trim()).filter(Boolean).forEach((x) => lines.add(x)));
      return R.kpis([
        R.kpi('תחנות ≤400 מ׳', bus.filter((b) => b.dist <= 400).length),
        R.kpi('קווים ≤500 מ׳', lines.size || '—', lines.size ? '' : 'אין נתוני קווים'),
        R.kpi('רכבת / רק״ל', rail[0] ? U.dist(rail[0].dist) : '—', rail[0] ? esc(rail[0].name) : 'מעל 2.5 ק"מ')
      ], 3) +
        (rail.length ? `<h4>רכבת ורכבת קלה</h4><ul class="rows">${rail.map((r) => R.row(r)).join('')}</ul>` : '') +
        `<h4>תחנות אוטובוס קרובות</h4>${bus.length ? `<ul class="rows">${bus.slice(0, 8).map((b) => R.row(b, b.routes ? ` · קווים ${esc(b.routes)}` : '')).join('')}</ul>` : '<p class="muted">לא נמצאו תחנות ברדיוס</p>'}` +
        (lines.size ? `<div class="lines">${[...lines].sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b)).slice(0, 60).map((l) => `<span class="line-chip">${esc(l)}</span>`).join('')}</div>` : '');
    });

    const cls = { motorway: 'כביש מהיר', trunk: 'דרך ראשית', primary: 'עורק ראשי', secondary: 'עורק משני' };
    const roads = R.state(S, 'env', () => {
      const e = S.env;
      return `${e.roadGroups.length ? `<ul class="simple">${e.roadGroups.slice(0, 7).map((r) =>
        `<li><span class="road road-${r.cls}">${esc(r.ref || '—')}</span><span>${esc(r.name || cls[r.cls])}<small> · ${cls[r.cls]}</small></span><b>${U.dist(r.dist)}</b></li>`).join('')}</ul>` : '<p class="muted">אין דרכים עיקריות ב-1 ק"מ</p>'}
        ${e.junctions.length ? `<h4>מחלפים</h4><ul class="simple">${e.junctions.slice(0, 4).map((j) => `<li><span class="road road-motorway">${esc(j.ref || 'מחלף')}</span><span>${esc(j.name)}</span><b>${U.dist(j.dist)}</b></li>`).join('')}</ul>` : ''}`;
    });
    const soft = R.state(S, 'env', () => {
      const e = S.env;
      const bikes = S.poi ? S.poi.items.filter((i) => i.sub === 'bicycle_rental') : [];
      return R.kpis([R.kpi('שבילי אופניים', `${U.num(e.cycleKm, 1)} ק"מ`, 'ברדיוס 800 מ׳'), R.kpi('תחנות אופניים', S.poi ? bikes.length : '—'), R.kpi('טווח הליכה', S.status.iso === 'ok' ? 'לפי רשת' : 'משוער', '5 / 10 / 15 דק׳')], 3) +
        R.tip('טווחי ההליכה במפה מחושבים לפי רשת הרחובות בפועל (Valhalla). כשהשירות לא זמין — מוצגים מעגלים משוערים.');
    });
    const noise = R.state(S, 'env', () => {
      const n = S.env.noise;
      return `<div class="noise n${n.level}"><span>${['🟢', '🟡', '🔴'][n.level]}</span><div><small>רמת חשיפה משוערת</small><b>${n.label}</b></div></div>` +
        (n.sources.length ? `<ul class="simple">${n.sources.slice(0, 5).map((x) => `<li><span class="lvl l${x.level}"></span><span>${x.label}</span><b>${U.dist(x.d)}</b></li>`).join('')}</ul>` : '<p class="muted small">לא נמצאו מקורות רעש משמעותיים בסביבה.</p>') +
        R.tip('אומדן לפי מרחק ממקורות רעש — לא מדידה. לאמת בסיור בשעות העומס ובמפת הרעש של המשרד להגנת הסביבה.');
    });
    const nav = `<div class="quick">${R.link(L.moovit, 'Moovit', 'qbtn')}${R.link(L.transit, 'Google — תחב״צ', 'qbtn')}${R.link(L.waze, 'Waze', 'qbtn')}</div>`;
    return R.card('תחבורה ציבורית', pt, { icon: '🚌', status: S.status.poi }) +
      R.card('דרכי הגעה ברכב', roads, { icon: '🛣', status: S.status.env }) +
      R.card('הליכה ואופניים', soft, { icon: '🚲', status: S.status.env }) +
      R.card('רעש', noise, { icon: '🔊', status: S.status.env }) +
      R.card('ניווט', nav, { icon: '🧭' });
  };

  /* =========================================================
     7. שירותים
     ========================================================= */
  R.services = (S) => {
    if (S.status.poi !== 'ok') return R.card('שירותים בסביבה', R.state(S, 'poi', () => ''), { icon: '⌂', status: S.status.poi });
    const { items, parks } = S.poi;
    const sc = R.score(items);
    let out = R.card('ציון נגישות לשירותים', `<div class="score">${SA.charts.gauge(sc.score)}
      ${R.bars(sc.parts.map((p) => ({ label: p.label, pct: p.k * 100, val: isFinite(p.d) ? U.dist(p.d) : 'לא ברדיוס' })))}</div>
      <p class="muted small">ציון משוקלל לפי מרחק הליכה לשירותים חיוניים (בהשראת Walk Score).</p>`, { icon: '🚶' });
    const greenArea = parks.reduce((s, p) => s + p.area, 0);
    const circle = Math.PI * S.r * S.r;
    out += R.card('שטחים ירוקים', R.kpis([
      R.kpi('שטח ירוק', `${U.num(greenArea / 1000, 1)} ד׳`, `ברדיוס ${S.r} מ׳`),
      R.kpi('אחוז מהשטח', `${U.num((greenArea / circle) * 100, 1)}%`),
      R.kpi('הגדול ביותר', parks.length ? U.num(Math.max(...parks.map((p) => p.area)) / 1000, 1) + ' ד׳' : '—', parks.length ? esc(parks.reduce((a, b) => (b.area > a.area ? b : a)).name) : '')
    ], 3), { icon: '🌳' });
    for (const k of Object.keys(SA.CATS).filter((x) => x !== 'transit')) {
      const list = items.filter((i) => i.cat === k);
      const c = SA.CATS[k];
      const bySub = {};
      list.forEach((i) => (bySub[i.subLabel] = (bySub[i.subLabel] || 0) + 1));
      const subs = Object.entries(bySub).sort((a, b) => b[1] - a[1]).map(([l, n]) => R.chip(`${esc(l)} · ${n}`)).join('');
      const body = list.length
        ? `<div class="chips-row">${subs}</div><ul class="rows">${list.slice(0, 6).map((i) => R.row(i)).join('')}</ul>${list.length > 6 ? `<details><summary>עוד ${list.length - 6}</summary><ul class="rows">${list.slice(6, 80).map((i) => R.row(i)).join('')}</ul></details>` : ''}`
        : '<p class="muted">לא נמצאו ברדיוס הנבחר</p>';
      out += R.card(`${c.label} <span class="count">${list.length}</span>`, body, { icon: c.icon });
    }
    return out + R.card('השלמות', `<p class="small">פרטי בתי ספר (שכבות גיל, מספר תלמידים) בפורטל השקיפות של משרד החינוך. נתוני OSM תלויים בעדכניות המיפוי — מומלץ לאמת בשטח.</p><div class="quick">${R.link(R.links(S).edu, 'שקיפות — משרד החינוך', 'qbtn')}${R.link(R.links(S).gmaps, 'Google Maps', 'qbtn')}</div>`, { icon: '+' });
  };

  /* =========================================================
     8. מרקם עירוני
     ========================================================= */
  R.fabric = (S) => {
    const morph = R.state(S, 'fabric', () => {
      const m = S.fabric.morph;
      const tot = m.hist.reduce((a, b) => a + b, 0) || 1;
      return R.kpis([
        R.kpi('מבנים', U.int(m.count), 'ברדיוס 250 מ׳'),
        R.kpi('תכסית', `${U.num(m.coverage * 100, 0)}%`, 'שטח בנוי / שטח'),
        R.kpi('ממוצע קומות', m.avgLevels ? U.num(m.avgLevels, 1) : '—', `ידוע ל-${m.levelsKnown} מבנים${m.maxLevels ? ` · מקס׳ ${Math.round(m.maxLevels)}` : ''}`),
        R.kpi('רח״ק משוער', U.num(m.far, 2), 'שטח רצפות / שטח')
      ]) + (m.levelsKnown ? `<h4>התפלגות גובה המבנים</h4>` + R.bars(SA.map.levelColors.slice(0, 5).map(([l, c], i) => ({ label: `<i class="lu-sw" style="background:${c}"></i>${l} קומות`, pct: (m.hist[i] / tot) * 100, val: m.hist[i], color: c }))) : '') +
        R.tip('<b>מפת דמות-רקע</b> (Figure-Ground, נולי): המבנים בשחור והחלל הפתוח בלבן — חושפת את גרעין המרקם, רצף החזיתות והיחס בין בנוי לפתוח. אפשר לעבור ל"גובה מבנים" במקרא המפה.');
    });
    const heritage = R.state(S, 'fabric', () => {
      const hs = S.fabric.heritage;
      if (!hs.length) return '<p class="muted">לא נמצאו אתרי מורשת או תצפיות ב-1 ק"מ (OSM).</p>' + `<div class="quick">${R.link(R.links(S).govmap, 'שכבות שימור ועתיקות ב-GovMap', 'qbtn')}</div>`;
      return `<ul class="simple">${hs.slice(0, 10).map((h) => `<li><span>${h.heritage ? '🏛' : '👁'}</span><span>${esc(h.name)}<small> · ${esc(h.kind)}</small></span><b>${U.dist(h.dist)}</b></li>`).join('')}</ul>
        <div class="quick">${R.link(R.links(S).govmap, 'שכבות שימור ועתיקות ב-GovMap', 'qbtn')}${R.link(R.links(S).history, 'היסטוריית השכונה', 'qbtn')}</div>`;
    });
    return R.card('מורפולוגיה ודמות-רקע', morph, { icon: '▤', status: S.status.fabric }) +
      R.card('מורשת, שימור ונקודות ציון', heritage, { icon: '🏛', status: S.status.fabric });
  };

  /* =========================================================
     9. אוכלוסייה
     ========================================================= */
  R.agesHtml = (S) => {
    const st = S.status.ages, a = S.ages;
    const upload = `<label class="upload">📄 העלאת קובץ למ״ס (xlsx / csv)<input type="file" accept=".xlsx,.xls,.csv" data-act="agesFile"></label>`;
    if (st === 'loading') return R.sk(5);
    if (!a) {
      return R.err(S.errors.ages || 'לא נמצאו נתוני גילאים לאזור הסטטיסטי', 'ages') +
        `<p class="small">הלמ״ס מפרסמת נתוני מפקד 2022 לפי <b>אזור סטטיסטי</b> (כמה בלוקים סביב האתר). הורידו את הקובץ "נתונים נבחרים לפי יישובים ואזורים סטטיסטיים" מאתר המפקד והעלו אותו כאן — נמצא את שורות ${esc(S.city || 'היישוב')}.</p>
        <div class="quick">${R.link(R.links(S).census, 'אתר מפקד 2022', 'qbtn')}</div>${upload}`;
    }
    const pick = S.agesOptions && S.agesOptions.length > 1
      ? `<label class="pick">אזור סטטיסטי<select data-act="agesPick">${S.agesOptions.map((o, i) => `<option value="${i}" ${o === a ? 'selected' : ''}>${esc(o.label || [o.locality, o.areaName || o.area].filter(Boolean).join(' · ') || 'שורה ' + (i + 1))}</option>`).join('')}</select></label>` : '';
    const max = Math.max(...a.series.map((b) => b.share));
    const cmp = (v, nat) => (v == null ? '' : v > nat + 3 ? `מעל הממוצע הארצי (~${nat}%)` : v < nat - 3 ? `מתחת לממוצע הארצי (~${nat}%)` : `קרוב לממוצע (~${nat}%)`);
    return pick + R.kpis([
      R.kpi('אזור סטטיסטי', esc(a.areaName || a.area || '—'), esc(a.locality || '')),
      R.kpi('תושבים באזור', a.total ? U.int(a.total) : '—'),
      R.kpi('ילדים ונוער', a.kids != null ? `${U.num(a.kids, 0)}%` : '—', cmp(a.kids, SA.demo.national.kids)),
      R.kpi('בני 65+', a.seniors != null ? `${U.num(a.seniors, 0)}%` : '—', cmp(a.seniors, SA.demo.national.seniors))
    ]) + `<h4>התפלגות גילאים</h4>` + R.bars(a.series.map((b) => ({ label: b.label, pct: (b.share / max) * 100, val: `${U.num(b.share, 1)}%`, color: 'linear-gradient(90deg,#a855f7,#6366f1)' }))) +
      (a.dependency != null ? `<p class="small">יחס תלות: <b>${U.num(a.dependency, 0)}</b> ילדים ומבוגרים לכל 100 בגיל העבודה.</p>` : '') +
      (a.extra.length ? `<details class="raw"><summary>נתונים נוספים (${a.extra.length})</summary>${R.dl(a.extra.map(([k, v]) => [esc(k), U.num(v, 1)]))}</details>` : '') +
      `<p class="muted small">מקור: ${esc(a.source)}.</p>${upload}`;
  };
  R.population = (S) => {
    const L = R.links(S);
    const pop = R.state(S, 'pop', () => {
      const p = S.pop || {};
      const w = p.wd || {};
      const latest = w.latest ? w.latest.value : p.osmPopulation;
      const year = w.latest ? w.latest.year : p.osmPopulationDate;
      const density = latest && w.area ? latest / w.area : null;
      let growth = null, span = '';
      if (w.series && w.series.length > 1) {
        const a = w.series.find((d) => d.year >= w.latest.year - 10) || w.series[0];
        if (a !== w.latest) { growth = (Math.pow(w.latest.value / a.value, 1 / (w.latest.year - a.year)) - 1) * 100; span = `${a.year}–${w.latest.year}`; }
      }
      return R.kpis([
        R.kpi('תושבים', U.int(latest), year ? `נכון ל-${esc(year)}` : ''),
        R.kpi('שטח שיפוט', w.area ? `${U.num(w.area, 1)} קמ"ר` : '—'),
        R.kpi('צפיפות', density ? U.int(density) : '—', 'נפש לקמ"ר'),
        R.kpi('גידול שנתי', growth != null ? `${U.num(growth, 1)}%` : '—', span)
      ]) + (w.series && w.series.length > 1 ? `<div class="chart-box">${SA.charts.population(w.series)}</div>` : '') +
        R.dl([['שנת ייסוד', w.founded || '']]) +
        `<div class="quick">${w.wiki ? R.link(w.wiki, 'ויקיפדיה', 'qbtn') : ''}${R.link(L.cbs, 'למ״ס — פרופיל יישוב', 'qbtn')}</div>`;
    });
    return R.card('פרופיל גילאים — האזור הסטטיסטי', R.agesHtml(S), { icon: '☺', status: S.status.ages, sub: 'כמה בלוקים סביב הכתובת · מפקד 2022' }) +
      R.card(`היישוב — ${esc(S.city || '')}`, pop, { icon: '👥', status: S.status.pop });
  };

  /* =========================================================
     10. מקורות
     ========================================================= */
  R.sources = (S) => {
    const st = S.status, L = R.links(S);
    const rows = [
      ['addr', 'כתובת', 'OpenStreetMap · Nominatim'],
      ['parcel', 'גוש וחלקה', 'המרכז למיפוי ישראל · GovMap'],
      ['lot', 'גבול מגרש וחזית', 'GovMap + OSM'],
      ['plans', 'תכניות (תב״ע)', 'מנהל התכנון · XPLAN'],
      ['pdetail', 'ייעודי קרקע וקווי בניין', 'מנהל התכנון · סריקת שכבות'],
      ['poi', 'שירותים ותחבורה', 'OpenStreetMap · Overpass'],
      ['env', 'דרכים, מים ורעש', 'OpenStreetMap · Overpass'],
      ['fabric', 'מבנים, מרקם ומורשת', 'OpenStreetMap · Overpass'],
      ['contours', 'קווי גובה ותבליט', 'SRTM · AWS Terrain Tiles'],
      ['elev', 'גובה ומפנה', 'Copernicus DEM · Open-Meteo'],
      ['climate', 'רוח ואקלים', 'ERA5 · Open-Meteo'],
      ['iso', 'טווחי הליכה', 'Valhalla · FOSSGIS'],
      ['pop', 'אוכלוסיית היישוב', 'למ״ס דרך Wikidata'],
      ['ages', 'פרופיל גילאים', 'למ״ס · data.gov.il']
    ];
    const tbl = `<ul class="sources">${rows.map(([k, t, src]) => `<li><span class="src-st src-${st[k] || 'loading'}" title="${esc(st[k] || '')}"></span><span><b>${t}</b><small>${src}${st[k] === 'error' && S.errors[k] ? ' · ' + esc(S.errors[k]) : ''}</small></span>${st[k] === 'error' ? `<button class="btn ghost xs" data-retry="${k}">↻</button>` : ''}</li>`).join('')}</ul>`;
    const more = `<ul class="bullets">
      <li>${R.link(L.govmap, 'GovMap')} — שכבות רשמיות: קדסטר, תכניות, רמ״י, עתיקות, שימור, תשתיות.</li>
      <li>${R.link(L.mavat, 'מבא״ת')} — מסמכי תכניות, הוראות ותשריטים.</li>
      <li>${R.link(L.census, 'מפקד 2022')} — נתונים לפי אזור סטטיסטי.</li>
      <li>${R.link(L.datagov, 'data.gov.il')} — מאגרי מידע ממשלתיים פתוחים.</li>
      <li>${R.link(L.nadlan, 'nadlan.gov.il')} — עסקאות נדל״ן.</li>
      <li>${R.link(L.iaa, 'רשות העתיקות')} — אתרי עתיקות מוכרזים.</li></ul>`;
    return R.card('מצב מקורות המידע', tbl + `<div class="quick"><button class="qbtn" data-act="retryAll">↻ טעינה מחדש של מה שנכשל</button><button class="qbtn" data-act="settings">הגדרות / פרוקסי</button><button class="qbtn" data-act="clearCache">ניקוי מטמון</button></div>`, { icon: 'ⓘ', sub: 'נתונים נשמרים במטמון — ביקור חוזר נטען מיד' }) +
      R.card('מקורות נוספים', more, { icon: '📚' }) +
      R.card('הערה', `<p class="small muted">גרסת האתר: ${SA.VERSION}</p><p class="small">המידע נאסף ממקורות פתוחים ללימוד וניתוח ראשוני. אין להסתמך עליו כמידע תכנוני מחייב — יש לאמת מול הוועדה המקומית, מבא״ת ו-GovMap.</p>`, { icon: '!' });
  };

  /* =========================================================
     מקרא המפה — לפי הנושא, עם הסברים ונתונים אמיתיים
     ========================================================= */
  const sw = {
    line: (c, w = 3, dash = '') => `<svg viewBox="0 0 30 14"><line x1="3" y1="7" x2="27" y2="7" stroke="${c}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''} stroke-linecap="round"/></svg>`,
    poly: (c, fill, op = 0.25, dash = '', w = 2) => `<svg viewBox="0 0 30 18"><rect x="3" y="2" width="24" height="14" rx="2" fill="${fill}" fill-opacity="${op}" stroke="${c}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''}/></svg>`,
    site: () => '<svg viewBox="0 0 30 18"><circle cx="15" cy="9" r="8" fill="#ea580c" opacity=".3"/><circle cx="15" cy="9" r="5" fill="#ea580c" stroke="#fff" stroke-width="2"/></svg>',
    ring: () => '<svg viewBox="0 0 30 18"><circle cx="15" cy="9" r="7" fill="none" stroke="#0f766e" stroke-width="1.5" stroke-dasharray="3 3"/></svg>',
    icon: (cat) => `<span class="key-ico" style="--c:${SA.CATS[cat].color}">${SA.CATS[cat].icon}</span>`,
    emoji: (e, c) => `<span class="key-ico" style="--c:${c}">${e}</span>`,
    text: (t, cls = '') => `<span class="key-txt ${cls}">${t}</span>`,
    contour: (w, op) => `<svg viewBox="0 0 30 18"><path class="sw-contour" d="M2 13 C10 3, 20 3, 28 11" fill="none" stroke-width="${w}" opacity="${op}"/></svg>`,
    ink: (w, dash) => `<svg viewBox="0 0 30 14"><line class="sw-ink" x1="3" y1="7" x2="27" y2="7" stroke-width="${w}" stroke-dasharray="${dash}"/></svg>`,
    grad: (ramp) => `<span class="key-grad" style="background:linear-gradient(90deg,${ramp.map((r) => r.color).join(',')})"></span>`
  };
  const item = (o) => o;

  /** הגדרת המקרא לכל נושא: [{title, items:[{layer, sw, name, desc, val}]}] */
  R.legendSpec = (theme, S) => {
    const base = { title: 'האתר', items: [item({ sw: sw.site(), name: 'האתר', desc: 'ניתן לגרור למיקום אחר' }), item({ sw: sw.ring(), name: 'רדיוס הניתוח', val: S ? `${S.r} מ׳` : '' })] };
    const c = S && S.contours, e = S && S.env, cl = S && S.climate;
    const T = {
      overview: [base, { title: 'בקצרה', items: [
        item({ layer: 'parcel', sw: sw.poly('#ea580c', '#fb923c', 0.3), name: 'החלקה', val: S && S.parcel ? `${S.parcel.gush}/${S.parcel.helka}` : '' }),
        item({ layer: 'iso', sw: sw.line('#0d9488', 2, '4 3'), name: 'טווחי הליכה', desc: '5 / 10 / 15 דקות' }),
        item({ layer: 'poi:transit', sw: sw.icon('transit'), name: 'תחבורה ציבורית' }),
        item({ layer: 'parks', sw: sw.poly('#16a34a', '#4ade80', 0.4, '', 1), name: 'פארקים וגינות' }),
        item({ layer: 'water', sw: sw.line('#0284c7', 4), name: 'קו החוף ומים' })] }],
      lot: [base, { title: 'מגרש', items: [
        item({ layer: 'parcel', sw: sw.poly('#ea580c', '#fb923c', 0.3), name: 'גבול החלקה', desc: 'מהקדסטר של המרכז למיפוי ישראל', val: S && S.lot ? `${U.int(S.lot.area)} מ"ר` : '' }),
        item({ layer: 'lot', sw: sw.line('#ea580c', 6), name: 'חזית לרחוב', val: S && S.lot ? `${U.num(S.lot.frontage, 1)} מ׳` : '' }),
        item({ layer: 'lot', sw: sw.text('12.5', 'dim'), name: 'אורך צלע', desc: 'במטרים, על כל צלע' }),
        item({ layer: 'setback', sw: sw.poly('#dc2626', '#fca5a5', 0.3, '6 4'), name: 'קווי בניין (מעטפת)', desc: 'לפי המרווחים שהוזנו', val: S && S.envelope ? `${U.int(S.envelope.area)} מ"ר` : '' }),
        item({ layer: 'setback', sw: sw.line('#dc2626', 2.5), name: 'קו בניין מהתכנית', desc: 'כשנמצאת שכבה רשמית' }),
        item({ layer: 'planlot', sw: sw.poly('#7c2d12', '#fff', 0, '2 4', 2.5), name: 'מגרש לפי התכנית' })] }],
      planning: [base, { title: 'תכניות', items: [
        item({ layer: 'plan', sw: sw.poly('#1d4ed8', '#1d4ed8', 0.05, '', 2.5), name: 'תב״ע החלה על האתר', val: S && S.plans && S.plans.atSite[0] ? S.plans.atSite[0].number : '' }),
        item({ layer: 'plansWms', sw: sw.poly('#2563eb', '#93c5fd', 0.3, '', 1), name: 'קווים כחולים', desc: 'גבולות כל התכניות (מנהל התכנון)' }),
        item({ layer: 'parcelsWms', sw: sw.poly('#64748b', '#fff', 0, '', 1), name: 'גושים וחלקות', desc: 'בזום קרוב (GovMap)' })] },
      { title: 'ייעודי קרקע (צבעי מבא״ת)', items: [
        item({ layer: 'landuse', sw: sw.poly('#15803d', '#22c55e', 0.55), name: 'שצ״פ', desc: 'שטח ציבורי פתוח' }),
        item({ layer: 'landuse', sw: sw.poly('#facc15', '#facc15', 0.45, '', 0.8), name: 'מגורים' }),
        item({ layer: 'landuse', sw: sw.poly('#fb923c', '#fb923c', 0.45, '', 0.8), name: 'מעורב' }),
        item({ layer: 'landuse', sw: sw.poly('#c084fc', '#c084fc', 0.45, '', 0.8), name: 'מסחר ותעסוקה' }),
        item({ layer: 'landuse', sw: sw.poly('#a16207', '#a16207', 0.45, '', 0.8), name: 'מבני ציבור' }),
        item({ layer: 'landuse', sw: sw.poly('#ef4444', '#ef4444', 0.45, '', 0.8), name: 'דרך' }),
        item({ layer: 'osmLanduse', sw: sw.poly('#facc15', '#facc15', 0.25, '3 2', 0.6), name: 'שימוש בפועל (OSM)', desc: 'כשאין שכבת תכנון' })] }],
      topo: [base,
        { title: 'צבעי גבהים', items: [
          item({ layer: 'tint', sw: c ? sw.grad(c.tint.ramp) : sw.text('—'), name: 'גובה מעל פני הים', desc: 'ירוק = נמוך · חום = גבוה, עם הצללה מצפון-מערב', val: c ? `${U.int(c.tint.lo)}–${U.int(c.tint.hi)} מ׳` : '' })] },
        { title: 'קווי גובה', items: [
          item({ layer: 'contours', sw: sw.contour(0.8, 0.6), name: 'קו גובה רגיל', desc: 'מחבר נקודות באותו גובה', val: c ? `כל ${c.interval} מ׳` : '' }),
          item({ layer: 'contours', sw: sw.contour(1.8, 0.95), name: 'קו גובה ראשי + ערך', desc: 'קווים צפופים = שיפוע תלול', val: c ? `כל ${c.major} מ׳` : '' })] },
        { title: 'נקודות וחתכים', items: [
          item({ layer: 'spots', sw: sw.text('▲', 'hi'), name: 'הנקודה הגבוהה', val: c && c.spots.hi ? `${U.int(c.spots.hi.v)} מ׳` : '' }),
          item({ layer: 'spots', sw: sw.text('▼', 'lo'), name: 'הנקודה הנמוכה', val: c && c.spots.lo ? `${U.int(c.spots.lo.v)} מ׳` : '' }),
          item({ layer: 'spots', sw: sw.text('●', 'site'), name: 'גובה האתר', val: c && c.site != null ? `${U.int(c.site)} מ׳` : '' }),
          item({ layer: 'sections', sw: sw.ink(1.6, '6 3 1 3'), name: 'קווי חתך A–A׳, B–B׳', desc: 'החתכים עצמם בלשונית' })] },
        { title: 'מים', items: [
          item({ layer: 'water', sw: sw.line('#0284c7', 4), name: 'קו החוף', val: e && isFinite(e.coastDist) ? U.dist(e.coastDist) : '' }),
          item({ layer: 'water', sw: sw.line('#38bdf8', 2.5, '5 4'), name: 'נחל / ערוץ', val: e && isFinite(e.riverDist) ? U.dist(e.riverDist) : '' })] }],
      climate: [base, { title: 'שמש', items: [
        item({ layer: 'sun', sw: sw.line('#f59e0b', 3, '6 4'), name: 'זריחה ושקיעה בקיץ', desc: '21 ביוני', val: S ? `${Math.round(S.sun[0].riseAz)}° / ${Math.round(S.sun[0].setAz)}°` : '' }),
        item({ layer: 'sun', sw: sw.line('#3b82f6', 3, '6 4'), name: 'זריחה ושקיעה בחורף', desc: '21 בדצמבר', val: S ? `${Math.round(S.sun[2].riseAz)}° / ${Math.round(S.sun[2].setAz)}°` : '' })] },
      { title: 'רוח', items: [
        item({ layer: 'wind', sw: sw.line('#0ea5e9', 5), name: 'רוח שולטת', desc: 'החץ מצביע לכיוון הנשיבה', val: cl ? `${U.dir8(cl.prevailing)} · ${U.num(cl.meanSpeed, 1)} מ/ש` : '' })] },
      { title: 'הצללה', items: [
        item({ layer: 'buildings', sw: sw.poly('#334155', '#f97316', 0.85, '', 0.6), name: 'מבנים לפי גובה', desc: 'מבנים גבוהים מטילים צל ארוך' })] }],
      transport: [base, { title: 'תחבורה', items: [
        item({ layer: 'poi:transit', sw: sw.icon('transit'), name: 'תחנות', desc: 'אוטובוס, רכבת, רק״ל, אופניים' }),
        item({ layer: 'rail', sw: sw.line('#334155', 3, '10 4'), name: 'מסילת רכבת' }),
        item({ layer: 'rail', sw: sw.line('#7c3aed', 3), name: 'רכבת קלה' }),
        item({ layer: 'cycle', sw: sw.line('#16a34a', 3, '1 4'), name: 'שביל אופניים', val: e ? `${U.num(e.cycleKm, 1)} ק"מ` : '' })] },
      { title: 'דרכים', items: [
        item({ layer: 'roads', sw: sw.line('#b91c1c', 5), name: 'כביש מהיר' }), item({ layer: 'roads', sw: sw.line('#ea580c', 5), name: 'דרך ראשית' }),
        item({ layer: 'roads', sw: sw.line('#d97706', 5), name: 'עורק ראשי' }), item({ layer: 'roads', sw: sw.line('#ca8a04', 5), name: 'עורק משני' })] },
      { title: 'טווחי הליכה', items: [
        item({ layer: 'iso', sw: sw.line('#0d9488', 2, '4 3'), name: '5 דקות', desc: '~400 מ׳' }), item({ layer: 'iso', sw: sw.line('#0284c7', 2, '4 3'), name: '10 דקות', desc: '~800 מ׳' }),
        item({ layer: 'iso', sw: sw.line('#6366f1', 2, '4 3'), name: '15 דקות', desc: '~1.2 ק"מ' })] }],
      services: [base, { title: 'שירותים', items: ['education', 'green', 'health', 'community', 'commerce', 'parking'].map((k) =>
        item({ layer: 'poi:' + k, sw: sw.icon(k), name: SA.CATS[k].label, val: S && S.poi ? S.poi.items.filter((i) => i.cat === k).length : '' }))
        .concat([item({ layer: 'parks', sw: sw.poly('#16a34a', '#4ade80', 0.4, '', 1), name: 'שטח פארקים', val: S && S.poi ? `${U.num(S.poi.parks.reduce((s, p) => s + p.area, 0) / 1000, 1)} ד׳` : '' })]) }],
      fabric: [base, { title: 'מרקם', items: [
        item({ layer: 'figure', sw: sw.poly('#111', '#111', 0.95, '', 0), name: 'דמות-רקע', desc: 'בנוי בשחור, פתוח בלבן', val: S && S.fabric ? `${U.num(S.fabric.morph.coverage * 100, 0)}% בנוי` : '' }),
        item({ layer: 'buildings', sw: sw.poly('#334155', '#f97316', 0.85, '', 0.6), name: 'גובה מבנים', desc: 'צבע לפי מספר קומות' })] },
      { title: 'גובה מבנים (קומות)', items: SA.map.levelColors.map(([l, col]) => item({ layer: 'buildings', sw: sw.poly('#334155', col, 0.9, '', 0.6), name: l })) },
      { title: 'מורשת', items: [
        item({ layer: 'heritage', sw: sw.emoji('🏛', '#9a3412'), name: 'אתר היסטורי / שימור', val: S && S.fabric ? S.fabric.heritage.filter((h) => h.heritage).length : '' }),
        item({ layer: 'heritage', sw: sw.emoji('👁', '#0f766e'), name: 'תצפית / מוזיאון / אמנות' })] }],
      population: [base, { title: 'אוכלוסייה', items: [
        item({ layer: 'statarea', sw: sw.poly('#9333ea', '#c084fc', 0.1, '8 4', 2), name: 'האזור הסטטיסטי', desc: 'יחידת המפקד של הלמ״ס', val: S && S.ages && S.ages.total ? `${U.int(S.ages.total)} תושבים` : '' })] }],
      sources: [base]
    };
    return T[theme] || T.overview;
  };

  R.legend = (theme, S) => R.legendSpec(theme, S).map((sec) => `<section><h5>${sec.title}</h5><ul>${sec.items.map((it) => {
    const on = it.layer ? SA.map.isOn(it.layer) : true;
    const tag = it.layer ? 'button' : 'div';
    return `<li><${tag} class="key-item ${on ? '' : 'off'}" ${it.layer ? `data-layer="${it.layer}" aria-pressed="${on}" title="${on ? 'הסתרה' : 'הצגה'}"` : ''}>
      <span class="key-sw">${it.sw}</span><span class="key-t"><b>${it.name}</b>${it.desc ? `<small>${it.desc}</small>` : ''}</span>${it.val !== undefined && it.val !== '' ? `<span class="key-v">${esc(it.val)}</span>` : ''}</${tag}></li>`;
  }).join('')}</ul></section>`).join('');

  /** אותו מקרא כטקסט מוסבר בתוך הפאנל */
  R.legendText = (theme, S) => R.legendSpec(theme, S).slice(1).map((sec) => `<h4>${sec.title}</h4><ul class="explain-list">${sec.items.map((it) =>
    `<li><span class="key-sw">${it.sw}</span><div><b>${it.name}</b>${it.val !== undefined && it.val !== '' ? ` <span class="key-v">${esc(it.val)}</span>` : ''}${it.desc ? `<small>${it.desc}</small>` : ''}</div></li>`).join('')}</ul>`).join('');
})(window.SA);

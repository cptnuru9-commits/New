/* =========================================================
   SiteLens — אפליקציה: חיפוש, תזמור טעינה, לשוניות, ייצוא
   ========================================================= */
(function (SA) {
  const U = SA.util, API = SA.api, R = SA.render;
  const $ = U.$, $$ = U.$$;
  let seq = 0;
  let radius = U.store.get('sitelens.radius', 800);
  let activeTab = 'overview';

  const PANES_FOR = {
    addr: ['overview', 'planning', 'sources'],
    parcel: ['overview', 'planning', 'sources'],
    plans: ['overview', 'planning', 'sources'],
    permits: ['planning'],
    poi: ['overview', 'transport', 'services', 'sources'],
    env: ['overview', 'transport', 'population', 'environment', 'sources'],
    elev: ['overview', 'environment', 'sources'],
    climate: ['overview', 'environment', 'sources'],
    iso: ['transport', 'sources'],
    pop: ['overview', 'population', 'sources'],
    ckan: ['population']
  };

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }
  SA.toast = toast;

  /* ---------- theme ---------- */
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    U.store.set('sitelens.theme', t);
    if (SA.map.get()) SA.map.setTheme();
  }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = U.store.get('sitelens.theme', prefersDark ? 'dark' : 'light');

  /* =========================================================
     ניתוח
     ========================================================= */
  function renderPane(name) {
    const S = SA.state;
    if (!S) return;
    const el = $(`.pane[data-pane="${name}"]`);
    const open = $$('details[open] > summary', el).map((s) => s.textContent);
    el.innerHTML = R[name](S);
    // שימור מצב "פתוח" של details אחרי רינדור מחדש
    $$('details > summary', el).forEach((s) => { if (open.includes(s.textContent)) s.parentElement.open = true; });
  }
  function renderPanes(list) { [...new Set(list)].forEach(renderPane); }
  function renderAll() { renderPanes(['overview', 'planning', 'transport', 'services', 'population', 'environment', 'sources']); }

  function renderHeader() {
    const S = SA.state;
    $('#siteAddress').textContent = S.addr || 'נקודה במפה';
    $('#siteCity').textContent = [S.address && S.address.neighbourhood, S.city].filter(Boolean).join(' · ') || 'ישראל';
    const itm = U.toITM(S.lat, S.lon);
    const b = [];
    b.push(`<button class="badge" data-copy="${S.lat.toFixed(6)}, ${S.lon.toFixed(6)}" title="העתקת קואורדינטות">WGS84 ${S.lat.toFixed(5)}, ${S.lon.toFixed(5)}</button>`);
    if (itm) b.push(`<button class="badge" data-copy="${itm.x}, ${itm.y}" title="רשת ישראל החדשה">ITM ${itm.x}, ${itm.y}</button>`);
    if (S.parcel) b.push(`<button class="badge accent" data-copy="גוש ${U.esc(S.parcel.gush)} חלקה ${U.esc(S.parcel.helka)}">גוש ${U.esc(S.parcel.gush)} · חלקה ${U.esc(S.parcel.helka)}</button>`);
    if (S.plans && S.plans.atSite[0]) b.push(`<button class="badge plan" data-copy="${U.esc(S.plans.atSite[0].number)}">תב״ע ${U.esc(S.plans.atSite[0].number)}</button>`);
    $('#siteBadges').innerHTML = b.join('');
  }

  function run(token, key, promise, onOk) {
    const S = SA.state;
    S.status[key] = 'loading';
    return promise
      .then((v) => {
        if (token !== seq) return;
        S.status[key] = 'ok';
        onOk && onOk(v);
      })
      .catch((e) => {
        if (token !== seq) return;
        console.warn(`[${key}]`, e);
        S.status[key] = 'error';
        S.errors[key] = e && e.message ? e.message : String(e);
        if (key === 'iso') SA.map.showIso(S.lat, S.lon, null);
      })
      .finally(() => {
        if (token !== seq) return;
        renderPanes(PANES_FOR[key] || []);
        if (['addr', 'parcel', 'plans'].includes(key)) renderHeader();
      });
  }

  function loadRadiusDependent(token) {
    const S = SA.state;
    run(token, 'poi', API.poi(S.lat, S.lon, S.r), (v) => {
      S.poi = v;
      SA.map.showPOI(v.items, v.parks);
      updateLegend();
    });
    run(token, 'plans', API.plans(S.lat, S.lon, Math.min(S.r, 1200)), (v) => {
      S.plans = v;
      SA.map.showPlans(v.atSite);
    });
  }

  function analyze(lat, lon, label) {
    const token = ++seq;
    const S = (SA.state = {
      lat, lon, r: radius, addr: label ? label.split(',')[0] : '', label,
      city: '', status: {}, errors: {}, sun: SA.charts.sunData(lat, lon)
    });
    ['addr', 'parcel', 'plans', 'poi', 'env', 'elev', 'climate', 'iso', 'pop'].forEach((k) => (S.status[k] = 'loading'));

    $('#emptyState').hidden = true;
    $('#results').hidden = false;
    $('#mapHint').classList.add('hide');
    document.body.classList.add('has-site');
    setRadiusUI();
    renderHeader();
    renderAll();
    selectTab(activeTab);

    SA.map.clear();
    SA.map.setSite(lat, lon, (a, b) => analyze(a, b));
    SA.map.setRadius(lat, lon, radius);
    SA.map.fly(lat, lon, radius);
    SA.map.showSun(lat, lon, S.sun);
    SA.map.showIso(lat, lon, null);
    history.replaceState(null, '', `#${lat.toFixed(6)},${lon.toFixed(6)},${radius}`);

    run(token, 'addr', API.reverse(lat, lon), (a) => {
      S.address = a;
      S.addr = a.street || S.addr || a.neighbourhood || 'נקודה במפה';
      S.city = a.city;
      pushRecent({ label: [S.addr, S.city].filter(Boolean).join(', '), lat, lon });
      if (/תל.?אביב/.test(a.city || '')) {
        run(token, 'permits', API.telAvivPermits(lat, lon), (p) => (S.permits = p));
      }
    });
    run(token, 'parcel', API.parcel(lat, lon), (p) => {
      S.parcel = p;
      SA.map.showParcel(p.rings);
    });
    loadRadiusDependent(token);
    run(token, 'env', API.environment(lat, lon), (e) => {
      S.env = e;
      SA.map.showEnv(e);
    });
    run(token, 'elev', API.elevation(lat, lon), (e) => (S.elev = e));
    run(token, 'climate', API.climate(lat, lon), (c) => (S.climate = c));
    run(token, 'iso', API.isochrone(lat, lon), (g) => SA.map.showIso(lat, lon, g));

    // Nominatim: עד בקשה אחת לשנייה — מרווחים את בקשת היישוב
    const popP = new Promise((r) => setTimeout(r, 1100))
      .then(() => API.city(lat, lon))
      .then(async (c) => {
        S.pop = c;
        if (!S.city) S.city = c.name;
        if (c.wikidata) {
          try { c.wd = await API.wikidata(c.wikidata); } catch (e) { /* ignore */ }
        }
        if (!c.wd && !c.osmPopulation) throw new Error('לא נמצאו נתוני אוכלוסייה ליישוב');
        API.ckanPopulation(c.name || S.city)
          .then((k) => { if (token === seq) { S.ckan = k; renderPane('population'); } })
          .catch(() => {});
        return c;
      });
    run(token, 'pop', popP);

    if (window.innerWidth < 900) document.body.classList.add('sheet-open');
  }
  SA.analyze = analyze;

  /* =========================================================
     חיפוש + השלמה אוטומטית
     ========================================================= */
  const input = $('#searchInput'), sugg = $('#suggestions');
  let suggItems = [], suggIdx = -1;

  function hideSugg() { sugg.hidden = true; suggIdx = -1; input.setAttribute('aria-expanded', 'false'); }
  function drawSugg() {
    if (!suggItems.length) return hideSugg();
    sugg.innerHTML = suggItems.map((s, i) =>
      `<li role="option" id="sg${i}" aria-selected="${i === suggIdx}" data-i="${i}"><b>${U.esc(s.main)}</b><small>${U.esc(s.sub)}</small></li>`).join('');
    sugg.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }
  const doSuggest = U.debounce(async (q) => {
    if (q.length < 3 || /^\s*(גוש|\d)/.test(q)) return hideSugg();
    try {
      suggItems = await API.suggest(q);
      if (input.value.trim() === q) drawSugg();
    } catch (e) { hideSugg(); }
  }, 260);

  input.addEventListener('input', () => doSuggest(input.value.trim()));
  input.addEventListener('keydown', (e) => {
    if (sugg.hidden) return;
    if (e.key === 'ArrowDown') { suggIdx = (suggIdx + 1) % suggItems.length; drawSugg(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { suggIdx = (suggIdx - 1 + suggItems.length) % suggItems.length; drawSugg(); e.preventDefault(); }
    else if (e.key === 'Escape') hideSugg();
  });
  sugg.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    e.preventDefault();
    pick(suggItems[+li.dataset.i]);
  });
  input.addEventListener('blur', () => setTimeout(hideSugg, 150));

  function pick(s) {
    input.value = s.label;
    hideSugg();
    analyze(s.lat, s.lon, s.label);
  }

  async function search(q) {
    q = q.trim();
    if (!q) return;
    // קואורדינטות WGS84
    let m = q.match(/^(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)$/);
    if (m) return analyze(+m[1], +m[2], q);
    // רשת ישראל (ITM)
    m = q.match(/^(\d{6})[,\s]+(\d{6})$/);
    if (m) { const p = U.fromITM(+m[1], +m[2]); return analyze(p.lat, p.lon, `ITM ${m[1]}, ${m[2]}`); }
    // גוש / חלקה
    m = q.match(/גוש\s*(\d+)\D+(?:חלקה\s*)?(\d+)/);
    if (m) {
      toast(`מאתר גוש ${m[1]} חלקה ${m[2]}…`);
      try {
        const p = await API.parcelByNumber(m[1], m[2]);
        return analyze(p.lat, p.lon, `גוש ${m[1]} חלקה ${m[2]}`);
      } catch (e) {
        toast(e.message);
        window.open(`https://www.govmap.gov.il/?q=${encodeURIComponent(`גוש ${m[1]} חלקה ${m[2]}`)}`, '_blank', 'noopener');
        return;
      }
    }
    try {
      const res = await API.geocode(q);
      if (!res.length) return toast('הכתובת לא נמצאה — נסו ניסוח אחר או לחצו על המפה');
      analyze(res[0].lat, res[0].lon, res[0].label);
    } catch (e) {
      toast('שירות החיפוש לא זמין: ' + e.message);
    }
  }

  $('#searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!sugg.hidden && suggIdx >= 0) return pick(suggItems[suggIdx]);
    hideSugg();
    search(input.value);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });

  /* ---------- היסטוריה ---------- */
  function pushRecent(item) {
    const list = U.store.get('sitelens.recent', []).filter((x) => x.label !== item.label);
    list.unshift(item);
    U.store.set('sitelens.recent', list.slice(0, 6));
  }
  function drawRecent() {
    const list = U.store.get('sitelens.recent', []);
    $('#recent').innerHTML = list.length
      ? `<h4>חיפושים אחרונים</h4><ul>${list.map((r, i) => `<li><button data-recent="${i}">📍 ${U.esc(r.label)}</button></li>`).join('')}</ul>`
      : '';
  }
  $('#recent').addEventListener('click', (e) => {
    const b = e.target.closest('[data-recent]');
    if (!b) return;
    const r = U.store.get('sitelens.recent', [])[+b.dataset.recent];
    if (r) analyze(r.lat, r.lon, r.label);
  });
  $('#examples').addEventListener('click', (e) => {
    const b = e.target.closest('[data-q]');
    if (!b) return;
    input.value = b.dataset.q;
    search(b.dataset.q);
  });

  /* =========================================================
     לשוניות, רדיוס, מקרא
     ========================================================= */
  function selectTab(name) {
    activeTab = name;
    $$('#tabs [role=tab]').forEach((t) => {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      if (on) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    $$('.pane').forEach((p) => (p.hidden = p.dataset.pane !== name));
  }
  $('#tabs').addEventListener('click', (e) => {
    const t = e.target.closest('[role=tab]');
    if (t) selectTab(t.dataset.tab);
  });
  $('#tabs').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const tabs = $$('#tabs [role=tab]');
    const i = tabs.findIndex((t) => t.dataset.tab === activeTab);
    const n = (i + (e.key === 'ArrowLeft' ? 1 : -1) + tabs.length) % tabs.length; // RTL
    selectTab(tabs[n].dataset.tab);
    tabs[n].focus();
  });

  function setRadiusUI() {
    $$('#radiusSeg button').forEach((b) => b.setAttribute('aria-checked', +b.dataset.r === radius));
  }
  $('#radiusSeg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]');
    if (!b || !SA.state) return;
    radius = +b.dataset.r;
    U.store.set('sitelens.radius', radius);
    setRadiusUI();
    const S = SA.state;
    S.r = radius;
    SA.map.setRadius(S.lat, S.lon, radius);
    SA.map.fly(S.lat, S.lon, radius);
    history.replaceState(null, '', `#${S.lat.toFixed(6)},${S.lon.toFixed(6)},${radius}`);
    S.status.poi = S.status.plans = 'loading';
    renderPanes(['overview', 'planning', 'transport', 'services']);
    loadRadiusDependent(seq);
  });

  const hidden = new Set(['parking']);
  function updateLegend() {
    const items = (SA.state && SA.state.poi && SA.state.poi.items) || [];
    $('#legend').innerHTML = Object.entries(SA.CATS).map(([k, c]) => {
      const n = items.filter((i) => i.cat === k).length;
      return `<button class="lg ${hidden.has(k) ? 'off' : ''}" data-cat="${k}" aria-pressed="${!hidden.has(k)}" style="--c:${c.color}"><span>${c.icon}</span>${c.label}<b>${SA.state && SA.state.poi ? n : ''}</b></button>`;
    }).join('');
  }
  $('#legend').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    const k = b.dataset.cat;
    if (hidden.has(k)) hidden.delete(k); else hidden.add(k);
    SA.map.togglePOI(k, !hidden.has(k));
    updateLegend();
  });

  /* ---------- פעולות בתוך הפאנל ---------- */
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('הועתק: ' + text.slice(0, 60)); }
    catch (e) { toast(text); }
  }
  $('#results').addEventListener('click', (e) => {
    const row = e.target.closest('.row[data-id]');
    if (row && SA.state.poi) {
      const it = SA.state.poi.items.find((i) => i.id === row.dataset.id);
      if (it) {
        if (window.innerWidth < 900) document.body.classList.remove('sheet-open');
        SA.map.focus(it);
      }
      return;
    }
    const c = e.target.closest('[data-copy]');
    if (c) {
      copy(c.dataset.copy);
      if (c.dataset.open) setTimeout(() => window.open(c.dataset.open, '_blank', 'noopener'), 300);
      return;
    }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'fitParcel') SA.map.fitParcel();
    if (a.dataset.act === 'settings') openSettings();
    if (a.dataset.act === 'retry') analyze(SA.state.lat, SA.state.lon, SA.state.label);
  });
  $('#results').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('.row[data-id]')) e.target.click();
  });

  /* ---------- ייצוא ---------- */
  function summaryText() {
    const S = SA.state;
    const lines = [`ניתוח אתר — ${S.addr || ''}${S.city ? ', ' + S.city : ''}`, `קואורדינטות: ${S.lat.toFixed(6)}, ${S.lon.toFixed(6)}`];
    const itm = U.toITM(S.lat, S.lon);
    if (itm) lines.push(`ITM: ${itm.x}, ${itm.y}`);
    if (S.parcel) lines.push(`גוש ${S.parcel.gush} חלקה ${S.parcel.helka}${S.parcel.area ? ` (${U.int(S.parcel.area)} מ"ר)` : ''}`);
    if (S.plans) S.plans.atSite.forEach((p) => lines.push(`תכנית ${p.number}${p.name ? ' — ' + p.name : ''}${p.status ? ' [' + p.status + ']' : ''}`));
    if (S.poi) {
      const it = S.poi.items;
      lines.push(`תחנות אוטובוס ≤400 מ': ${it.filter((i) => i.sub === 'bus_stop' && i.dist <= 400).length}`);
      const rail = it.find((i) => /station|halt|light_rail|tram_stop/.test(i.sub));
      if (rail) lines.push(`רכבת קרובה: ${rail.name} (${U.dist(rail.dist)})`);
      Object.entries(SA.CATS).forEach(([k, c]) => lines.push(`${c.label} ברדיוס ${S.r} מ': ${it.filter((i) => i.cat === k).length}`));
    }
    if (S.env && isFinite(S.env.coastDist)) lines.push(`מרחק מקו החוף: ${U.dist(S.env.coastDist)}`);
    if (S.elev) lines.push(`גובה: ${U.int(S.elev.elevation)} מ', שיפוע ${U.num(S.elev.slopePct, 1)}%`);
    if (S.climate) lines.push(`רוח שולטת: ${U.dir8(S.climate.prevailing)}`);
    if (S.pop && S.pop.wd && S.pop.wd.latest) lines.push(`אוכלוסיית ${S.city}: ${U.int(S.pop.wd.latest.value)} (${S.pop.wd.latest.year})`);
    return lines.join('\n');
  }
  $('#copyBtn').addEventListener('click', () => copy(summaryText()));

  $('#geojsonBtn').addEventListener('click', () => {
    const S = SA.state;
    const feats = [{ type: 'Feature', properties: { kind: 'site', address: S.addr, city: S.city }, geometry: { type: 'Point', coordinates: [S.lon, S.lat] } }];
    if (S.parcel && S.parcel.rings) S.parcel.rings.forEach((r) => feats.push({ type: 'Feature', properties: { kind: 'parcel', gush: S.parcel.gush, helka: S.parcel.helka }, geometry: { type: 'Polygon', coordinates: [r.map((p) => [p.lon, p.lat])] } }));
    if (S.plans) S.plans.atSite.forEach((p) => (p.rings || []).forEach((r) => feats.push({ type: 'Feature', properties: { kind: 'plan', number: p.number, name: p.name, status: p.status }, geometry: { type: 'Polygon', coordinates: [r.map((q) => [q.lon, q.lat])] } })));
    if (S.poi) S.poi.items.forEach((i) => feats.push({ type: 'Feature', properties: { kind: i.cat, type: i.subLabel, name: i.name, distance_m: Math.round(i.dist), routes: i.routes || undefined }, geometry: { type: 'Point', coordinates: [i.lon, i.lat] } }));
    const blob = new Blob([JSON.stringify({ type: 'FeatureCollection', features: feats }, null, 1)], { type: 'application/geo+json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `site-analysis-${S.lat.toFixed(4)}_${S.lon.toFixed(4)}.geojson`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  $('#printBtn').addEventListener('click', () => {
    document.body.classList.add('printing');
    $$('.pane').forEach((p) => (p.hidden = false));
    SA.map.get().invalidateSize();
    setTimeout(() => window.print(), 400);
  });
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing');
    selectTab(activeTab);
  });

  /* ---------- הגדרות ---------- */
  const LABELS = {
    nominatim: 'Nominatim (גיאוקודינג)', photon: 'Photon (השלמה אוטומטית)', overpass: 'שרתי Overpass (שורה לכל שרת)',
    xplan: 'מנהל התכנון — XPLAN MapServer', govmapWfs: 'GovMap WFS', govmapWms: 'GovMap WMS', parcelLayer: 'שכבת חלקות',
    subGushLayer: 'שכבת גושים', ckan: 'data.gov.il CKAN API', wikidata: 'Wikidata API', openMeteoArchive: 'Open-Meteo Archive',
    openMeteoElevation: 'Open-Meteo Elevation', valhalla: 'Valhalla (איזוכרונים)', telAvivGis: 'GIS תל אביב', corsProxy: 'פרוקסי CORS (קידומת)'
  };
  function openSettings() {
    const c = SA.config;
    $('#settingsFields').innerHTML = Object.keys(SA.configDefaults).map((k) => {
      const v = Array.isArray(c[k]) ? c[k].join('\n') : c[k];
      const tag = Array.isArray(c[k]) ? `<textarea id="cfg-${k}" rows="3" dir="ltr">${U.esc(v)}</textarea>` : `<input id="cfg-${k}" dir="ltr" value="${U.esc(v)}" />`;
      return `<label><span>${LABELS[k] || k}</span>${tag}</label>`;
    }).join('');
    $('#settings').showModal();
  }
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#settingsForm').addEventListener('submit', (e) => {
    if (e.submitter && e.submitter.value !== 'save') return;
    const patch = {};
    Object.keys(SA.configDefaults).forEach((k) => {
      const v = $(`#cfg-${k}`).value.trim();
      patch[k] = Array.isArray(SA.configDefaults[k]) ? v.split(/\s+/).filter(Boolean) : v;
    });
    SA.saveConfig(patch);
    toast('ההגדרות נשמרו — מרעננים…');
    setTimeout(() => location.reload(), 700);
  });
  $('#resetSettings').addEventListener('click', () => {
    SA.resetConfig();
    toast('אופס לברירת מחדל');
    setTimeout(() => location.reload(), 700);
  });

  /* ---------- כפתורי סרגל ---------- */
  $('#themeBtn').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  $('#locateBtn').addEventListener('click', () => {
    if (!navigator.geolocation) return toast('הדפדפן לא תומך באיתור מיקום');
    toast('מאתר מיקום…');
    navigator.geolocation.getCurrentPosition(
      (p) => analyze(p.coords.latitude, p.coords.longitude),
      () => toast('לא ניתן לאתר מיקום'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
  $('#sheetHandle').addEventListener('click', () => document.body.classList.toggle('sheet-open'));

  /* =========================================================
     אתחול
     ========================================================= */
  SA.map.init((lat, lon) => analyze(lat, lon));
  updateLegend();
  drawRecent();
  setRadiusUI();

  const h = location.hash.slice(1).split(',').map(Number);
  if (h.length >= 2 && h.every((x) => !isNaN(x)) && h[0] > 29 && h[0] < 34) {
    if (h[2]) radius = h[2];
    analyze(h[0], h[1]);
  }
})(window.SA);

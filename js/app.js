/* =========================================================
   SiteLens — אפליקציה: חיפוש, טעינה עמידה, לשוניות-נושאים,
   מקרא מפה דינמי, ייצוא והערות
   ========================================================= */
(function (SA) {
  /* ---------- תיקון עצמי: דף HTML ישן מהמטמון + קוד חדש ← טעינה מחדש נקייה ---------- */
  if (!document.getElementById('panelScroll') || !document.getElementById('keyBody')) {
    const V = SA.VERSION || 'x';
    let healed = false;
    try { healed = sessionStorage.getItem('sitelens.heal') === V; sessionStorage.setItem('sitelens.heal', V); } catch (e) { /* ignore */ }
    if (!healed) { location.replace(location.pathname + '?v=' + V + '-' + Date.now() + location.hash); return; }
    if (SA.fatal) SA.fatal('הדפדפן טוען גרסה ישנה של האתר מהמטמון — נסו לרענן או לנקות את נתוני האתר.');
    return;
  }
  const U = SA.util, API = SA.api, R = SA.render;
  const $ = U.$, $$ = U.$$;
  let seq = 0;
  let radius = U.store.get('sitelens.radius', 800);
  let activeTab = 'overview';

  // אילו לשוניות תלויות בכל מקור (לרינדור חוזר אחרי טעינה)
  const PANES_FOR = {
    addr: ['overview', 'planning', 'sources'],
    parcel: ['overview', 'lot', 'sources'],
    lot: ['overview', 'lot', 'sources'],
    pdetail: ['overview', 'planning', 'lot', 'sources'],
    plans: ['overview', 'planning', 'sources'],
    permits: ['planning'],
    poi: ['overview', 'transport', 'services', 'sources'],
    env: ['overview', 'topo', 'transport', 'sources'],
    fabric: ['overview', 'fabric', 'planning', 'sources'],
    elev: ['overview', 'topo', 'sources'],
    contours: ['overview', 'topo', 'sources'],
    climate: ['overview', 'climate', 'sources'],
    iso: ['transport', 'sources'],
    pop: ['overview', 'population', 'sources'],
    ages: ['overview', 'population', 'sources']
  };

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2800);
  }
  SA.toast = toast;

  /* ---------- ערכת צבעים ---------- */
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = U.store.get('sitelens.theme', prefersDark ? 'dark' : 'light');
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    U.store.set('sitelens.theme', t);
    SA.map.setTheme();
  }

  /* =========================================================
     רינדור
     ========================================================= */
  function renderPane(name) {
    const S = SA.state;
    if (!S || !R[name]) return;
    const el = $(`.pane[data-pane="${name}"]`);
    // שימור מצב: details פתוחים, פוקוס בשדה קלט
    const open = $$('details[open] > summary', el).map((s) => s.textContent);
    const focused = document.activeElement && el.contains(document.activeElement) && document.activeElement.matches('input,textarea,select');
    if (focused) return; // לא מרנדרים מתחת לאצבע של המשתמש
    el.innerHTML = R[name](S);
    $$('details > summary', el).forEach((s) => { if (open.includes(s.textContent)) s.parentElement.open = true; });
  }
  const renderPanes = (list) => [...new Set(list)].forEach(renderPane);
  const renderAll = () => R.TABS.forEach((t) => renderPane(t.key));

  function renderHeader() {
    const S = SA.state;
    $('#siteAddress').textContent = S.addr || 'נקודה במפה';
    $('#siteCity').textContent = [S.address && S.address.neighbourhood, S.city].filter(Boolean).join(' · ') || 'ישראל';
    const itm = U.toITM(S.lat, S.lon);
    const b = [];
    if (S.parcel) b.push(`<button class="badge accent" data-copy="גוש ${U.esc(S.parcel.gush)} חלקה ${U.esc(S.parcel.helka)}" title="העתקה">גוש ${U.esc(S.parcel.gush)} · חלקה ${U.esc(S.parcel.helka)}</button>`);
    if (S.plans && S.plans.atSite[0]) b.push(`<button class="badge plan" data-copy="${U.esc(S.plans.atSite[0].number)}" title="העתקה">תב״ע ${U.esc(S.plans.atSite[0].number)}</button>`);
    b.push(`<button class="badge mono" data-copy="${S.lat.toFixed(6)}, ${S.lon.toFixed(6)}" title="העתקת קואורדינטות">${S.lat.toFixed(5)}, ${S.lon.toFixed(5)}</button>`);
    if (itm) b.push(`<button class="badge mono" data-copy="${itm.x}, ${itm.y}" title="רשת ישראל החדשה">ITM ${itm.x}, ${itm.y}</button>`);
    $('#siteBadges').innerHTML = b.join('');
  }

  function renderProgress() {
    const S = SA.state;
    const keys = Object.keys(S.status).filter((k) => k !== 'permits');
    const done = keys.filter((k) => S.status[k] !== 'loading').length;
    const bar = $('#progress');
    bar.style.setProperty('--p', `${(done / keys.length) * 100}%`);
    bar.classList.toggle('done', done === keys.length);
  }

  /* ---------- מקרא ושכבות במפה ---------- */
  function renderLegend() {
    const S = SA.state;
    const tab = R.TABS.find((t) => t.key === SA.map.theme()) || R.TABS[0];
    $('#keyTitle').textContent = `מקרא · ${tab.label}`;
    $('#keyBody').innerHTML = R.legend(SA.map.theme(), S);
  }
  function renderLayers() {
    const groups = {};
    SA.map.LAYERS.forEach(([k, label, g]) => (groups[g] = groups[g] || []).push([k, label]));
    $('#layersBody').innerHTML =
      `<section><h5>מפת רקע</h5><div class="base-grid">${Object.entries(SA.map.BASES).map(([k, l]) =>
        `<button class="base-btn ${SA.map.baseKey() === k ? 'on' : ''}" data-base="${k}">${l}</button>`).join('')}</div></section>` +
      Object.entries(groups).map(([g, ls]) => `<section><h5>${g}</h5>${ls.map(([k, l]) =>
        `<label class="lyr"><input type="checkbox" data-layer="${k}" ${SA.map.isOn(k) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</section>`).join('');
  }
  SA.map.onChange = U.debounce(() => { renderLegend(); if (!$('#layersPanel').hidden) renderLayers(); }, 30);

  /* =========================================================
     טעינת מקורות — כל מקור עצמאי, עם "נסו שוב"
     ========================================================= */
  function run(token, key, promise, onOk) {
    const S = SA.state;
    S.status[key] = 'loading';
    delete S.errors[key];
    renderProgress();
    return promise
      .then((v) => {
        if (token !== seq) return;
        S.status[key] = 'ok';
        if (onOk) onOk(v);
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
        renderProgress();
        renderLegend();
      });
  }

  const LOADERS = {
    addr: (t, S) => run(t, 'addr', API.reverse(S.lat, S.lon), (a) => {
      S.address = a;
      S.addr = a.street || S.addr || a.neighbourhood || 'נקודה במפה';
      S.city = a.city;
      pushRecent({ label: [S.addr, S.city].filter(Boolean).join(', '), lat: S.lat, lon: S.lon });
      if (/תל.?אביב/.test(a.city || '')) API.telAvivPermits(S.lat, S.lon).then((p) => { if (t === seq) { S.permits = p; renderPane('planning'); } }).catch(() => {});
    }),
    parcel: (t, S) => {
      S._parcelP = API.parcel(S.lat, S.lon);
      run(t, 'parcel', S._parcelP, (p) => { S.parcel = p; SA.map.showParcel(p); });
      return LOADERS.lot(t, S);
    },
    lot: (t, S) => run(t, 'lot', (S._parcelP || API.parcel(S.lat, S.lon)).then(async (p) => {
      const streets = await API.streets(S.lat, S.lon).catch(() => []);
      const lot = SA.plot.analyze(p.rings[0], streets);
      if (!lot) throw new Error('לא ניתן לנתח את גבול החלקה');
      return lot;
    }), (lot) => { S.lot = lot; SA.map.showLot(lot); updateEnvelope(); }),
    pdetail: (t, S) => run(t, 'pdetail', API.planDetails(S.lat, S.lon), (pd) => {
      S.pdetail = pd;
      SA.map.showLandUse(pd);
      SA.map.showSetback(S.envelope, pd.lines);
      if (SA.map.theme() === 'planning') applyMapTheme();
    }),
    plans: (t, S) => run(t, 'plans', API.plans(S.lat, S.lon, Math.min(S.r, 1200)), (v) => { S.plans = v; SA.map.showPlans(v.atSite); }),
    poi: (t, S) => run(t, 'poi', API.poi(S.lat, S.lon, S.r), (v) => { S.poi = v; SA.map.showPOI(v.items, v.parks); }),
    env: (t, S) => run(t, 'env', API.environment(S.lat, S.lon), (e) => { S.env = e; SA.map.showEnv(e); }),
    fabric: (t, S) => run(t, 'fabric', API.fabric(S.lat, S.lon), (f) => { S.fabric = f; SA.map.showFabric(f); }),
    elev: (t, S) => run(t, 'elev', API.elevation(S.lat, S.lon), (e) => (S.elev = e)),
    contours: (t, S) => run(t, 'contours', SA.topo.contours(S.lat, S.lon, S.r), (c) => {
      S.contours = c;
      const d = Math.max(S.r, 400);
      const W = U.destination(S, 270, d), E = U.destination(S, 90, d), So = U.destination(S, 180, d), N = U.destination(S, 0, d);
      S.sections = [
        { a: W, b: E, labels: ['A', 'A׳'], prof: SA.topo.profile(c, W, E) },
        { a: So, b: N, labels: ['B', 'B׳'], prof: SA.topo.profile(c, So, N) }
      ];
      SA.map.setSections(S.sections);
      SA.map.showContours(c, { lat: S.lat, lon: S.lon });
    }),
    climate: (t, S) => run(t, 'climate', API.climate(S.lat, S.lon), (c) => { S.climate = c; SA.map.showWind(S.lat, S.lon, c); }),
    iso: (t, S) => run(t, 'iso', API.isochrone(S.lat, S.lon), (g) => SA.map.showIso(S.lat, S.lon, g)),
    pop: (t, S) => run(t, 'pop', U.sleep(600).then(() => API.city(S.lat, S.lon)).then(async (c) => {
      S.pop = c;
      if (!S.city) S.city = c.name;
      if (c.wikidata) { try { c.wd = await API.wikidata(c.wikidata); } catch (e) { /* ignore */ } }
      if (!c.wd && !c.osmPopulation) throw new Error('לא נמצאו נתוני אוכלוסייה ליישוב');
      return c;
    })),
    ages: (t, S) => run(t, 'ages', SA.demo.fromServices(S.lat, S.lon).catch(async (e1) => {
      // גיבוי: data.gov.il לפי שם היישוב
      for (let i = 0; i < 20 && !S.city; i++) await U.sleep(300);
      try {
        const res = await SA.demo.fromCkan(S.city);
        S.agesOptions = res.options;
        return res.options[0];
      } catch (e2) { throw e1; }
    }), (a) => { S.ages = a; SA.map.showStatArea(a); })
  };
  const ORDER = ['addr', 'parcel', 'plans', 'pdetail', 'poi', 'env', 'contours', 'elev', 'climate', 'fabric', 'iso', 'pop', 'ages'];

  function retry(key) {
    const S = SA.state;
    if (!S || !LOADERS[key]) return;
    if (key === 'lot' && S.status.parcel === 'error') key = 'parcel';
    LOADERS[key](seq, S);
  }

  function analyze(lat, lon, label) {
    const token = ++seq;
    const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
    const S = (SA.state = {
      lat, lon, r: radius, addr: label ? label.split(',')[0] : '', label, key,
      city: '', status: {}, errors: {}, sun: SA.charts.sunData(lat, lon),
      setbacks: U.store.get('sitelens.setbacks', { front: 5, side: 3, rear: 5, floors: 4, coverage: '' }),
      notes: U.store.get('sitelens.notes.' + key, '')
    });
    ['addr', 'parcel', 'lot', 'plans', 'pdetail', 'poi', 'env', 'fabric', 'elev', 'contours', 'climate', 'iso', 'pop', 'ages'].forEach((k) => (S.status[k] = 'loading'));

    $('#emptyState').hidden = true;
    $('#results').hidden = false;
    document.body.classList.add('has-site');
    setRadiusUI();
    renderHeader();
    renderAll();
    selectTab(activeTab, { noFit: true });

    SA.map.clear();
    SA.map.setSite(lat, lon, (a, b) => analyze(a, b));
    SA.map.setRadius(lat, lon, radius);
    SA.map.fly(lat, lon, radius);
    SA.map.showSun(lat, lon, S.sun);
    SA.map.showIso(lat, lon, null);
    history.replaceState(null, '', `#${lat.toFixed(6)},${lon.toFixed(6)},${radius}`);

    ORDER.forEach((k) => LOADERS[k](token, S));
    if (window.innerWidth < 900) document.body.classList.add('sheet-mid');
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
      `<li role="option" id="sg${i}" aria-selected="${i === suggIdx}" data-i="${i}"><span class="sg-ico">📍</span><span><b>${U.esc(s.main)}</b><small>${U.esc(s.sub)}</small></span></li>`).join('');
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
  function pick(s) { input.value = s.label; hideSugg(); input.blur(); analyze(s.lat, s.lon, s.label); }

  async function search(q) {
    q = q.trim();
    if (!q) return;
    let m = q.match(/^(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)$/);
    if (m) return analyze(+m[1], +m[2], q);
    m = q.match(/^(\d{6})[,\s]+(\d{6})$/);
    if (m) { const p = U.fromITM(+m[1], +m[2]); return analyze(p.lat, p.lon, `ITM ${m[1]}, ${m[2]}`); }
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
    $('#searchForm').classList.add('busy');
    try {
      const res = await API.geocode(q);
      if (!res.length) return toast('הכתובת לא נמצאה — נסו ניסוח אחר, או לחצו על המפה');
      input.blur();
      analyze(res[0].lat, res[0].lon, res[0].label);
    } catch (e) {
      toast('שירות החיפוש לא זמין כרגע — נסו שוב בעוד רגע');
    } finally {
      $('#searchForm').classList.remove('busy');
    }
  }
  $('#searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!sugg.hidden && suggIdx >= 0) return pick(suggItems[suggIdx]);
    hideSugg();
    search(input.value);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); input.select(); }
  });

  /* ---------- היסטוריה ודוגמאות ---------- */
  function pushRecent(item) {
    const list = U.store.get('sitelens.recent', []).filter((x) => x.label !== item.label);
    list.unshift(item);
    U.store.set('sitelens.recent', list.slice(0, 6));
  }
  function drawRecent() {
    const list = U.store.get('sitelens.recent', []);
    $('#recent').innerHTML = list.length
      ? `<h4>חיפושים אחרונים</h4><ul>${list.map((r, i) => `<li><button data-recent="${i}"><span>↺</span>${U.esc(r.label)}</button></li>`).join('')}</ul>` : '';
  }
  $('#recent').addEventListener('click', (e) => {
    const b = e.target.closest('[data-recent]');
    const r = b && U.store.get('sitelens.recent', [])[+b.dataset.recent];
    if (r) analyze(r.lat, r.lon, r.label);
  });
  $('#emptyState').addEventListener('click', (e) => {
    const b = e.target.closest('[data-q]');
    if (!b) return;
    input.value = b.dataset.q;
    search(b.dataset.q);
  });

  /* =========================================================
     לשוניות-נושאים ← מפה
     ========================================================= */
  $('#tabs').innerHTML = R.TABS.map((t) => `<button role="tab" data-tab="${t.key}" aria-selected="false"><span class="tab-ico" aria-hidden="true">${t.icon}</span>${t.label}</button>`).join('');
  function applyMapTheme(fit) {
    const S = SA.state;
    const skip = [];
    if (S && S.pdetail && S.pdetail.landuse.length) skip.push('osmLanduse');
    SA.map.applyTheme(activeTab, { fit, skip, site: S && { lat: S.lat, lon: S.lon, r: S.r } });
  }
  function selectTab(name, { noFit } = {}) {
    activeTab = name;
    $$('#tabs [role=tab]').forEach((t) => {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      if (on) t.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    });
    $$('.pane').forEach((p) => (p.hidden = p.dataset.pane !== name));
    if (SA.state) applyMapTheme(!noFit);
    const panel = $('#panelScroll');
    if (panel && panel.scrollTop > $('.site-head').offsetHeight) panel.scrollTop = $('.site-head').offsetHeight;
  }
  $('#tabs').addEventListener('click', (e) => {
    const t = e.target.closest('[role=tab]');
    if (t) selectTab(t.dataset.tab);
  });
  $('#tabs').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const tabs = $$('#tabs [role=tab]');
    const i = tabs.findIndex((t) => t.dataset.tab === activeTab);
    const n = (i + (e.key === 'ArrowLeft' ? 1 : -1) + tabs.length) % tabs.length;
    selectTab(tabs[n].dataset.tab);
    tabs[n].focus();
  });

  /* ---------- רדיוס ---------- */
  function setRadiusUI() { $$('#radiusSeg button').forEach((b) => b.setAttribute('aria-checked', +b.dataset.r === radius)); }
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
    ['poi', 'plans', 'contours'].forEach((k) => LOADERS[k](seq, S));
  });

  /* ---------- מקרא ושכבות במפה ---------- */
  let keyOpen = U.store.get('sitelens.keyOpen', window.innerWidth > 900);
  function setKeyOpen(v) {
    keyOpen = v;
    $('#mapKey').classList.toggle('collapsed', !v);
    $('#keyToggle').setAttribute('aria-expanded', v);
    U.store.set('sitelens.keyOpen', v);
  }
  setKeyOpen(keyOpen);
  $('#keyToggle').addEventListener('click', () => setKeyOpen(!keyOpen));
  $('#keyBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-layer]');
    if (b) SA.map.toggle(b.dataset.layer);
  });
  $('#layersBtn').addEventListener('click', () => {
    const p = $('#layersPanel');
    p.hidden = !p.hidden;
    $('#layersBtn').setAttribute('aria-expanded', !p.hidden);
    if (!p.hidden) renderLayers();
  });
  $('#layersPanel').addEventListener('change', (e) => {
    const c = e.target.closest('[data-layer]');
    if (c) SA.map.toggle(c.dataset.layer, c.checked);
  });
  $('#layersPanel').addEventListener('click', (e) => {
    const b = e.target.closest('[data-base]');
    if (b) { SA.map.setBase(b.dataset.base); renderLayers(); }
    if (e.target.closest('[data-close]')) { $('#layersPanel').hidden = true; $('#layersBtn').setAttribute('aria-expanded', false); }
  });

  /* =========================================================
     פעולות בתוך הפאנל
     ========================================================= */
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('הועתק ✓'); }
    catch (e) { toast(text); }
  }
  function updateEnvelope() {
    const S = SA.state;
    if (!S.lot) return;
    const sb = S.setbacks;
    S.envelope = SA.plot.envelope(S.lot, { front: +sb.front || 0, side: +sb.side || 0, rear: +sb.rear || 0 });
    SA.map.showSetback(S.envelope, S.pdetail && S.pdetail.lines);
    const k = $('#envKpis');
    if (k) k.innerHTML = R.envKpis(S);
    renderLegend();
  }

  $('#results').addEventListener('click', (e) => {
    const S = SA.state;
    const row = e.target.closest('.row[data-id]');
    if (row && S.poi) {
      const it = S.poi.items.find((i) => i.id === row.dataset.id);
      if (it) { if (window.innerWidth < 900) document.body.classList.remove('sheet-open'); SA.map.focus(it); }
      return;
    }
    const c = e.target.closest('[data-copy]');
    if (c) { copy(c.dataset.copy); if (c.dataset.open) setTimeout(() => window.open(c.dataset.open, '_blank', 'noopener'), 300); return; }
    const r = e.target.closest('[data-retry]');
    if (r) { retry(r.dataset.retry); return; }
    const g = e.target.closest('[data-goto]');
    if (g) { selectTab(g.dataset.goto); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'fitParcel') SA.map.fitLayer('parcel', 2);
    if (act === 'settings') openSettings();
    if (act === 'retryAll') Object.keys(S.status).filter((k) => S.status[k] === 'error').forEach(retry);
    if (act === 'clearCache') {
      try { indexedDB.deleteDatabase('sitelens'); } catch (err) { /* ignore */ }
      toast('המטמון נוקה — טוען מחדש');
      setTimeout(() => location.reload(), 600);
    }
  });
  $('#results').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('.row[data-id]')) e.target.click();
  });
  $('#results').addEventListener('input', (e) => {
    const S = SA.state;
    const f = e.target.closest('[data-sb]');
    if (f && S && S.setbacks) {
      const v = f.value === '' ? '' : Math.max(0, +f.value);
      S.setbacks[f.dataset.sb] = f.dataset.sb === 'floors' ? Math.max(1, Math.round(+v || 1)) : v;
      U.store.set('sitelens.setbacks', S.setbacks);
      updateEnvelope();
    }
    if (e.target.matches('[data-notes]')) {
      S.notes = e.target.value;
      U.store.set('sitelens.notes.' + S.key, S.notes);
    }
  });
  $('#results').addEventListener('change', async (e) => {
    const S = SA.state;
    if (e.target.matches('[data-act=agesFile]') && e.target.files[0]) {
      toast('קורא את הקובץ…');
      try {
        const res = await SA.demo.fromFile(e.target.files[0], S.city);
        S.agesOptions = res.options;
        S.ages = res.options[0];
        S.status.ages = 'ok';
        toast(`נמצאו ${res.options.length} שורות — בחרו את האזור הסטטיסטי`);
      } catch (err) { toast(err.message); }
      e.target.blur();
      renderPanes(PANES_FOR.ages);
    }
    if (e.target.matches('[data-act=agesPick]')) {
      S.ages = S.agesOptions[+e.target.value];
      e.target.blur();
      renderPane('population');
    }
  });

  /* ---------- ייצוא ---------- */
  function summaryText() {
    const S = SA.state;
    const L = [`ניתוח אתר — ${S.addr || ''}${S.city ? ', ' + S.city : ''}`, `קואורדינטות: ${S.lat.toFixed(6)}, ${S.lon.toFixed(6)}`];
    const itm = U.toITM(S.lat, S.lon);
    if (itm) L.push(`ITM: ${itm.x}, ${itm.y}`);
    if (S.parcel) L.push(`גוש ${S.parcel.gush} חלקה ${S.parcel.helka}${S.parcel.area ? ` (${U.int(S.parcel.area)} מ"ר)` : ''}`);
    if (S.lot) L.push(`מגרש: ${U.int(S.lot.area)} מ"ר, חזית ${U.num(S.lot.frontage, 1)} מ'`);
    if (S.plans) S.plans.atSite.forEach((p) => L.push(`תכנית ${p.number}${p.name ? ' — ' + p.name : ''}${p.status ? ' [' + p.status + ']' : ''}`));
    if (S.poi) {
      const it = S.poi.items;
      L.push(`תחנות אוטובוס ≤400 מ': ${it.filter((i) => i.sub === 'bus_stop' && i.dist <= 400).length}`);
      L.push(`ציון נגישות לשירותים: ${R.score(it).score}/100`);
    }
    if (S.contours) L.push(`גובה: ${U.int(S.contours.site)} מ', שיפוע ממוצע ${U.num(S.contours.slopeMean, 1)}%`);
    if (S.env) { if (isFinite(S.env.coastDist)) L.push(`מרחק מקו החוף: ${U.dist(S.env.coastDist)}`); L.push(`רעש: ${S.env.noise.label}`); }
    if (S.climate) L.push(`רוח שולטת: ${U.dir8(S.climate.prevailing)}, ${U.num(S.climate.meanSpeed, 1)} מ/ש`);
    if (S.fabric) L.push(`תכסית: ${U.num(S.fabric.morph.coverage * 100, 0)}%, רח"ק משוער ${U.num(S.fabric.morph.far, 2)}`);
    if (S.ages && S.ages.kids != null) L.push(`ילדים ונוער באזור הסטטיסטי: ${U.num(S.ages.kids, 0)}%`);
    const sw = R.swot(S);
    [['חוזקות', sw.s], ['חולשות', sw.w], ['הזדמנויות', sw.o], ['איומים', sw.t]].forEach(([t, l]) => l.length && L.push(`${t}: ${l.join('; ')}`));
    if (S.notes) L.push(`הערות: ${S.notes}`);
    return L.join('\n');
  }
  $('#copyBtn').addEventListener('click', () => copy(summaryText()));

  $('#geojsonBtn').addEventListener('click', () => {
    const S = SA.state;
    const poly = (ring) => ({ type: 'Polygon', coordinates: [ring.concat([ring[0]]).map((p) => [p.lon, p.lat])] });
    const feats = [{ type: 'Feature', properties: { kind: 'site', address: S.addr, city: S.city }, geometry: { type: 'Point', coordinates: [S.lon, S.lat] } }];
    if (S.parcel && S.parcel.rings) S.parcel.rings.forEach((r) => feats.push({ type: 'Feature', properties: { kind: 'parcel', gush: S.parcel.gush, helka: S.parcel.helka }, geometry: poly(r) }));
    if (S.envelope) feats.push({ type: 'Feature', properties: { kind: 'building_envelope', setbacks: S.setbacks, area_m2: Math.round(S.envelope.area) }, geometry: poly(S.envelope.ring) });
    if (S.plans) S.plans.atSite.forEach((p) => (p.rings || []).forEach((r) => feats.push({ type: 'Feature', properties: { kind: 'plan', number: p.number, name: p.name, status: p.status }, geometry: poly(r) })));
    if (S.pdetail) S.pdetail.landuse.forEach((u) => u.rings.forEach((r) => feats.push({ type: 'Feature', properties: { kind: 'landuse', designation: u.designation, group: u.group }, geometry: poly(r) })));
    if (S.poi) S.poi.items.forEach((i) => feats.push({ type: 'Feature', properties: { kind: i.cat, type: i.subLabel, name: i.name, distance_m: Math.round(i.dist), routes: i.routes || undefined }, geometry: { type: 'Point', coordinates: [i.lon, i.lat] } }));
    if (S.contours) S.contours.lines.forEach((l) => feats.push({ type: 'Feature', properties: { kind: 'contour', elevation: l.level, major: l.major }, geometry: { type: 'LineString', coordinates: l.coords.map(([la, lo]) => [lo, la]) } }));
    if (S.fabric) S.fabric.buildings.forEach((b) => feats.push({ type: 'Feature', properties: { kind: 'building', levels: b.levels }, geometry: poly(b.geom) }));
    const blob = new Blob([JSON.stringify({ type: 'FeatureCollection', features: feats })], { type: 'application/geo+json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `site-analysis-${S.lat.toFixed(4)}_${S.lon.toFixed(4)}.geojson`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('הקובץ ירד — אפשר לפתוח ב-QGIS / ArcGIS / Rhino');
  });

  $('#printBtn').addEventListener('click', () => {
    document.body.classList.add('printing');
    $$('.pane').forEach((p) => (p.hidden = false));
    SA.map.get().invalidateSize();
    setTimeout(() => window.print(), 400);
  });
  window.addEventListener('afterprint', () => { document.body.classList.remove('printing'); selectTab(activeTab, { noFit: true }); });

  /* ---------- הגדרות ---------- */
  const LABELS = {
    nominatim: 'Nominatim (חיפוש כתובות)', photon: 'Photon (השלמה אוטומטית)', overpass: 'שרתי Overpass (שורה לכל שרת)',
    xplan: 'מנהל התכנון — XPLAN', planFolder: 'תיקיית שירותי התכנון (סריקה)', extraPlanServices: 'שירותי GIS נוספים (שורה לכל שירות)',
    statRoots: 'למ״ס — שורשי שירותי GIS', govmapWfs: 'GovMap WFS', govmapWms: 'GovMap WMS', parcelLayer: 'שכבת חלקות', subGushLayer: 'שכבת גושים',
    ckan: 'data.gov.il API', wikidata: 'Wikidata API', openMeteoArchive: 'Open-Meteo Archive', openMeteoElevation: 'Open-Meteo Elevation',
    valhalla: 'Valhalla (טווחי הליכה)', terrainTiles: 'אריחי גבהים', telAvivGis: 'GIS תל אביב', corsProxy: 'פרוקסי CORS (קידומת)'
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

  /* ---------- סרגל עליון ומובייל ---------- */
  $('#themeBtn').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  $('#locateBtn').addEventListener('click', () => {
    if (!navigator.geolocation) return toast('הדפדפן לא תומך באיתור מיקום');
    toast('מאתר מיקום…');
    navigator.geolocation.getCurrentPosition((p) => analyze(p.coords.latitude, p.coords.longitude), () => toast('לא ניתן לאתר מיקום'), { enableHighAccuracy: true, timeout: 10000 });
  });
  $('#sheetHandle').addEventListener('click', () => {
    const b = document.body.classList;
    if (b.contains('sheet-open')) { b.remove('sheet-open'); b.add('sheet-mid'); }
    else if (b.contains('sheet-mid')) { b.remove('sheet-mid'); }
    else b.add('sheet-mid');
  });
  $('#sheetExpand').addEventListener('click', () => document.body.classList.toggle('sheet-open'));

  /* =========================================================
     אתחול
     ========================================================= */
  try {
    SA.map.init((lat, lon) => analyze(lat, lon));
    SA.map.applyTheme('overview');
  } catch (e) {
    console.error(e);
    SA.fatal('המפה לא נטענה: ' + e.message);
  }
  if (window.innerWidth < 900) document.body.classList.add('sheet-mid');
  drawRecent();
  setRadiusUI();
  renderLegend();

  const h = location.hash.slice(1).split(',').map(Number);
  if (h.length >= 2 && h.every((x) => !isNaN(x)) && h[0] > 29 && h[0] < 34) {
    if (h[2]) radius = h[2];
    analyze(h[0], h[1]);
  }
  SA.ready = true;
})(window.SA);

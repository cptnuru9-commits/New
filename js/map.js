/* =========================================================
   SiteLens — מפה (Leaflet): שכבות בסיס, שכבות מידע, סימונים
   ========================================================= */
window.SA = window.SA || {};

(function (SA) {
  const U = SA.util;
  const M = (SA.map = {});
  let map, siteMarker, radiusCircle, ctrlLayers, canvas;
  const groups = {};
  const poiGroups = {};
  let bases = {};
  let currentBaseKey = null;

  /* ---------- שכבת ArcGIS MapServer כאריחים (ללא צורך ב-CORS) ---------- */
  const E = 20037508.342789244;
  const ArcExport = L.TileLayer.extend({
    getTileUrl(c) {
      const span = (2 * E) / Math.pow(2, c.z);
      const xmin = -E + c.x * span, ymax = E - c.y * span;
      return `${this._url}/export?bbox=${xmin},${ymax - span},${xmin + span},${ymax}&bboxSR=3857&imageSR=3857` +
        `&size=256,256&format=png32&transparent=true&dpi=96&f=image`;
    }
  });

  const isDark = () => document.documentElement.dataset.theme === 'dark';

  M.init = function (onPick) {
    map = L.map('map', { zoomControl: false, preferCanvas: false, attributionControl: true }).setView([31.75, 34.95], 8);
    canvas = L.canvas({ padding: 0.3 });
    L.control.zoom({ position: 'topleft' }).addTo(map);
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

    // מפות בסיס ללא צורך במפתח API (CARTO דורש מפתח מדומיינים מתארחים כמו github.io)
    const osm = (cls) => L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20, maxNativeZoom: 19, className: cls, attribution: '© OpenStreetMap'
    });
    const esri = (svc, attr) => L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/${svc}/MapServer/tile/{z}/{y}/{x}`, {
      maxZoom: 20, maxNativeZoom: 19, attribution: attr
    });
    bases = {
      light: osm('base-light'),
      dark: osm('base-dark'),
      sat: esri('World_Imagery', 'Esri World Imagery'),
      osm: esri('World_Street_Map', 'Esri World Street Map'),
      topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 20, maxNativeZoom: 17, subdomains: 'abc', attribution: '© OpenTopoMap (CC-BY-SA) · © OpenStreetMap'
      })
    };
    currentBaseKey = isDark() ? 'dark' : 'light';
    bases[currentBaseKey].addTo(map);

    // שכבות מידע
    groups.plansWms = new ArcExport(SA.config.xplan, { opacity: 0.55, maxZoom: 20, attribution: 'מנהל התכנון' });
    groups.parcelsWms = L.tileLayer.wms(SA.config.govmapWms, {
      layers: SA.config.parcelLayer, format: 'image/png', transparent: true, minZoom: 14, maxZoom: 20, attribution: 'המרכז למיפוי ישראל'
    });
    groups.hillshade = esri('Elevation/World_Hillshade', 'Esri World Hillshade');
    groups.hillshade.options.className = 'hillshade';
    groups.hillshade.options.maxNativeZoom = 16;
    ['plan', 'parcel', 'iso', 'sun', 'water', 'roads', 'buildings', 'parks', 'contours'].forEach((k) => (groups[k] = L.layerGroup()));
    ['plan', 'parcel', 'iso', 'water', 'buildings', 'parks', 'contours'].forEach((k) => groups[k].addTo(map));

    ctrlLayers = L.control.layers(
      { 'מפה': bases[currentBaseKey], 'תצלום אוויר': bases.sat, 'מפה טופוגרפית': bases.topo, 'מפת רחובות (Esri)': bases.osm },
      {
        'תכניות — קווים כחולים (מנהל התכנון)': groups.plansWms,
        'גושים וחלקות (GovMap)': groups.parcelsWms,
        'תב״ע החלה על האתר': groups.plan,
        'החלקה': groups.parcel,
        'איזוכרוני הליכה 5/10/15 דק׳': groups.iso,
        'גובה מבנים (קומות)': groups.buildings,
        'פארקים וגינות': groups.parks,
        'מים וקו חוף': groups.water,
        'דרכים עיקריות': groups.roads,
        'כיווני זריחה ושקיעה': groups.sun,
        'קווי גובה (טופוגרפיה)': groups.contours,
        'הצללת תבליט (Hillshade)': groups.hillshade
      },
      { position: 'topleft', collapsed: true }
    ).addTo(map);

    Object.keys(SA.CATS).forEach((k) => {
      poiGroups[k] = L.layerGroup();
      if (k !== 'parking') poiGroups[k].addTo(map);
    });

    M.legend = new MapKey({ position: 'topright' }).addTo(map);
    map.on('overlayadd overlayremove baselayerchange', () => M.legend.refresh());

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      L.popup({ className: 'pick-popup', closeButton: false })
        .setLatLng(e.latlng)
        .setContent(`<button class="btn primary sm" id="pickHere">נתח נקודה זו</button><div class="muted mono">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>`)
        .openOn(map);
      setTimeout(() => {
        const b = document.getElementById('pickHere');
        if (b) b.onclick = () => { map.closePopup(); onPick(lat, lng); };
      });
    });
    return map;
  };

  M.get = () => map;
  M.groups = groups;
  M.poiGroups = poiGroups;

  M.setTheme = function () {
    const want = isDark() ? 'dark' : 'light';
    if (map.hasLayer(bases[currentBaseKey]) && (currentBaseKey === 'light' || currentBaseKey === 'dark') && want !== currentBaseKey) {
      map.removeLayer(bases[currentBaseKey]);
      bases[want].addTo(map).bringToBack();
      ctrlLayers.removeLayer(bases[currentBaseKey]);
      ctrlLayers.addBaseLayer(bases[want], 'מפה');
      currentBaseKey = want;
    }
    if (M._contours) M.showContours(M._contours);
  };

  /* ---------- אתר ---------- */
  M.setSite = function (lat, lon, onDrag) {
    const icon = L.divIcon({ className: 'site-icon', html: '<span class="pulse"></span><span class="pin"></span>', iconSize: [28, 28], iconAnchor: [14, 14] });
    if (!siteMarker) {
      siteMarker = L.marker([lat, lon], { icon, draggable: true, zIndexOffset: 1000, keyboard: true, title: 'האתר' }).addTo(map);
      siteMarker.on('dragend', () => { const p = siteMarker.getLatLng(); onDrag(p.lat, p.lng); });
    } else siteMarker.setLatLng([lat, lon]);
  };

  M.setRadius = function (lat, lon, r) {
    if (radiusCircle) radiusCircle.remove();
    radiusCircle = L.circle([lat, lon], { radius: r, className: 'radius-ring', interactive: false }).addTo(map);
  };

  M.fly = function (lat, lon, r) {
    const b = L.latLng(lat, lon).toBounds(r * 2.3);
    map.flyToBounds(b, { duration: 0.9, paddingTopLeft: [20, 20], paddingBottomRight: [20, 20] });
  };

  M.clear = function () {
    Object.values(poiGroups).forEach((g) => g.clearLayers());
    ['plan', 'parcel', 'iso', 'sun', 'water', 'roads', 'buildings', 'parks', 'contours'].forEach((k) => groups[k].clearLayers());
  };

  /* ---------- שירותים ---------- */
  M.poiPopup = (it) =>
    `<div class="pp"><b>${U.esc(it.name)}</b><span class="pp-sub">${U.esc(it.subLabel)}</span>` +
    `<span>${U.dist(it.dist)} · ${U.walk(it.dist)}</span>` +
    (it.routes ? `<span class="pp-routes">קווים: ${U.esc(it.routes)}</span>` : '') + '</div>';

  M.showPOI = function (items, parks) {
    Object.values(poiGroups).forEach((g) => g.clearLayers());
    groups.parks.clearLayers();
    for (const it of items) {
      const c = SA.CATS[it.cat];
      const icon = L.divIcon({
        className: 'poi-icon',
        html: `<span style="--c:${c.color}">${c.icon}</span>`,
        iconSize: [26, 26], iconAnchor: [13, 13]
      });
      it._marker = L.marker([it.lat, it.lon], { icon, title: it.name, riseOnHover: true }).bindPopup(M.poiPopup(it));
      it._marker.addTo(poiGroups[it.cat]);
    }
    for (const p of parks) {
      L.polygon(p.ring.map((q) => [q.lat, q.lon]), { renderer: canvas, className: 'park-poly', color: '#16a34a', weight: 1, fillOpacity: 0.25 })
        .bindTooltip(`${U.esc(p.name)} · ${U.int(p.area)} מ"ר`, { sticky: true }).addTo(groups.parks);
    }
  };

  M.togglePOI = function (cat, on) {
    if (on) poiGroups[cat].addTo(map);
    else poiGroups[cat].remove();
    if (M.legend) M.legend.refresh();
  };

  M.focus = function (it) {
    map.flyTo([it.lat, it.lon], Math.max(map.getZoom(), 17), { duration: 0.6 });
    if (it._marker) {
      if (!map.hasLayer(poiGroups[it.cat])) poiGroups[it.cat].addTo(map);
      setTimeout(() => it._marker.openPopup(), 650);
    }
  };

  /* ---------- תכנון וקדסטר ---------- */
  M.showPlans = function (plans) {
    groups.plan.clearLayers();
    plans.forEach((p, i) => {
      if (!p.rings || !p.rings.length) return;
      L.polygon(p.rings.map((r) => r.map((q) => [q.lat, q.lon])), {
        className: 'plan-poly', color: '#1d4ed8', weight: i === 0 ? 2.5 : 1.5, dashArray: i === 0 ? null : '6 4', fillOpacity: 0.04
      }).bindTooltip(`תכנית ${U.esc(p.number)}`, { sticky: true }).addTo(groups.plan);
    });
  };

  M.showParcel = function (rings) {
    groups.parcel.clearLayers();
    (rings || []).forEach((r) =>
      L.polygon(r.map((q) => [q.lat, q.lon]), { color: '#ea580c', weight: 2.5, fillColor: '#fb923c', fillOpacity: 0.2, className: 'parcel-poly' }).addTo(groups.parcel)
    );
  };

  M.fitParcel = function () {
    const ls = groups.parcel.getLayers();
    if (ls.length) map.flyToBounds(ls[0].getBounds().pad(1.5), { duration: 0.6 });
  };

  /* ---------- סביבה ---------- */
  const lvColor = (lv) => (!lv ? '#94a3b8' : lv <= 2 ? '#fde68a' : lv <= 4 ? '#fbbf24' : lv <= 8 ? '#f97316' : lv <= 15 ? '#dc2626' : '#7f1d1d');
  M.levelColors = [['1–2', '#fde68a'], ['3–4', '#fbbf24'], ['5–8', '#f97316'], ['9–15', '#dc2626'], ['16+', '#7f1d1d'], ['לא ידוע', '#94a3b8']];

  M.showEnv = function (env) {
    groups.water.clearLayers(); groups.roads.clearLayers(); groups.buildings.clearLayers();
    env.coast.forEach((c) => L.polyline(c.geom.map((q) => [q.lat, q.lon]), { color: '#0284c7', weight: 4, opacity: 0.9 }).bindTooltip('קו החוף').addTo(groups.water));
    env.rivers.forEach((r) => L.polyline(r.geom.map((q) => [q.lat, q.lon]), { color: '#38bdf8', weight: 2.5, dashArray: r.kind === 'stream' || r.kind === 'wadi' ? '5 4' : null }).bindTooltip(U.esc(r.name)).addTo(groups.water));
    env.water.forEach((w) => L.polygon(w.geom.map((q) => [q.lat, q.lon]), { color: '#0ea5e9', weight: 1, fillOpacity: 0.35, renderer: canvas }).bindTooltip(U.esc(w.name)).addTo(groups.water));
    const roadColor = { motorway: '#b91c1c', trunk: '#ea580c', primary: '#d97706', secondary: '#ca8a04' };
    env.roads.forEach((r) => L.polyline(r.geom.map((q) => [q.lat, q.lon]), { color: roadColor[r.cls], weight: 5, opacity: 0.75, renderer: canvas })
      .bindTooltip(U.esc([r.ref && `כביש ${r.ref}`, r.name].filter(Boolean).join(' · ') || r.cls), { sticky: true }).addTo(groups.roads));
    env.buildings.forEach((b) => {
      if (b.geom.length < 3) return;
      L.polygon(b.geom.map((q) => [q.lat, q.lon]), { renderer: canvas, color: '#334155', weight: 0.5, fillColor: lvColor(b.levels), fillOpacity: 0.75 })
        .bindTooltip(b.levels ? `${Math.round(b.levels)} קומות` : 'מספר קומות לא ידוע', { sticky: true }).addTo(groups.buildings);
    });
  };

  M.showIso = function (lat, lon, geojson) {
    groups.iso.clearLayers();
    const colors = { 5: '#0d9488', 10: '#0ea5e9', 15: '#6366f1' };
    if (geojson) {
      const feats = [...geojson.features].sort((a, b) => b.properties.contour - a.properties.contour);
      feats.forEach((f) => {
        const t = f.properties.contour;
        L.geoJSON(f, { style: { color: colors[t] || '#64748b', weight: 1.5, fillOpacity: 0.07, dashArray: '4 4' }, interactive: false }).addTo(groups.iso);
      });
    } else {
      // גיבוי: מעגלי הליכה (80 מ' לדקה × מקדם פיתול 0.75)
      [15, 10, 5].forEach((t) => L.circle([lat, lon], { radius: t * 80 * 0.75, color: colors[t], weight: 1.2, fillOpacity: 0.04, dashArray: '4 4', interactive: false }).addTo(groups.iso));
    }
  };

  M.showSun = function (lat, lon, sun) {
    groups.sun.clearLayers();
    const site = { lat, lon };
    const len = 600;
    sun.filter((d) => d.key !== 'equinox').forEach((d) => {
      const color = d.key === 'summer' ? '#f59e0b' : '#3b82f6';
      [['זריחה', d.riseAz], ['שקיעה', d.setAz]].forEach(([l, az]) => {
        const end = U.destination(site, az, len);
        L.polyline([[lat, lon], [end.lat, end.lon]], { color, weight: 3, dashArray: '8 6' })
          .bindTooltip(`${l} · ${d.label} · ${Math.round(az)}°`, { sticky: true }).addTo(groups.sun);
      });
    });
  };
  /* ---------- קווי גובה ---------- */
  M.showContours = function (res) {
    groups.contours.clearLayers();
    M._contours = res;
    if (!res) return;
    const color = isDark() ? '#e2b77a' : '#8b5a2b';
    for (const ln of res.lines) {
      L.polyline(ln.coords, {
        renderer: canvas, color, weight: ln.major ? 1.7 : 0.8, opacity: ln.major ? 0.9 : 0.55, smoothFactor: 1.5
      }).bindTooltip(`${Math.round(ln.level)} מ'`, { sticky: true, className: 'contour-tip' }).addTo(groups.contours);
    }
    // תוויות גובה על קווים ראשיים ארוכים
    res.lines.filter((l) => l.major && l.coords.length > 25).forEach((l) => {
      const p = l.coords[Math.floor(l.coords.length / 2)];
      L.marker(p, {
        interactive: false, keyboard: false,
        icon: L.divIcon({ className: 'contour-label', html: `<span>${Math.round(l.level)}</span>`, iconSize: [36, 16], iconAnchor: [18, 8] })
      }).addTo(groups.contours);
    });
  };

  /* =========================================================
     מקרא — הסבר לכל סימון במפה, לחיצה מדליקה/מכבה שכבה
     ========================================================= */
  const sw = {
    line: (c, w = 3, dash = '') => `<svg viewBox="0 0 30 14"><line x1="3" y1="7" x2="27" y2="7" stroke="${c}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''} stroke-linecap="round"/></svg>`,
    poly: (c, fill, op = 0.25, dash = '', w = 2) => `<svg viewBox="0 0 30 18"><rect x="3" y="2" width="24" height="14" rx="2" fill="${fill}" fill-opacity="${op}" stroke="${c}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''}/></svg>`,
    site: () => '<svg viewBox="0 0 30 18"><circle cx="15" cy="9" r="8" fill="#ea580c" opacity=".3"/><circle cx="15" cy="9" r="5" fill="#ea580c" stroke="#fff" stroke-width="2"/></svg>',
    ring: () => '<svg viewBox="0 0 30 18"><circle cx="15" cy="9" r="7" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="3 3"/></svg>',
    icon: (cat) => `<span class="key-ico" style="--c:${SA.CATS[cat].color}">${SA.CATS[cat].icon}</span>`,
    contour: () => '<svg viewBox="0 0 30 18"><path d="M2 14 C10 4, 20 4, 28 12" fill="none" stroke="#8b5a2b" stroke-width="1.7"/><path d="M2 17 C10 9, 20 9, 28 16" fill="none" stroke="#8b5a2b" stroke-width=".8" opacity=".6"/></svg>',
    shade: () => '<svg viewBox="0 0 30 18"><defs><linearGradient id="hs" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#555"/></linearGradient></defs><rect x="3" y="2" width="24" height="14" rx="2" fill="url(#hs)"/></svg>'
  };

  function keySections() {
    const S = [
      ['האתר והתכנון', [
        { sw: sw.site(), label: 'האתר הנבחר (ניתן לגרירה)' },
        { sw: sw.ring(), label: 'רדיוס הניתוח' },
        { g: 'parcel', sw: sw.poly('#ea580c', '#fb923c', 0.3), label: 'החלקה (גוש/חלקה)' },
        { g: 'plan', sw: sw.poly('#1d4ed8', '#1d4ed8', 0.05, '', 2.5), label: 'תב״ע החלה על האתר' },
        { g: 'plan', sw: sw.poly('#1d4ed8', '#1d4ed8', 0.05, '5 3', 1.5), label: 'תכנית נוספת החלה על האתר' },
        { g: 'plansWms', sw: sw.poly('#2563eb', '#93c5fd', 0.3, '', 1), label: 'קווים כחולים — כל התכניות (מנהל התכנון)' },
        { g: 'parcelsWms', sw: sw.poly('#64748b', '#fff', 0, '', 1), label: 'גבולות גושים וחלקות (GovMap)' }
      ]],
      ['שירותים (אייקונים)', Object.keys(SA.CATS).map((k) => ({ poi: k, sw: sw.icon(k), label: SA.CATS[k].label }))],
      ['טופוגרפיה', [
        { g: 'contours', sw: sw.contour(), label: 'קווי גובה — עבה: קו ראשי עם ערך במטרים' },
        { g: 'hillshade', sw: sw.shade(), label: 'הצללת תבליט' }
      ]],
      ['ירוק ומים', [
        { g: 'parks', sw: sw.poly('#16a34a', '#16a34a', 0.3, '', 1), label: 'פארק / גינה / גן שעשועים' },
        { g: 'water', sw: sw.line('#0284c7', 4), label: 'קו החוף (קו המים)' },
        { g: 'water', sw: sw.line('#38bdf8', 2.5), label: 'נהר / תעלה' },
        { g: 'water', sw: sw.line('#38bdf8', 2.5, '5 4'), label: 'נחל / ערוץ' },
        { g: 'water', sw: sw.poly('#0ea5e9', '#0ea5e9', 0.4, '', 1), label: 'גוף מים' }
      ]],
      ['תנועה ונגישות', [
        { g: 'roads', sw: sw.line('#b91c1c', 5), label: 'כביש מהיר' },
        { g: 'roads', sw: sw.line('#ea580c', 5), label: 'דרך ראשית' },
        { g: 'roads', sw: sw.line('#d97706', 5), label: 'עורק ראשי' },
        { g: 'roads', sw: sw.line('#ca8a04', 5), label: 'עורק משני' },
        { g: 'iso', sw: sw.line('#0d9488', 2, '4 3'), label: 'טווח הליכה 5 דק׳' },
        { g: 'iso', sw: sw.line('#0ea5e9', 2, '4 3'), label: 'טווח הליכה 10 דק׳' },
        { g: 'iso', sw: sw.line('#6366f1', 2, '4 3'), label: 'טווח הליכה 15 דק׳' }
      ]],
      ['גובה מבנים (קומות)', M.levelColors.map(([l, c]) => ({ g: 'buildings', sw: sw.poly('#334155', c, 0.85, '', 0.6), label: l }))],
      ['שמש', [
        { g: 'sun', sw: sw.line('#f59e0b', 3, '6 4'), label: 'זריחה/שקיעה — היפוך קיץ (21.6)' },
        { g: 'sun', sw: sw.line('#3b82f6', 3, '6 4'), label: 'זריחה/שקיעה — היפוך חורף (21.12)' }
      ]]
    ];
    return S;
  }

  const MapKey = L.Control.extend({
    onAdd() {
      const el = L.DomUtil.create('div', 'map-key');
      L.DomEvent.disableClickPropagation(el);
      L.DomEvent.disableScrollPropagation(el);
      this._el = el;
      let open = U.store.get('sitelens.keyOpen', window.innerWidth > 900);
      el.innerHTML = `<button class="key-toggle" aria-expanded="${open}"><svg viewBox="0 0 24 24"><path d="M4 6h2M4 12h2M4 18h2M10 6h10M10 12h10M10 18h10"/></svg>מקרא</button><div class="key-body" ${open ? '' : 'hidden'}></div>`;
      this._body = el.querySelector('.key-body');
      el.querySelector('.key-toggle').addEventListener('click', (e) => {
        open = this._body.hidden;
        this._body.hidden = !open;
        e.currentTarget.setAttribute('aria-expanded', open);
        U.store.set('sitelens.keyOpen', open);
      });
      this._body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-g],[data-poi]');
        if (!b) return;
        if (b.dataset.poi) { M.onPoiToggle && M.onPoiToggle(b.dataset.poi); return; }
        const layer = groups[b.dataset.g];
        if (map.hasLayer(layer)) map.removeLayer(layer); else map.addLayer(layer);
        this.refresh();
      });
      this.refresh();
      return el;
    },
    refresh() {
      if (!this._body) return;
      this._body.innerHTML = keySections().map(([title, items]) => `<section><h5>${title}</h5><ul>${items.map((it) => {
        const on = it.g ? map.hasLayer(groups[it.g]) : it.poi ? map.hasLayer(poiGroups[it.poi]) : true;
        const attr = it.g ? `data-g="${it.g}"` : it.poi ? `data-poi="${it.poi}"` : '';
        const tag = attr ? 'button' : 'div';
        return `<li><${tag} class="key-item ${on ? '' : 'off'}" ${attr} ${attr ? `aria-pressed="${on}" title="${on ? 'לחצו להסתרה' : 'לחצו להצגה'}"` : ''}><span class="key-sw">${it.sw}</span><span>${it.label}</span></${tag}></li>`;
      }).join('')}</ul></section>`).join('') + '<p class="key-note">לחיצה על פריט מציגה או מסתירה את השכבה</p>';
    }
  });

})(window.SA);

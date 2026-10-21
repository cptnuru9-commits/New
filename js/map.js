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
      osm: esri('World_Street_Map', 'Esri World Street Map')
    };
    currentBaseKey = isDark() ? 'dark' : 'light';
    bases[currentBaseKey].addTo(map);

    // שכבות מידע
    groups.plansWms = new ArcExport(SA.config.xplan, { opacity: 0.55, maxZoom: 20, attribution: 'מנהל התכנון' });
    groups.parcelsWms = L.tileLayer.wms(SA.config.govmapWms, {
      layers: SA.config.parcelLayer, format: 'image/png', transparent: true, minZoom: 14, maxZoom: 20, attribution: 'המרכז למיפוי ישראל'
    });
    ['plan', 'parcel', 'iso', 'sun', 'water', 'roads', 'buildings', 'parks'].forEach((k) => (groups[k] = L.layerGroup()));
    ['plan', 'parcel', 'iso', 'water', 'buildings', 'parks'].forEach((k) => groups[k].addTo(map));

    ctrlLayers = L.control.layers(
      { 'מפה': bases[currentBaseKey], 'תצלום אוויר': bases.sat, 'מפת רחובות (Esri)': bases.osm },
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
        'כיווני זריחה ושקיעה': groups.sun
      },
      { position: 'topleft', collapsed: true }
    ).addTo(map);

    Object.keys(SA.CATS).forEach((k) => {
      poiGroups[k] = L.layerGroup();
      if (k !== 'parking') poiGroups[k].addTo(map);
    });

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
    ['plan', 'parcel', 'iso', 'sun', 'water', 'roads', 'buildings', 'parks'].forEach((k) => groups[k].clearLayers());
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
})(window.SA);

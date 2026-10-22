/* =========================================================
   SiteLens — מפה
   • מפת בסיס וקטורית שקטה (OpenFreeMap Positron / Dark) עם גיבוי רסטרי
   • רישום שכבות לפי נושא — כל לשונית מציגה רק את השכבות שלה
   • הערות ונתונים על גבי המפה (מידות, גבהים, שמש, רוח, זמני הליכה)
   ========================================================= */
window.SA = window.SA || {};

(function (SA) {
  const U = SA.util;
  const M = (SA.map = {});
  let map, canvas, siteMarker, radiusCircle, baseLayer, baseKey;
  const L_ = {}; // key → Leaflet layer
  const isDark = () => document.documentElement.dataset.theme === 'dark';

  /* ---------- שכבת ArcGIS MapServer כאריחים ---------- */
  const E = 20037508.342789244;
  const ArcExport = L.TileLayer.extend({
    getTileUrl(c) {
      const span = (2 * E) / Math.pow(2, c.z);
      const xmin = -E + c.x * span, ymax = E - c.y * span;
      return `${this._url}/export?bbox=${xmin},${ymax - span},${xmin + span},${ymax}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&dpi=96&f=image`;
    }
  });

  /* =========================================================
     רישום שכבות: [מפתח, שם, קבוצה]
     ========================================================= */
  M.LAYERS = [
    ['parcel', 'החלקה (גוש/חלקה)', 'מגרש ותכנון'],
    ['lot', 'מידות המגרש וחזית', 'מגרש ותכנון'],
    ['setback', 'קווי בניין', 'מגרש ותכנון'],
    ['planlot', 'מגרש לפי התכנית', 'מגרש ותכנון'],
    ['plan', 'תב״ע החלה על האתר', 'מגרש ותכנון'],
    ['plansWms', 'קווים כחולים — כל התכניות', 'מגרש ותכנון'],
    ['parcelsWms', 'גושים וחלקות (GovMap)', 'מגרש ותכנון'],
    ['landuse', 'ייעודי קרקע ושצ״פ (תכנון)', 'מגרש ותכנון'],
    ['osmLanduse', 'שימושי קרקע בפועל (OSM)', 'מגרש ותכנון'],
    ['tint', 'צבעי גבהים + הצללה', 'טופוגרפיה'],
    ['contours', 'קווי גובה', 'טופוגרפיה'],
    ['spots', 'נקודות גובה', 'טופוגרפיה'],
    ['sections', 'קווי חתך', 'טופוגרפיה'],
    ['water', 'קו החוף, נחלים ומים', 'טופוגרפיה'],
    ['sun', 'כיווני זריחה ושקיעה', 'אקלים'],
    ['wind', 'רוח שולטת', 'אקלים'],
    ['iso', 'טווחי הליכה', 'תנועה'],
    ['roads', 'דרכים עיקריות', 'תנועה'],
    ['rail', 'מסילות רכבת', 'תנועה'],
    ['cycle', 'שבילי אופניים', 'תנועה'],
    ['poi:transit', 'תחנות תחבורה ציבורית', 'תנועה'],
    ['poi:education', 'חינוך', 'שירותים'],
    ['poi:green', 'גנים ומגרשי משחק', 'שירותים'],
    ['parks', 'פארקים (שטח)', 'שירותים'],
    ['poi:health', 'בריאות', 'שירותים'],
    ['poi:community', 'ציבור וקהילה', 'שירותים'],
    ['poi:commerce', 'מסחר', 'שירותים'],
    ['poi:parking', 'חניונים', 'שירותים'],
    ['figure', 'דמות-רקע (מבנים בשחור)', 'מרקם עירוני'],
    ['buildings', 'גובה מבנים', 'מרקם עירוני'],
    ['heritage', 'מורשת, שימור ותצפיות', 'מרקם עירוני'],
    ['statarea', 'האזור הסטטיסטי', 'אוכלוסייה']
  ];

  // מה מוצג בכל לשונית (fade = הדהיית מפת הרקע)
  M.THEMES = {
    overview: { layers: ['parcel', 'iso', 'parks', 'water', 'poi:transit'], fade: 0, view: 'radius' },
    lot: { layers: ['parcel', 'lot', 'setback', 'planlot'], fade: 0, view: 'parcel' },
    planning: { layers: ['parcel', 'plan', 'landuse', 'osmLanduse', 'plansWms'], fade: 0.15, view: 450 },
    topo: { layers: ['tint', 'contours', 'spots', 'sections', 'water', 'parcel'], fade: 0, view: 'radius' },
    climate: { layers: ['sun', 'wind', 'parcel', 'buildings'], fade: 0.1, view: 380 },
    transport: { layers: ['iso', 'roads', 'rail', 'cycle', 'poi:transit'], fade: 0.1, view: 'radius' },
    services: { layers: ['poi:education', 'poi:green', 'parks', 'poi:health', 'poi:community', 'poi:commerce'], fade: 0.1, view: 'radius' },
    fabric: { layers: ['figure', 'heritage'], fade: 0.85, view: 320 },
    population: { layers: ['statarea', 'parcel'], fade: 0, view: 'radius' },
    sources: { layers: ['parcel'], fade: 0, view: null }
  };

  /* =========================================================
     אתחול
     ========================================================= */
  M.init = function (onPick) {
    map = L.map('map', { zoomControl: false, attributionControl: true, zoomSnap: 0.25, zoomDelta: 0.5 }).setView([31.75, 34.95], 8);
    canvas = L.canvas({ padding: 0.3 });
    L.control.zoom({ position: 'topleft' }).addTo(map);
    L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 140 }).addTo(map);
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');

    [['tintPane', 380], ['areaPane', 400], ['linePane', 430], ['labelPane', 640]].forEach(([n, z]) => {
      map.createPane(n).style.zIndex = z;
    });
    map.getPane('tintPane').style.pointerEvents = 'none';
    map.getPane('labelPane').style.pointerEvents = 'none';

    M.setBase(U.store.get('sitelens.base', 'calm'));

    L_.plansWms = new ArcExport(SA.config.xplan, { opacity: 0.55, maxZoom: 20, attribution: 'מנהל התכנון' });
    L_.parcelsWms = L.tileLayer.wms(SA.config.govmapWms, {
      layers: SA.config.parcelLayer, format: 'image/png', transparent: true, minZoom: 14, maxZoom: 20, attribution: 'המרכז למיפוי ישראל'
    });
    M.LAYERS.forEach(([k]) => { if (!L_[k]) L_[k] = L.layerGroup(); });

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      L.popup({ className: 'pick-popup', closeButton: false, offset: [0, -4] })
        .setLatLng(e.latlng)
        .setContent(`<button class="btn primary sm" id="pickHere">נתחו נקודה זו</button><div class="muted mono">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>`)
        .openOn(map);
      setTimeout(() => {
        const b = document.getElementById('pickHere');
        if (b) b.onclick = () => { map.closePopup(); onPick(lat, lng); };
      });
    });
    return map;
  };
  M.get = () => map;

  /* =========================================================
     מפת בסיס
     ========================================================= */
  const raster = (url, opts) => L.tileLayer(url, { maxZoom: 20, maxNativeZoom: 19, ...opts });
  const esri = (svc, attr, opts = {}) => raster(`https://server.arcgisonline.com/ArcGIS/rest/services/${svc}/MapServer/tile/{z}/{y}/{x}`, { attribution: attr, ...opts });

  let rtlRequested = false;
  function vectorBase(style) {
    if (!L.maplibreGL || !window.maplibregl) return null;
    try {
      if (!rtlRequested && maplibregl.getRTLTextPluginStatus && maplibregl.getRTLTextPluginStatus() === 'unavailable') {
        maplibregl.setRTLTextPlugin('https://cdn.jsdelivr.net/npm/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js', true);
        rtlRequested = true;
      }
      const layer = L.maplibreGL({
        style: `https://tiles.openfreemap.org/styles/${style}`,
        attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
      });
      layer.once('add', () => {
        const gl = layer.getMaplibreMap && layer.getMaplibreMap();
        if (!gl) return;
        // תוויות בעברית
        gl.on('styledata', () => {
          try {
            gl.getStyle().layers.forEach((ly) => {
              if (ly.type === 'symbol' && ly.layout && ly.layout['text-field'])
                gl.setLayoutProperty(ly.id, 'text-field', ['coalesce', ['get', 'name:he'], ['get', 'name']]);
            });
          } catch (e) { /* style not ready */ }
        });
        let loaded = false;
        gl.once('load', () => (loaded = true));
        gl.on('error', (ev) => {
          if (!loaded && baseLayer === layer) {
            console.warn('vector basemap failed — switching to raster', ev && ev.error);
            M.setBase('calm', true);
          }
        });
      });
      return layer;
    } catch (e) {
      return null;
    }
  }

  M.BASES = { calm: 'מפה שקטה', sat: 'תצלום אוויר', topo: 'טופוגרפית', streets: 'רחובות מפורטת' };
  M.setBase = function (key, forceRaster = false) {
    if (baseLayer) map.removeLayer(baseLayer);
    let layer = null;
    if (key === 'calm' && !forceRaster) layer = vectorBase(isDark() ? 'dark' : 'positron');
    if (!layer) {
      if (key === 'sat') layer = esri('World_Imagery', 'Esri World Imagery');
      else if (key === 'topo') layer = raster('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { subdomains: 'abc', maxNativeZoom: 17, attribution: '© OpenTopoMap · © OpenStreetMap' });
      else if (key === 'streets') layer = raster('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', className: isDark() ? 'base-dark' : '' });
      else layer = isDark()
        ? esri('Canvas/World_Dark_Gray_Base', 'Esri', { maxNativeZoom: 16 })
        : esri('Canvas/World_Light_Gray_Base', 'Esri', { maxNativeZoom: 16 });
    }
    baseLayer = layer;
    baseKey = key;
    layer.addTo(map);
    if (layer.bringToBack) layer.bringToBack();
    setBaseFade();
    U.store.set('sitelens.base', key);
    if (M.onChange) M.onChange();
  };
  M.baseKey = () => baseKey;
  M.setTheme = function () {
    if (baseKey === 'calm' || baseKey === 'streets') M.setBase(baseKey);
    if (M._contours) M.showContours(M._contours);
    if (M._fabric) M.showFabric(M._fabric);
  };

  /* =========================================================
     הצגת שכבות לפי נושא
     ========================================================= */
  let currentTheme = 'overview';
  const overrides = {}; // בחירות ידניות של המשתמש, לכל נושא בנפרד
  M.isOn = (k) => !!L_[k] && map.hasLayer(L_[k]);
  M.toggle = function (k, on) {
    on = on === undefined ? !M.isOn(k) : on;
    if (on) L_[k].addTo(map); else map.removeLayer(L_[k]);
    (overrides[currentTheme] = overrides[currentTheme] || {})[k] = on;
    if (M.onChange) M.onChange();
  };
  M.applyTheme = function (theme, opts = {}) {
    currentTheme = theme;
    const t = M.THEMES[theme] || M.THEMES.overview;
    const ov = overrides[theme] || {};
    M.LAYERS.forEach(([k]) => {
      const want = k in ov ? ov[k] : t.layers.includes(k) && !(opts.skip || []).includes(k);
      if (want && !map.hasLayer(L_[k])) L_[k].addTo(map);
      if (!want && map.hasLayer(L_[k])) map.removeLayer(L_[k]);
    });
    fade = t.fade;
    setBaseFade();
    document.getElementById('map').dataset.theme = theme;
    // מצלמה לפי הנושא (רק במעבר לשונית יזום)
    if (opts.fit && opts.site && t.view) {
      if (t.view === 'parcel' && L_.parcel.getLayers().length) M.fitLayer('parcel', 1.6);
      else {
        const r = t.view === 'radius' || t.view === 'parcel' ? opts.site.r * 1.1 : t.view;
        map.flyToBounds(L.latLng(opts.site.lat, opts.site.lon).toBounds(r * 2), { duration: 0.7, padding: [10, 10] });
      }
    }
    if (M.onChange) M.onChange();
  };
  M.theme = () => currentTheme;
  let fade = 0;
  function setBaseFade() {
    if (!baseLayer) return;
    const op = String(1 - fade);
    const c = baseLayer.getMaplibreMap ? baseLayer.getContainer && baseLayer.getContainer() : null;
    if (c) c.style.opacity = op;
    else if (baseLayer.setOpacity) baseLayer.setOpacity(+op);
  }

  /* =========================================================
     אתר ורדיוס
     ========================================================= */
  M.setSite = function (lat, lon, onDrag) {
    const icon = L.divIcon({ className: 'site-icon', html: '<span class="pulse"></span><span class="pin"></span>', iconSize: [30, 30], iconAnchor: [15, 15] });
    if (!siteMarker) {
      siteMarker = L.marker([lat, lon], { icon, draggable: true, zIndexOffset: 1000, title: 'האתר — ניתן לגרור' }).addTo(map);
      siteMarker.on('dragend', () => { const p = siteMarker.getLatLng(); onDrag(p.lat, p.lng); });
    } else siteMarker.setLatLng([lat, lon]);
  };
  M.setRadius = function (lat, lon, r) {
    if (radiusCircle) radiusCircle.remove();
    radiusCircle = L.circle([lat, lon], { radius: r, className: 'radius-ring', interactive: false }).addTo(map);
  };
  M.fly = function (lat, lon, r) {
    map.flyToBounds(L.latLng(lat, lon).toBounds(r * 2.2), { duration: 0.8, padding: [20, 20] });
  };
  M.fitLayer = function (k, pad = 1.5) {
    const ls = L_[k].getLayers().filter((l) => l.getBounds);
    if (!ls.length) return;
    const b = ls.reduce((acc, l) => acc.extend(l.getBounds()), L.latLngBounds(ls[0].getBounds().getSouthWest(), ls[0].getBounds().getNorthEast()));
    map.flyToBounds(b.pad(pad), { duration: 0.6, maxZoom: 19 });
  };
  M.clear = function () {
    M.LAYERS.forEach(([k]) => { if (L_[k].clearLayers) L_[k].clearLayers(); });
    M._contours = null;
    M._fabric = null;
  };

  /* ---------- עזרי ציור ---------- */
  const ll = (arr) => arr.map((q) => [q.lat, q.lon]);
  const label = (lat, lon, html, cls, layer, size = [80, 20]) =>
    L.marker([lat, lon], { pane: 'labelPane', interactive: false, keyboard: false, icon: L.divIcon({ className: `map-label ${cls || ''}`, html, iconSize: size, iconAnchor: [size[0] / 2, size[1] / 2] }) }).addTo(layer);

  /* =========================================================
     שירותים
     ========================================================= */
  M.poiPopup = (it) =>
    `<div class="pp"><b>${U.esc(it.name)}</b><span class="pp-sub">${U.esc(it.subLabel)}</span>` +
    `<span>${U.dist(it.dist)} · ${U.walk(it.dist)}</span>` +
    (it.routes ? `<span class="pp-routes">קווים: ${U.esc(it.routes)}</span>` : '') + '</div>';

  M.showPOI = function (items, parks) {
    Object.keys(SA.CATS).forEach((c) => L_['poi:' + c].clearLayers());
    L_.parks.clearLayers();
    for (const it of items) {
      const c = SA.CATS[it.cat];
      const icon = L.divIcon({ className: 'poi-icon', html: `<span style="--c:${c.color}">${c.icon}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] });
      it._marker = L.marker([it.lat, it.lon], { icon, title: it.name, riseOnHover: true }).bindPopup(M.poiPopup(it));
      it._marker.addTo(L_['poi:' + it.cat]);
    }
    for (const p of parks)
      L.polygon(ll(p.ring), { pane: 'areaPane', renderer: canvas, color: '#16a34a', weight: 1, fillColor: '#4ade80', fillOpacity: 0.3 })
        .bindTooltip(`${U.esc(p.name)} · ${U.int(p.area)} מ"ר`, { sticky: true }).addTo(L_.parks);
  };
  M.focus = function (it) {
    map.flyTo([it.lat, it.lon], Math.max(map.getZoom(), 17), { duration: 0.6 });
    const k = 'poi:' + it.cat;
    if (!M.isOn(k)) M.toggle(k, true);
    if (it._marker) setTimeout(() => it._marker.openPopup(), 650);
  };

  /* =========================================================
     תכנון ומגרש
     ========================================================= */
  M.showPlans = function (plans) {
    L_.plan.clearLayers();
    plans.forEach((p, i) => {
      if (!p.rings || !p.rings.length) return;
      L.polygon(p.rings.map(ll), { pane: 'linePane', color: '#1d4ed8', weight: i === 0 ? 2.5 : 1.5, dashArray: i === 0 ? null : '6 4', fillOpacity: 0.03 })
        .bindTooltip(`תכנית ${U.esc(p.number)}${p.status ? ' · ' + U.esc(p.status) : ''}`, { sticky: true }).addTo(L_.plan);
    });
  };
  M.showParcel = function (p) {
    L_.parcel.clearLayers();
    (p.rings || []).forEach((r) =>
      L.polygon(ll(r), { pane: 'linePane', color: '#ea580c', weight: 2.5, fillColor: '#fb923c', fillOpacity: 0.16 })
        .bindTooltip(`גוש ${U.esc(p.gush)} · חלקה ${U.esc(p.helka)}${p.area ? ` · ${U.int(p.area)} מ"ר` : ''}`, { sticky: true }).addTo(L_.parcel));
  };
  const centroid = (ring) => ring.reduce((a, p) => ({ lat: a.lat + p.lat / ring.length, lon: a.lon + p.lon / ring.length }), { lat: 0, lon: 0 });
  M.showLot = function (lot) {
    L_.lot.clearLayers();
    if (!lot) return;
    const c = centroid(lot.ringLL);
    lot.edgesLL.forEach((e) => {
      if (e.kind === 'front')
        L.polyline([[e.a.lat, e.a.lon], [e.b.lat, e.b.lon]], { pane: 'linePane', color: '#ea580c', weight: 6, opacity: 0.9 }).addTo(L_.lot);
      if (e.len >= 1.5) label(e.mid.lat, e.mid.lon, `<span class="dim dim-${e.kind}">${U.num(e.len, 1)}</span>`, '', L_.lot, [46, 18]);
    });
    const f = lot.edgesLL.find((e) => e.kind === 'front');
    if (f) {
      const p = U.destination(f.mid, U.bearing(c, f.mid), 10);
      label(p.lat, p.lon, `<span class="tag tag-front">חזית${f.street ? ' · ' + U.esc(f.street) : ''}</span>`, '', L_.lot, [150, 22]);
    }
    label(c.lat, c.lon, `<span class="tag">${U.int(lot.area)} מ"ר</span>`, '', L_.lot, [90, 22]);
  };
  M.showSetback = function (env, official) {
    L_.setback.clearLayers();
    (official || []).forEach((l) => l.paths.forEach((p) =>
      L.polyline(ll(p), { pane: 'linePane', color: '#dc2626', weight: 2.5 })
        .bindTooltip(`קו בניין (מתוך התכנית)${l.label ? ' · ' + U.esc(l.label) : ''}`, { sticky: true }).addTo(L_.setback)));
    if (env)
      L.polygon(ll(env.ring), { pane: 'linePane', color: '#dc2626', weight: 2, dashArray: '6 4', fillColor: '#fca5a5', fillOpacity: 0.2 })
        .bindTooltip(`שטח בין קווי הבניין · ${U.int(env.area)} מ"ר`, { sticky: true }).addTo(L_.setback);
  };
  M.showLandUse = function (pd) {
    L_.landuse.clearLayers();
    L_.planlot.clearLayers();
    if (!pd) return;
    pd.landuse.slice().sort((a, b) => b.area - a.area).forEach((u) =>
      L.polygon(u.rings.map(ll), {
        pane: 'areaPane', renderer: canvas, color: u.open ? '#15803d' : u.color, weight: u.open ? 2 : 0.8,
        fillColor: u.color, fillOpacity: u.open ? 0.5 : 0.35
      }).bindTooltip(`${U.esc(u.designation)} · ${U.int(u.area)} מ"ר`, { sticky: true }).addTo(L_.landuse));
    pd.lots.filter((l) => l.contains).forEach((l) =>
      L.polygon(l.rings.map(ll), { pane: 'linePane', color: '#7c2d12', weight: 2.5, fill: false, dashArray: '2 5' })
        .bindTooltip(`מגרש לפי התכנית${l.number ? ' ' + U.esc(l.number) : ''}`, { sticky: true }).addTo(L_.planlot));
  };

  /* =========================================================
     טופוגרפיה
     ========================================================= */
  M.setSections = (s) => { M._sections = s; };
  M.showContours = function (res, site) {
    ['contours', 'tint', 'spots', 'sections'].forEach((k) => L_[k].clearLayers());
    M._contours = res;
    if (!res) return;
    if (site) M._site = site;
    site = M._site;
    L.imageOverlay(res.tint.url, res.tint.bounds, { pane: 'tintPane', opacity: 0.62, className: 'tint-img' }).addTo(L_.tint);
    const color = isDark() ? '#f1d3a6' : '#6b4423';
    for (const ln of res.lines) {
      L.polyline(ln.coords, { pane: 'linePane', renderer: canvas, color, weight: ln.major ? 1.6 : 0.7, opacity: ln.major ? 0.9 : 0.55, smoothFactor: 1.5 })
        .bindTooltip(`קו גובה ${Math.round(ln.level)} מ׳`, { sticky: true }).addTo(L_.contours);
    }
    res.lines.filter((l) => l.major && l.coords.length > 25).forEach((l) => {
      const p = l.coords[Math.floor(l.coords.length / 2)];
      label(p[0], p[1], `<span class="clabel">${Math.round(l.level)}</span>`, '', L_.contours, [34, 16]);
    });
    const { hi, lo } = res.spots;
    if (hi) label(hi.lat, hi.lon, `<span class="spot spot-hi">▲ ${Math.round(hi.v)} מ׳</span>`, '', L_.spots, [90, 22]);
    if (lo && hi && hi.v - lo.v > 1) label(lo.lat, lo.lon, `<span class="spot spot-lo">▼ ${Math.round(lo.v)} מ׳</span>`, '', L_.spots, [90, 22]);
    if (site && res.site != null) label(site.lat, site.lon, `<span class="spot spot-site">${Math.round(res.site)} מ׳</span>`, 'site-elev', L_.spots, [70, 22]);
    (M._sections || []).forEach((s) => {
      L.polyline([[s.a.lat, s.a.lon], [s.b.lat, s.b.lon]], { pane: 'linePane', color: isDark() ? '#e5e7eb' : '#111827', weight: 1.6, dashArray: '10 5 2 5' }).addTo(L_.sections);
      label(s.a.lat, s.a.lon, `<span class="sec">${s.labels[0]}</span>`, '', L_.sections, [26, 22]);
      label(s.b.lat, s.b.lon, `<span class="sec">${s.labels[1]}</span>`, '', L_.sections, [26, 22]);
    });
  };

  /* =========================================================
     סביבה ותנועה
     ========================================================= */
  M.showEnv = function (env) {
    ['water', 'roads', 'rail', 'cycle'].forEach((k) => L_[k].clearLayers());
    env.coast.forEach((c) => L.polyline(ll(c.geom), { pane: 'linePane', color: '#0284c7', weight: 4 }).bindTooltip('קו החוף').addTo(L_.water));
    env.rivers.forEach((r) => L.polyline(ll(r.geom), { pane: 'linePane', color: '#38bdf8', weight: 2.5, dashArray: /stream|wadi/.test(r.kind) ? '5 4' : null }).bindTooltip(U.esc(r.name)).addTo(L_.water));
    env.water.forEach((w) => L.polygon(ll(w.geom), { pane: 'areaPane', color: '#0ea5e9', weight: 1, fillOpacity: 0.35, renderer: canvas }).bindTooltip(U.esc(w.name)).addTo(L_.water));
    const roadColor = { motorway: '#b91c1c', trunk: '#ea580c', primary: '#d97706', secondary: '#ca8a04' };
    env.roads.forEach((r) => L.polyline(ll(r.geom), { pane: 'linePane', color: roadColor[r.cls], weight: 5, opacity: 0.7, renderer: canvas })
      .bindTooltip(U.esc([r.ref && `כביש ${r.ref}`, r.name].filter(Boolean).join(' · ') || r.cls), { sticky: true }).addTo(L_.roads));
    env.rail.forEach((r) => L.polyline(ll(r.geom), { pane: 'linePane', color: r.kind === 'rail' ? '#334155' : '#7c3aed', weight: 3, dashArray: r.kind === 'rail' ? '10 4' : null, renderer: canvas })
      .bindTooltip(r.kind === 'rail' ? 'מסילת רכבת' : 'רכבת קלה').addTo(L_.rail));
    env.cycle.forEach((c) => L.polyline(ll(c.geom), { pane: 'linePane', color: '#16a34a', weight: 3, dashArray: '1 5', lineCap: 'round', renderer: canvas }).bindTooltip('שביל / נתיב אופניים').addTo(L_.cycle));
  };

  M.showIso = function (lat, lon, geojson) {
    L_.iso.clearLayers();
    const colors = { 5: '#0d9488', 10: '#0284c7', 15: '#6366f1' };
    const put = (t, layer, top) => {
      layer.addTo(L_.iso);
      if (top) label(top.lat, top.lon, `<span class="iso-tag" style="--c:${colors[t]}">${t} דק׳</span>`, '', L_.iso, [52, 20]);
    };
    if (geojson) {
      [...geojson.features].sort((a, b) => b.properties.contour - a.properties.contour).forEach((f) => {
        const t = f.properties.contour;
        const g = L.geoJSON(f, { pane: 'areaPane', style: { color: colors[t] || '#64748b', weight: 1.5, fillOpacity: 0.05, dashArray: '4 4' }, interactive: false });
        const b = g.getBounds();
        put(t, g, b.isValid() ? { lat: b.getNorth(), lon } : null);
      });
    } else {
      [15, 10, 5].forEach((t) => {
        const r = t * 80 * 0.75;
        put(t, L.circle([lat, lon], { pane: 'areaPane', radius: r, color: colors[t], weight: 1.2, fillOpacity: 0.03, dashArray: '4 4', interactive: false }), U.destination({ lat, lon }, 0, r));
      });
    }
  };

  M.showSun = function (lat, lon, sun) {
    L_.sun.clearLayers();
    const site = { lat, lon };
    sun.filter((d) => d.key !== 'equinox').forEach((d) => {
      const color = d.key === 'summer' ? '#f59e0b' : '#3b82f6';
      [['זריחה', d.riseAz, d.sunrise], ['שקיעה', d.setAz, d.sunset]].forEach(([l, az, t]) => {
        const end = U.destination(site, az, 240);
        L.polyline([[lat, lon], [end.lat, end.lon]], { pane: 'linePane', color, weight: 3, dashArray: '8 6' }).addTo(L_.sun);
        const lp = U.destination(site, az, 290);
        label(lp.lat, lp.lon, `<span class="note-tag" style="--c:${color}">${l} ב${d.key === 'summer' ? 'קיץ' : 'חורף'} · ${U.time(t)} · ${Math.round(az)}°</span>`, '', L_.sun, [180, 22]);
      });
    });
  };

  M.showWind = function (lat, lon, cl) {
    L_.wind.clearLayers();
    if (!cl) return;
    const site = { lat, lon };
    const from = U.destination(site, cl.prevailing, 230), to = U.destination(site, cl.prevailing, 60);
    L.polyline([[from.lat, from.lon], [to.lat, to.lon]], { pane: 'linePane', color: '#0ea5e9', weight: 6, opacity: 0.85 }).addTo(L_.wind);
    label(to.lat, to.lon, `<span class="wind-head" style="transform:rotate(${(cl.prevailing + 180) % 360}deg)">▲</span>`, '', L_.wind, [26, 26]);
    const lp = U.destination(site, cl.prevailing, 280);
    label(lp.lat, lp.lon, `<span class="note-tag" style="--c:#0284c7">רוח שולטת מ${U.dir8(cl.prevailing)} · ${U.num(cl.meanSpeed, 1)} מ/ש</span>`, '', L_.wind, [200, 22]);
  };

  /* =========================================================
     מרקם עירוני
     ========================================================= */
  const lvColor = (lv) => (!lv ? '#a8b0bd' : lv <= 2 ? '#fde68a' : lv <= 4 ? '#fbbf24' : lv <= 8 ? '#f97316' : lv <= 15 ? '#dc2626' : '#7f1d1d');
  M.levelColors = [['1–2', '#fde68a'], ['3–4', '#fbbf24'], ['5–8', '#f97316'], ['9–15', '#dc2626'], ['16+', '#7f1d1d'], ['לא ידוע', '#a8b0bd']];
  SA.OSM_LU = {
    residential: ['#facc15', 'מגורים'], commercial: ['#c084fc', 'מסחר ומשרדים'], retail: ['#e879f9', 'קמעונאות'],
    industrial: ['#8b5cf6', 'תעשייה'], construction: ['#94a3b8', 'בבנייה'], religious: ['#a16207', 'דת'],
    cemetery: ['#65a30d', 'בית עלמין'], grass: ['#86efac', 'דשא / ירוק'], military: ['#64748b', 'צבאי'],
    farmland: ['#bef264', 'חקלאי'], orchard: ['#a3e635', 'מטעים'], brownfield: ['#d6d3d1', 'קרקע לא מנוצלת'], greenfield: ['#d9f99d', 'קרקע פנויה']
  };
  M.showFabric = function (fab) {
    ['figure', 'buildings', 'heritage', 'osmLanduse'].forEach((k) => L_[k].clearLayers());
    M._fabric = fab;
    fab.buildings.forEach((b) => {
      L.polygon(ll(b.geom), { pane: 'areaPane', renderer: canvas, stroke: false, fillColor: isDark() ? '#f8fafc' : '#111111', fillOpacity: 0.92, interactive: false }).addTo(L_.figure);
      L.polygon(ll(b.geom), { pane: 'areaPane', renderer: canvas, color: '#334155', weight: 0.4, fillColor: lvColor(b.levels), fillOpacity: 0.85 })
        .bindTooltip(b.levels ? `${Math.round(b.levels)} קומות` : 'מספר קומות לא ידוע', { sticky: true }).addTo(L_.buildings);
    });
    fab.heritage.forEach((h) => {
      const icon = L.divIcon({ className: 'poi-icon', html: `<span style="--c:${h.heritage ? '#9a3412' : '#0f766e'}">${h.heritage ? '🏛️' : '👁️'}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] });
      L.marker([h.lat, h.lon], { icon }).bindPopup(`<div class="pp"><b>${U.esc(h.name)}</b><span class="pp-sub">${U.esc(h.kind)}</span><span>${U.dist(h.dist)}</span></div>`).addTo(L_.heritage);
    });
    fab.landuse.forEach((u) => {
      const c = SA.OSM_LU[u.kind] || ['#cbd5e1', u.kind];
      L.polygon(ll(u.geom), { pane: 'areaPane', renderer: canvas, color: c[0], weight: 0.6, fillColor: c[0], fillOpacity: 0.3 })
        .bindTooltip(`${c[1]} (OSM) · ${U.int(u.area)} מ"ר`, { sticky: true }).addTo(L_.osmLanduse);
    });
  };

  M.showStatArea = function (a) {
    L_.statarea.clearLayers();
    if (!a || !a.rings || !a.rings.length) return;
    a.rings.forEach((r) => L.polygon(ll(r), { pane: 'linePane', color: '#9333ea', weight: 2.5, dashArray: '10 6', fillColor: '#c084fc', fillOpacity: 0.06, interactive: false }).addTo(L_.statarea));
    const c = centroid(a.rings[0]);
    label(c.lat, c.lon, `<span class="tag tag-stat">אזור ${U.esc(a.areaName || a.area || '')}${a.total ? ' · ' + U.int(a.total) + ' תושבים' : ''}</span>`, '', L_.statarea, [220, 22]);
  };
})(window.SA);

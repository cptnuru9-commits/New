/* =========================================================
   SiteLens — שכבת נתונים
   כל פונקציה מחזירה נתונים מנורמלים, או זורקת שגיאה בעברית.
   ========================================================= */
window.SA = window.SA || {};

(function (SA) {
  const U = SA.util;
  const C = () => SA.config;
  const API = (SA.api = {});

  /* ---------- קטגוריות שירותים ---------- */
  SA.CATS = {
    transit:   { label: 'תחבורה ציבורית', icon: '🚌', color: '#2563eb' },
    education: { label: 'חינוך',          icon: '🎓', color: '#d97706' },
    green:     { label: 'גנים ופארקים',   icon: '🌳', color: '#16a34a' },
    health:    { label: 'בריאות',         icon: '🩺', color: '#dc2626' },
    community: { label: 'ציבור וקהילה',   icon: '🏛️', color: '#7c3aed' },
    commerce:  { label: 'מסחר',           icon: '🛒', color: '#db2777' },
    parking:   { label: 'חניונים',        icon: '🅿️', color: '#475569' }
  };

  const SUB = {
    school: ['education', 'בית ספר'], kindergarten: ['education', 'גן ילדים'], childcare: ['education', 'מעון יום'],
    college: ['education', 'מכללה'], university: ['education', 'אוניברסיטה'],
    park: ['green', 'פארק'], garden: ['green', 'גינה'], playground: ['green', 'גן שעשועים'],
    nature_reserve: ['green', 'שמורת טבע'], pitch: ['green', 'מגרש ספורט'], sports_centre: ['green', 'מרכז ספורט'],
    hospital: ['health', 'בית חולים'], clinic: ['health', 'מרפאה / קופ"ח'], doctors: ['health', 'רופא'], pharmacy: ['health', 'בית מרקחת'],
    bus_stop: ['transit', 'תחנת אוטובוס'], station: ['transit', 'תחנת רכבת'], halt: ['transit', 'תחנת רכבת'],
    tram_stop: ['transit', 'רכבת קלה'], light_rail: ['transit', 'רכבת קלה'], bicycle_rental: ['transit', 'תחנת אופניים'],
    library: ['community', 'ספרייה'], community_centre: ['community', 'מתנ"ס / מרכז קהילתי'], townhall: ['community', 'עירייה / מועצה'],
    police: ['community', 'משטרה'], fire_station: ['community', 'כבאות'], post_office: ['community', 'דואר'],
    place_of_worship: ['community', 'מבנה דת'], theatre: ['community', 'תיאטרון'], arts_centre: ['community', 'מרכז אמנות'],
    supermarket: ['commerce', 'סופרמרקט'], mall: ['commerce', 'קניון'], marketplace: ['commerce', 'שוק'],
    parking: ['parking', 'חניון']
  };

  /* =========================================================
     גיאוקודינג
     ========================================================= */
  const nominatim = U.rateLimit(1100);
  API.geocode = async function (q) {
    const url = `${C().nominatim}/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=il&accept-language=he&q=${encodeURIComponent(q)}`;
    const data = await nominatim(() => U.fetchJSON(url, { timeout: 12000, retries: 2 }));
    return data.map((r) => ({ lat: +r.lat, lon: +r.lon, label: r.display_name, type: r.type }));
  };

  API.suggest = async function (q) {
    const url = `${C().photon}?q=${encodeURIComponent(q)}&limit=7&bbox=34.2,29.45,35.95,33.35`;
    const data = await U.fetchJSON(url, { timeout: 8000 });
    return (data.features || []).map((f) => {
      const p = f.properties || {};
      const main = p.name || [p.street, p.housenumber].filter(Boolean).join(' ');
      const sub = [p.street && p.name ? [p.street, p.housenumber].filter(Boolean).join(' ') : '', p.district, p.city || p.county]
        .filter(Boolean).join(', ');
      return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], main: main || sub, sub, label: [main, sub].filter(Boolean).join(', ') };
    });
  };

  API.reverse = async function (lat, lon) {
    const key = `rev:${lat.toFixed(5)},${lon.toFixed(5)}`;
    const hit = await U.pcache.get(key);
    if (hit) return hit;
    const url = `${C().nominatim}/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=he&lat=${lat}&lon=${lon}`;
    const r = await nominatim(() => U.fetchJSON(url, { timeout: 12000, retries: 2 }));
    const a = r.address || {};
    const out = {
      label: r.display_name,
      street: [a.road || a.pedestrian || a.footway, a.house_number].filter(Boolean).join(' '),
      neighbourhood: a.neighbourhood || a.suburb || a.quarter || '',
      city: a.city || a.town || a.village || a.municipality || a.county || '',
      district: a.state_district || a.state || '',
      postcode: a.postcode || ''
    };
    U.pcache.set(key, out, 30);
    return out;
  };

  /* =========================================================
     גוש / חלקה — המרכז למיפוי ישראל (GovMap opendata)
     ========================================================= */
  const pickKey = (obj, re) => Object.keys(obj || {}).find((k) => re.test(k));
  const pickVal = (obj, re) => { const k = pickKey(obj, re); return k ? obj[k] : undefined; };

  function normParcel(props) {
    return {
      gush: pickVal(props, /^gush(_?num)?$|^gush/i),
      helka: pickVal(props, /^(parcel|helka)(_?num)?$/i),
      area: pickVal(props, /legal_?area|^area$|shape_?area/i),
      status: pickVal(props, /status_?text|status/i),
      locality: pickVal(props, /locality|yishuv|settl/i),
      raw: props
    };
  }

  function ringsITMtoLatLng(geom) {
    if (!geom) return [];
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
    return polys.map((p) => p[0].map(([x, y]) => U.fromITM(x, y)));
  }
  function containsITM(geom, x, y) {
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
    return polys.some((p) => U.pointInRing(x, y, p[0]));
  }

  API.parcel = async function (lat, lon) {
    const key = `parcel:${lat.toFixed(6)},${lon.toFixed(6)}`;
    const hit = await U.pcache.get(key);
    if (hit) return hit;
    const res = await parcelFetch(lat, lon);
    U.pcache.set(key, res, 30);
    return res;
  };
  async function parcelFetch(lat, lon) {
    const itm = U.toITM(lat, lon);
    if (!itm) throw new Error('ספריית ההמרה ל-ITM לא נטענה');
    const d = 40;
    const bbox = `${itm.x - d},${itm.y - d},${itm.x + d},${itm.y + d}`;
    const layer = C().parcelLayer;
    let features = [];
    try {
      const url = `${C().govmapWfs}?service=WFS&version=1.0.0&request=GetFeature&typeName=${layer}` +
        `&outputFormat=application/json&srsName=EPSG:2039&bbox=${bbox},EPSG:2039&maxFeatures=25`;
      features = (await U.fetchViaProxy(url, { timeout: 12000, retries: 1 })).features || [];
    } catch (e) {
      // גיבוי: WMS GetFeatureInfo
      const url = `${C().govmapWms}?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=${layer}&query_layers=${layer}` +
        `&srs=EPSG:2039&bbox=${itm.x - 50},${itm.y - 50},${itm.x + 50},${itm.y + 50}&width=101&height=101&X=50&Y=50` +
        `&info_format=application/json&feature_count=3`;
      features = (await U.fetchViaProxy(url, { timeout: 12000, retries: 1 })).features || [];
    }
    if (!features.length) throw new Error('לא נמצאה חלקה בנקודה זו');
    const hit = features.find((f) => f.geometry && containsITM(f.geometry, itm.x, itm.y)) || features[0];
    return { ...normParcel(hit.properties), rings: ringsITMtoLatLng(hit.geometry) };
  }

  API.parcelByNumber = async function (gush, helka) {
    const layer = C().parcelLayer;
    const filters = [
      `GUSH_NUM=${gush} AND PARCEL=${helka}`,
      `GUSH_NUM=${gush} AND PARCEL_NUM=${helka}`,
      `GUSH=${gush} AND HELKA=${helka}`
    ];
    for (const f of filters) {
      try {
        const url = `${C().govmapWfs}?service=WFS&version=1.0.0&request=GetFeature&typeName=${layer}` +
          `&outputFormat=application/json&srsName=EPSG:2039&maxFeatures=1&CQL_FILTER=${encodeURIComponent(f)}`;
        const data = await U.fetchViaProxy(url);
        const feat = (data.features || [])[0];
        if (!feat) continue;
        const rings = ringsITMtoLatLng(feat.geometry);
        const ring = rings[0] || [];
        const c = ring.reduce((a, p) => ({ lat: a.lat + p.lat / ring.length, lon: a.lon + p.lon / ring.length }), { lat: 0, lon: 0 });
        return { lat: c.lat, lon: c.lon, ...normParcel(feat.properties), rings };
      } catch (e) { /* ננסה שמות שדות אחרים */ }
    }
    throw new Error('לא נמצאה חלקה — ניתן לחפש ישירות ב-GovMap');
  };

  /* =========================================================
     תכניות (תב"ע) — מנהל התכנון, XPLAN
     ========================================================= */
  const PLAN_FIELDS = {
    number: /^pl_number$|מספר.?ה?תכנית|plan_?num|^pl_num/i,
    name: /^pl_name$|שם.?ה?תכנית|plan_?name/i,
    status: /station_desc|^status|סטטוס|מצב.?תכנית|^station$/i,
    date: /pl_date_8|pl_date|date_?advert|תאריך/i,
    landuse: /landuse|ייעוד/i,
    area: /area_dunam|dunam|שטח/i,
    url: /pl_url|^url$|קישור/i,
    authority: /by_auth|סמכות/i,
    county: /county|מרחב.?תכנון/i,
    type: /entity_subtype|סוג.?תכנית/i,
    objectives: /objectives|מטרות/i
  };

  function normPlan(attrs, aliases, layerName) {
    const lookup = (re) => {
      for (const k of Object.keys(attrs)) {
        if (re.test(k) || re.test(aliases[k] || '')) {
          const v = attrs[k];
          if (v !== null && v !== '' && v !== 'Null') return v;
        }
      }
      return undefined;
    };
    const p = { layer: layerName, raw: attrs, aliases };
    for (const [k, re] of Object.entries(PLAN_FIELDS)) p[k] = lookup(re);
    if (typeof p.date === 'number' && p.date > 1e11) p.date = new Date(p.date).toLocaleDateString('he-IL');
    else if (typeof p.date === 'string' && /^\d{8}$/.test(p.date)) p.date = `${p.date.slice(6, 8)}/${p.date.slice(4, 6)}/${p.date.slice(0, 4)}`;
    if (p.url && !/^https?:/i.test(p.url)) p.url = undefined;
    return p;
  }

  API.planStatusClass = (s) => {
    s = String(s || '');
    if (/אישור|מאושר|בתוקף|פורסמה למתן תוקף/.test(s)) return 'ok';
    if (/הפקד|דיון|הכנה|בהליך|בבדיקה|קליטה/.test(s)) return 'warn';
    if (/נדח|בוטל|ביטול/.test(s)) return 'bad';
    return 'neutral';
  };

  async function layerIndex(service) {
    const data = await U.arcgis(service + '/layers', {});
    const idx = {};
    for (const l of data.layers || []) {
      const aliases = {};
      (l.fields || []).forEach((f) => (aliases[f.name] = f.alias));
      idx[l.id] = { id: l.id, name: l.name, aliases, type: l.type };
    }
    return idx;
  }

  API.plans = async function (lat, lon, radius) {
    const svc = C().xplan;
    const idx = await layerIndex(svc).catch(() => ({}));
    const d = 0.0008;
    const idf = await U.arcgis(svc + '/identify', {
      geometry: `${lon},${lat}`,
      geometryType: 'esriGeometryPoint',
      sr: 4326,
      layers: 'all',
      tolerance: 2,
      mapExtent: `${lon - d},${lat - d},${lon + d},${lat + d}`,
      imageDisplay: '600,600,96',
      returnGeometry: true,
      returnFieldName: true
    });

    const atSite = [], others = [], seen = new Set(), planLayerIds = new Set();
    for (const r of idf.results || []) {
      const meta = idx[r.layerId] || { aliases: {}, name: r.layerName };
      const p = normPlan(r.attributes || {}, meta.aliases, r.layerName);
      if (p.number) {
        planLayerIds.add(r.layerId);
        if (seen.has(p.number)) continue;
        seen.add(p.number);
        p.rings = (r.geometry && r.geometry.rings ? r.geometry.rings : []).map((ring) => ring.map(([x, y]) => ({ lat: y, lon: x })));
        atSite.push(p);
      } else {
        others.push({ layer: r.layerName, attrs: r.attributes, aliases: meta.aliases });
      }
    }

    // תכניות בסביבה
    let ids = [...planLayerIds];
    if (!ids.length) ids = Object.values(idx).filter((l) => /תכני|קו.?כחול|plan/i.test(l.name) && l.type !== 'Group Layer').map((l) => l.id).slice(0, 2);
    const dLat = radius / 111320, dLon = radius / (111320 * Math.cos((lat * Math.PI) / 180));
    const nearby = [];
    const qs = await Promise.allSettled(ids.map((id) => U.arcgis(`${svc}/${id}/query`, {
      where: '1=1',
      geometry: `${lon - dLon},${lat - dLat},${lon + dLon},${lat + dLat}`,
      geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects',
      outFields: '*', returnGeometry: false
    }).then((q) => ({ id, q }))));
    for (const r of qs) {
      if (r.status !== 'fulfilled') continue;
      const { id, q } = r.value;
      try {
        const aliases = (idx[id] && idx[id].aliases) || {};
        (q.features || []).forEach((f) => {
          const p = normPlan(f.attributes || {}, aliases, idx[id] && idx[id].name);
          if (p.number && !seen.has(p.number)) { seen.add(p.number); nearby.push(p); }
        });
      } catch (e) { /* שכבה לא זמינה */ }
    }
    const rank = { ok: 0, warn: 1, neutral: 2, bad: 3 };
    nearby.sort((a, b) => rank[API.planStatusClass(a.status)] - rank[API.planStatusClass(b.status)]);
    return { atSite, nearby, others };
  };

  /* =========================================================
     גילוי שכבות אוטומטי בשירותי ArcGIS (לפי שם השכבה)
     ========================================================= */
  API.layerIndex = layerIndex;
  const servicesRoot = (url) => url.split('/rest/services')[0] + '/rest/services';

  /** כל שכבות ה-MapServer בתיקייה (ובתתי-תיקיות עד עומק 1) */
  API.discover = async function (folderUrl, svcFilter = /.*/, depth = 1) {
    const key = 'disc:' + folderUrl + svcFilter;
    const hit = await U.pcache.get(key);
    if (hit) return hit;
    const root = servicesRoot(folderUrl);
    const out = [];
    const walk = async (url, d) => {
      const f = await U.arcgis(url, {});
      const svcs = (f.services || []).filter((x) => x.type === 'MapServer' && svcFilter.test(x.name)).slice(0, 15);
      // במקביל — במקום בזה אחר זה (חוסך עשרות שניות)
      await Promise.allSettled(svcs.map(async (sv) => {
        const surl = `${root}/${sv.name}/MapServer`;
        const idx = await layerIndex(surl);
        Object.values(idx).forEach((l) => out.push({ svc: surl, ...l }));
      }));
      if (d > 0) await Promise.allSettled((f.folders || []).slice(0, 10).map((fo) => walk(`${root}/${fo}`, d - 1)));
    };
    await walk(folderUrl, depth);
    U.pcache.set(key, out, 14);
    return out;
  };

  async function layersOf(urls) {
    const out = [];
    await Promise.allSettled(urls.map(async (u) => Object.values(await layerIndex(u)).forEach((l) => out.push({ svc: u, ...l }))));
    return out;
  }

  async function queryLayer(l, lat, lon, radius) {
    const dLat = radius / 111320, dLon = radius / (111320 * Math.cos((lat * Math.PI) / 180));
    const q = await U.arcgis(`${l.svc}/${l.id}/query`, {
      where: '1=1', outFields: '*', returnGeometry: true, outSR: 4326,
      geometry: `${lon - dLon},${lat - dLat},${lon + dLon},${lat + dLat}`,
      geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects'
    });
    return (q.features || []).slice(0, 300).map((f) => ({ attrs: f.attributes || {}, geom: f.geometry || {}, layer: l.name, aliases: l.aliases || {} }));
  }
  const ringsLL = (g) => (g.rings || []).map((r) => r.map(([x, y]) => ({ lat: y, lon: x })));
  const pathsLL = (g) => (g.paths || []).map((r) => r.map(([x, y]) => ({ lat: y, lon: x })));
  const attrText = (attrs, aliases, re) => {
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (typeof v === 'string' && v.trim() && (re.test(k) || re.test(aliases[k] || ''))) return v.trim();
    }
    return '';
  };

  /* ---------- ייעודי קרקע (צבעי מבא"ת בקירוב) ---------- */
  const LU = [
    [/שצ"?פ|ציבורי.?פתוח|open.?space|גן.?ציבורי|פארק/i, '#22c55e', 'שצ״פ'],
    [/שפ"?פ|פרטי.?פתוח/i, '#86efac', 'שפ״פ'],
    [/מבנים?.?ומוסדות.?ציבור|מבני.?ציבור|שב"?צ|public.?build/i, '#a16207', 'מבני ציבור'],
    [/דרך|רחוב|road|חניה|מסילה/i, '#ef4444', 'דרך'],
    [/מגורים.?(ומסחר|ותעסוקה)|מעורב|mixed/i, '#fb923c', 'מעורב'],
    [/מגורים|residential/i, '#facc15', 'מגורים'],
    [/מסחר|commercial|תעסוקה|משרד/i, '#c084fc', 'מסחר / תעסוקה'],
    [/תעשי|industr/i, '#8b5cf6', 'תעשייה'],
    [/מלונאות|תיירות|hotel/i, '#fb7185', 'תיירות'],
    [/ספורט|נופש/i, '#4ade80', 'ספורט ונופש'],
    [/חקלא/i, '#bef264', 'חקלאי'],
    [/יער|שמורה|נחל|נוף/i, '#15803d', 'שטח פתוח / נוף'],
    [/מתקנים.?הנדסיים|תשתית/i, '#64748b', 'תשתיות']
  ];
  API.landuseClass = (txt) => {
    for (const [re, color, group] of LU) if (re.test(txt)) return { color, group, open: group === 'שצ״פ' };
    return { color: '#94a3b8', group: 'אחר', open: false };
  };

  const isTelAviv = (lat, lon) => lat > 32.03 && lat < 32.15 && lon > 34.74 && lon < 34.86;

  /** ייעודי קרקע, שצ"פ, קווי בניין ומגרשים — משכבות התכנון הזמינות */
  API.planDetails = async function (lat, lon) {
    const cfg = C();
    let layers = [];
    try { layers = await API.discover(cfg.planFolder); } catch (e) { /* תיקייה חסומה */ }
    const extra = [cfg.xplan, ...(cfg.extraPlanServices || [])];
    if (isTelAviv(lat, lon)) extra.push(cfg.telAvivGis);
    const known = new Set(layers.map((l) => l.svc));
    layers = layers.concat(await layersOf(extra.filter((u) => u && !known.has(u))));
    if (!layers.length) throw new Error('שירותי התכנון לא זמינים');

    const pick = (re, not) => layers.filter((l) => l.type !== 'Group Layer' && re.test(l.name) && !(not && not.test(l.name))).slice(0, 3);
    const luLayers = pick(/ייעוד|יעוד|שימושי.?קרקע|land.?use|zoning/i, /קו.?בני/);
    const blLayers = pick(/קו.?בני|קווי.?בני|building.?line|setback/i);
    const lotLayers = pick(/מגרש|\blots?\b|\bplots?\b/i);

    const landuse = [], lines = [], lots = [];
    const settled = async (ls, r) => (await Promise.allSettled(ls.map((l) => queryLayer(l, lat, lon, r).then((fs) => ({ l, fs })))))
      .filter((x) => x.status === 'fulfilled').map((x) => x.value);
    const [luRes, blRes, lotRes] = await Promise.all([settled(luLayers, 300), settled(blLayers, 80), settled(lotLayers, 60)]);
    for (const { l, fs } of luRes) {
      try {
        fs.forEach((f) => {
          const txt = attrText(f.attrs, f.aliases, /ייעוד|יעוד|landuse|land_use|mavat_name|use|desc|תיאור|שם/i) || f.layer;
          const rings = ringsLL(f.geom);
          if (!rings.length) return;
          const area = rings.reduce((s, r) => s + U.areaM2(r), 0);
          landuse.push({ designation: txt, ...API.landuseClass(txt), rings, area, dist: rings.some((r) => U.pointInRing(lon, lat, r.map((q) => [q.lon, q.lat]))) ? 0 : Math.min(...rings.map((r) => U.distToLine({ lat, lon }, r))), layer: l.name, attrs: f.attrs, aliases: f.aliases });
        });
      } catch (e) { /* layer failed */ }
    }
    for (const { l, fs } of blRes) {
      try {
        fs.forEach((f) => {
          const paths = pathsLL(f.geom).concat(ringsLL(f.geom));
          if (paths.length) lines.push({ paths, label: attrText(f.attrs, f.aliases, /קו|סוג|type|desc|מרחק/i), layer: l.name, attrs: f.attrs, aliases: f.aliases });
        });
      } catch (e) { /* skip */ }
    }
    for (const { l, fs } of lotRes) {
      try {
        fs.forEach((f) => {
          const rings = ringsLL(f.geom);
          if (!rings.length) return;
          const num = Object.entries(f.attrs).find(([k]) => /מגרש|lot|plot|num|מספר/i.test(k) || /מגרש/.test(f.aliases[k] || ''));
          lots.push({ rings, number: num ? num[1] : '', contains: rings.some((r) => U.pointInRing(lon, lat, r.map((p) => [p.lon, p.lat]))), layer: l.name });
        });
      } catch (e) { /* skip */ }
    }
    landuse.sort((a, b) => a.dist - b.dist);
    return {
      landuse, lines, lots: lots.sort((a, b) => b.contains - a.contains),
      searched: { landuse: luLayers.map((l) => l.name), lines: blLayers.map((l) => l.name), lots: lotLayers.map((l) => l.name) },
      layerCount: layers.length
    };
  };

  /* רחובות סמוכים — לזיהוי חזית המגרש */
  API.streets = async function (lat, lon) {
    const q = `[out:json][timeout:20];
way["highway"]["highway"!~"^(footway|path|steps|cycleway|track|corridor|bridleway|proposed|construction)$"](around:120,${lat},${lon});
out geom;`;
    const data = await API.overpass(q);
    return (data.elements || []).filter((e) => e.geometry).map((e) => ({
      name: (e.tags && (e.tags['name:he'] || e.tags.name)) || '',
      cls: e.tags && e.tags.highway,
      geom: e.geometry.map((g) => ({ lat: g.lat, lon: g.lon }))
    }));
  };

  /* היתרי בנייה — GIS עירוני תל אביב-יפו (גילוי שכבה לפי שם) */
  API.telAvivPermits = async function (lat, lon, radius = 120) {
    const svc = C().telAvivGis;
    const idx = await layerIndex(svc);
    const layers = Object.values(idx).filter((l) => /היתר|רישוי/.test(l.name) && l.type !== 'Group Layer').slice(0, 2);
    if (!layers.length) throw new Error('לא נמצאה שכבת היתרים');
    const dLat = radius / 111320, dLon = radius / (111320 * Math.cos((lat * Math.PI) / 180));
    const out = [];
    for (const l of layers) {
      const q = await U.arcgis(`${svc}/${l.id}/query`, {
        where: '1=1', outFields: '*', returnGeometry: false,
        geometry: `${lon - dLon},${lat - dLat},${lon + dLon},${lat + dLat}`,
        geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects'
      });
      (q.features || []).slice(0, 40).forEach((f) => out.push({ layer: l.name, attrs: f.attributes, aliases: l.aliases }));
    }
    return out;
  };

  /* =========================================================
     Overpass — שירותים, תחבורה, סביבה, מרקם
     השאילתות מחולקות לחלקים קטנים שרצים במקביל, כל אחת נשלחת
     לשרת אחד ועוברת לשרת גיבוי אם הוא איטי (hedged), ונשמרת במטמון.
     ========================================================= */
  API.overpass = async function (query, { ttl = 5 } = {}) {
    const key = 'ovp:' + query;
    const hit = await U.pcache.get(key);
    if (hit) return hit;
    const mirrors = C().overpass;
    const data = await U.hedged(mirrors.map((url) => (signal) => U.fetchJSON(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
      timeout: 28000, retries: 1, signal
    })), { hedgeMs: 6000 });
    if (data && data.remark && /runtime error|timed out/i.test(data.remark) && !(data.elements || []).length) throw new Error('השאילתה כבדה מדי לשרת');
    U.pcache.set(key, data, ttl);
    return data;
  };

  const nameOf = (t, fallback) => t['name:he'] || t.name || fallback;
  const geomOf = (el) => (el.geometry || []).map((g) => ({ lat: g.lat, lon: g.lon }));
  const minDist = (arr) => arr.reduce((m, x) => Math.min(m, x.dist), Infinity);
  const rnd = (v) => Math.round(v * 2e4) / 2e4; // ~5 מ' — לשיפור פגיעות במטמון

  API.poi = async function (lat, lon, radius) {
    lat = rnd(lat); lon = rnd(lon);
    const R = radius, R2 = Math.max(radius, 2500), at = `${lat},${lon}`;
    const amen = '^(school|kindergarten|childcare|college|university|hospital|clinic|doctors|pharmacy|library|community_centre|townhall|police|fire_station|post_office|place_of_worship|theatre|arts_centre|marketplace|bicycle_rental|parking)$';
    const q = `[out:json][timeout:25];
way["leisure"~"^(park|garden|nature_reserve|playground)$"](around:${R},${at});
out geom;
(
  nwr["amenity"~"${amen}"](around:${R},${at});
  node["leisure"~"^(park|garden|playground|sports_centre|pitch|nature_reserve)$"](around:${R},${at});
  way["leisure"~"^(sports_centre|pitch)$"](around:${Math.min(R, 800)},${at});
  relation["leisure"~"^(park|nature_reserve)$"](around:${R},${at});
  nwr["shop"~"^(supermarket|mall)$"](around:${R},${at});
  node["highway"="bus_stop"](around:${R},${at});
  nwr["railway"~"^(station|halt|tram_stop)$"](around:${R2},${at});
);
out center tags qt;`;
    const data = await API.overpass(q);
    const site = { lat, lon };
    const items = [], parks = [], seen = new Set();
    for (const el of data.elements || []) {
      const t = el.tags || {};
      const uid = el.type + el.id;
      if (seen.has(uid)) continue;
      seen.add(uid);
      let sub = t.amenity || t.leisure || t.shop || (t.highway === 'bus_stop' ? 'bus_stop' : '') || t.railway;
      if (t.railway === 'station' && /light_rail|subway|tram/.test(t.station || '')) sub = 'light_rail';
      if (!SUB[sub]) continue;
      const [cat, subLabel] = SUB[sub];
      let p;
      if (el.geometry && el.type === 'way') {
        const ring = geomOf(el);
        p = ring.reduce((a, q2) => ({ lat: a.lat + q2.lat / ring.length, lon: a.lon + q2.lon / ring.length }), { lat: 0, lon: 0 });
        if (/park|garden|nature_reserve|playground/.test(sub)) parks.push({ name: nameOf(t, subLabel), ring, area: U.areaM2(ring), sub });
      } else if (el.center) p = { lat: el.center.lat, lon: el.center.lon };
      else p = { lat: el.lat, lon: el.lon };
      if (p.lat == null) continue;
      items.push({
        id: uid, cat, sub, subLabel, name: nameOf(t, subLabel), lat: p.lat, lon: p.lon, dist: U.haversine(site, p),
        routes: t.route_ref || '', operator: t.operator || '', tags: t
      });
    }
    items.sort((a, b) => a.dist - b.dist);
    return { items, parks };
  };

  /** סביבה: מים וקו חוף + דרכים, רכבות, שדות תעופה ושבילי אופניים (רעש ונגישות) */
  API.environment = async function (lat, lon) {
    lat = rnd(lat); lon = rnd(lon);
    const at = `${lat},${lon}`, site = { lat, lon };
    const qWater = `[out:json][timeout:25];
way["natural"="coastline"](around:5000,${at});
out geom;
way["waterway"~"^(river|stream|canal|wadi)$"](around:1500,${at});
out geom;
way["natural"="water"]["water"!~"^(pond|basin|wastewater|swimming_pool|reflecting_pool)$"](around:1500,${at});
out geom;`;
    const qMove = `[out:json][timeout:25];
way["highway"~"^(motorway|trunk|primary|secondary)$"](around:1000,${at});
out geom;
node["highway"="motorway_junction"](around:4000,${at});
out;
way["railway"~"^(rail|light_rail|subway)$"](around:1000,${at});
out geom;
nwr["aeroway"="aerodrome"](around:8000,${at});
out center tags;
way["highway"="cycleway"](around:800,${at});
out geom;
way["cycleway"~"^(lane|track)$"](around:800,${at});
out geom;`;
    const [w, m] = await Promise.allSettled([API.overpass(qWater, { ttl: 30 }), API.overpass(qMove, { ttl: 10 })]);
    if (w.status === 'rejected' && m.status === 'rejected') throw m.reason;
    const out = { coast: [], rivers: [], water: [], roads: [], junctions: [], rail: [], airports: [], cycle: [], partial: w.status === 'rejected' || m.status === 'rejected' };
    for (const el of (w.value && w.value.elements) || []) {
      const t = el.tags || {}, geom = geomOf(el);
      if (t.natural === 'coastline') out.coast.push({ geom, dist: U.distToLine(site, geom) });
      else if (t.waterway) out.rivers.push({ geom, name: nameOf(t, 'נחל / ערוץ'), kind: t.waterway, dist: U.distToLine(site, geom) });
      else if (t.natural === 'water') {
        const area = U.areaM2(geom);
        if (area > 3000) out.water.push({ geom, name: nameOf(t, 'גוף מים'), area, dist: U.distToLine(site, geom) });
      }
    }
    for (const el of (m.value && m.value.elements) || []) {
      const t = el.tags || {}, geom = geomOf(el);
      if (t.aeroway) out.airports.push({ name: nameOf(t, 'שדה תעופה'), dist: U.haversine(site, el.center || el) });
      else if (t.highway === 'motorway_junction') out.junctions.push({ name: nameOf(t, 'מחלף'), ref: t.ref || '', lat: el.lat, lon: el.lon, dist: U.haversine(site, el) });
      else if (t.railway) out.rail.push({ geom, kind: t.railway, name: nameOf(t, ''), dist: U.distToLine(site, geom) });
      else if (t.highway === 'cycleway' || t.cycleway) out.cycle.push({ geom, len: geom.reduce((s, p, i) => (i ? s + U.haversine(geom[i - 1], p) : 0), 0) });
      else if (t.highway) out.roads.push({ geom, cls: t.highway, ref: t.ref || '', name: nameOf(t, ''), dist: U.distToLine(site, geom), lanes: +t.lanes || null });
    }
    out.coastDist = minDist(out.coast);
    out.riverDist = minDist(out.rivers);
    out.waterDist = minDist(out.water);
    out.junctions.sort((a, b) => a.dist - b.dist);
    const groups = new Map();
    for (const r of out.roads) {
      const key = r.ref || r.name || r.cls;
      const g = groups.get(key);
      if (!g || r.dist < g.dist) groups.set(key, { ...r, key });
    }
    out.roadGroups = [...groups.values()].sort((a, b) => a.dist - b.dist);
    out.cycleKm = out.cycle.reduce((s, c) => s + c.len, 0) / 1000;

    // רעש — אומדן לפי מרחק ממקורות (כביש מהיר/ראשי, מסילה, שדה תעופה)
    const near = (cls) => minDist(out.roads.filter((r) => cls.test(r.cls)));
    const sources = [
      { label: 'כביש מהיר / דרך ראשית', d: near(/motorway|trunk/), lim: [150, 400] },
      { label: 'עורק ראשי', d: near(/primary/), lim: [40, 120] },
      { label: 'עורק משני', d: near(/secondary/), lim: [20, 60] },
      { label: 'מסילת רכבת', d: minDist(out.rail.filter((r) => r.kind === 'rail')), lim: [100, 300] },
      { label: 'רכבת קלה', d: minDist(out.rail.filter((r) => r.kind !== 'rail')), lim: [20, 60] },
      { label: 'שדה תעופה', d: minDist(out.airports), lim: [2000, 5000] }
    ].map((x) => ({ ...x, level: x.d <= x.lim[0] ? 2 : x.d <= x.lim[1] ? 1 : 0 }));
    const lvl = Math.max(0, ...sources.map((x) => x.level));
    out.noise = { level: lvl, label: ['נמוך', 'בינוני', 'גבוה'][lvl], sources: sources.filter((x) => isFinite(x.d)).sort((a, b) => b.level - a.level || a.d - b.d) };
    return out;
  };

  /** מרקם עירוני: מבנים (דמות-רקע, גובה, תכסית), שימושי קרקע ב-OSM, מורשת ושימור */
  API.fabric = async function (lat, lon) {
    lat = rnd(lat); lon = rnd(lon);
    const at = `${lat},${lon}`, site = { lat, lon };
    const qB = `[out:json][timeout:25];
way["building"](around:300,${at});
out geom qt;`;
    const qL = `[out:json][timeout:25];
way["landuse"~"^(residential|commercial|retail|industrial|construction|religious|cemetery|grass|military|farmland|orchard|brownfield|greenfield)$"](around:500,${at});
out geom qt;
nwr["historic"](around:1000,${at});
out center tags qt;
nwr["heritage"](around:1000,${at});
out center tags qt;
nwr["tourism"~"^(viewpoint|museum|artwork|attraction)$"](around:1000,${at});
out center tags qt;`;
    const [b, l] = await Promise.allSettled([API.overpass(qB, { ttl: 14 }), API.overpass(qL, { ttl: 14 })]);
    if (b.status === 'rejected' && l.status === 'rejected') throw b.reason;
    const out = { buildings: [], landuse: [], heritage: [], partial: b.status === 'rejected' || l.status === 'rejected' };
    for (const el of (b.value && b.value.elements) || []) {
      const t = el.tags || {}, geom = geomOf(el);
      if (geom.length < 3) continue;
      const levels = parseFloat(t['building:levels']) || (t.height ? parseFloat(t.height) / 3.2 : null);
      const c = geom.reduce((a, p) => ({ lat: a.lat + p.lat / geom.length, lon: a.lon + p.lon / geom.length }), { lat: 0, lon: 0 });
      out.buildings.push({ geom, levels, area: U.areaM2(geom), use: t.building, name: t.name || '', dist: U.haversine(site, c), year: t.start_date || t['building:year'] || '' });
    }
    const seen = new Set();
    for (const el of (l.value && l.value.elements) || []) {
      const t = el.tags || {};
      if (seen.has(el.type + el.id)) continue;
      seen.add(el.type + el.id);
      if (t.landuse && el.geometry) {
        const geom = geomOf(el);
        out.landuse.push({ geom, kind: t.landuse, area: U.areaM2(geom) });
      } else if (t.historic || t.heritage || t.tourism) {
        const p = el.center || el;
        if (p.lat == null) continue;
        const kind = t.historic ? ({ archaeological_site: 'אתר ארכאולוגי', monument: 'אנדרטה', memorial: 'אתר הנצחה', building: 'מבנה היסטורי', ruins: 'חורבה', castle: 'מבצר', city_gate: 'שער עיר' }[t.historic] || 'אתר היסטורי')
          : t.heritage ? 'מבנה לשימור / מורשת' : ({ viewpoint: 'נקודת תצפית', museum: 'מוזיאון', artwork: 'אמנות ציבורית', attraction: 'אטרקציה' }[t.tourism]);
        out.heritage.push({ name: nameOf(t, kind), kind, lat: p.lat, lon: p.lon, dist: U.haversine(site, p), heritage: !!(t.heritage || t.historic) });
      }
    }
    out.heritage.sort((a, x) => a.dist - x.dist);

    // מורפולוגיה ברדיוס 250 מ'
    const R = 250, circle = Math.PI * R * R;
    const bs = out.buildings.filter((x) => x.dist <= R);
    const withLv = bs.filter((x) => x.levels);
    const avgLv = withLv.length ? withLv.reduce((s, x) => s + x.levels, 0) / withLv.length : null;
    const hist = [0, 0, 0, 0, 0];
    withLv.forEach((x) => hist[x.levels <= 2 ? 0 : x.levels <= 4 ? 1 : x.levels <= 8 ? 2 : x.levels <= 15 ? 3 : 4]++);
    out.morph = {
      count: bs.length,
      coverage: bs.reduce((s, x) => s + x.area, 0) / circle,
      avgLevels: avgLv,
      maxLevels: withLv.reduce((mx, x) => Math.max(mx, x.levels), 0) || null,
      far: bs.reduce((s, x) => s + x.area * (x.levels || avgLv || 1), 0) / circle,
      levelsKnown: withLv.length,
      avgFootprint: bs.length ? bs.reduce((s, x) => s + x.area, 0) / bs.length : null,
      hist
    };
    const lu = {};
    out.landuse.forEach((x) => (lu[x.kind] = (lu[x.kind] || 0) + x.area));
    out.landuseMix = Object.entries(lu).sort((a, x) => x[1] - a[1]);
    return out;
  };

  /* =========================================================
     טופוגרפיה, אקלים ואיזוכרונים
     ========================================================= */
  API.elevation = async function (lat, lon) {
    const step = 120;
    const pts = [{ lat, lon }];
    for (let b = 0; b < 360; b += 45) pts.push(U.destination({ lat, lon }, b, step));
    const url = `${C().openMeteoElevation}?latitude=${pts.map((p) => p.lat.toFixed(6)).join(',')}&longitude=${pts.map((p) => p.lon.toFixed(6)).join(',')}`;
    const data = await U.fetchJSON(url, { timeout: 12000, retries: 2 });
    const e = data.elevation || [];
    const [c, n, ne, east, se, s, sw, w, nw] = e;
    // שיפוע: הפרשים מרכזיים (צירים + אלכסונים, ממוצע משוקלל)
    const diag = 2 * step * Math.SQRT1_2;
    const dzdx = (2 * (east - w) / (2 * step) + (ne - nw) / diag + (se - sw) / diag) / 4;
    const dzdy = (2 * (n - s) / (2 * step) + (nw - sw) / diag + (ne - se) / diag) / 4;
    const slope = Math.hypot(dzdx, dzdy);
    const aspect = (Math.atan2(-dzdx, -dzdy) * 180) / Math.PI;
    return {
      elevation: c,
      slopePct: slope * 100,
      aspect: (aspect + 360) % 360,
      min: Math.min(...e), max: Math.max(...e),
      samples: e
    };
  };

  API.climate = async function (lat, lon) {
    const y = new Date().getFullYear() - 1;
    const url = `${C().openMeteoArchive}?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&start_date=${y}-01-01&end_date=${y}-12-31` +
      `&hourly=wind_speed_10m,wind_direction_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&wind_speed_unit=ms&timezone=Asia%2FJerusalem`;
    const key = 'clim:' + url;
    const hit = await U.pcache.get(key);
    if (hit) return hit;
    const d = await U.fetchJSON(url, { timeout: 25000, retries: 2 });

    // שושנת רוחות — 16 כיוונים × 4 טווחי מהירות
    const bins = [2, 4, 6, Infinity];
    const rose = Array.from({ length: 16 }, () => [0, 0, 0, 0]);
    const ws = d.hourly.wind_speed_10m, wd = d.hourly.wind_direction_10m;
    let n = 0, calm = 0, sum = 0;
    for (let i = 0; i < ws.length; i++) {
      if (ws[i] == null || wd[i] == null) continue;
      n++; sum += ws[i];
      if (ws[i] < 0.5) { calm++; continue; }
      const sec = Math.round(wd[i] / 22.5) % 16;
      rose[sec][bins.findIndex((b) => ws[i] < b)]++;
    }
    const roseP = rose.map((r) => r.map((v) => (v / n) * 100));
    const totals = roseP.map((r) => r.reduce((a, b) => a + b, 0));
    const prevailing = totals.indexOf(Math.max(...totals)) * 22.5;

    // חודשי
    const months = Array.from({ length: 12 }, () => ({ tmax: 0, tmin: 0, rain: 0, n: 0 }));
    d.daily.time.forEach((t, i) => {
      const m = +t.slice(5, 7) - 1;
      months[m].tmax += d.daily.temperature_2m_max[i] || 0;
      months[m].tmin += d.daily.temperature_2m_min[i] || 0;
      months[m].rain += d.daily.precipitation_sum[i] || 0;
      months[m].n++;
    });
    const monthly = months.map((m) => ({ tmax: m.tmax / m.n, tmin: m.tmin / m.n, rain: m.rain }));
    const out = {
      year: y, rose: roseP, prevailing, calm: (calm / n) * 100, meanSpeed: sum / n,
      monthly, annualRain: monthly.reduce((s, m) => s + m.rain, 0)
    };
    U.pcache.set(key, out, 60);
    return out;
  };

  API.isochrone = async function (lat, lon) {
    const body = { locations: [{ lat, lon }], costing: 'pedestrian', contours: [{ time: 5 }, { time: 10 }, { time: 15 }], polygons: true };
    const url = `${C().valhalla}/isochrone?json=${encodeURIComponent(JSON.stringify(body))}`;
    const key = 'iso:' + url;
    const hit = await U.pcache.get(key);
    if (hit) return hit;
    const data = await U.fetchJSON(url, { timeout: 15000, retries: 1 });
    if (!data.features) throw new Error('אין איזוכרונים');
    U.pcache.set(key, data, 30);
    return data;
  };

  /* =========================================================
     אוכלוסייה — Wikidata (נתוני למ"ס) + data.gov.il
     ========================================================= */
  API.city = async function (lat, lon) {
    const url = `${C().nominatim}/reverse?format=jsonv2&zoom=10&extratags=1&namedetails=1&accept-language=he&lat=${lat}&lon=${lon}`;
    const key = 'city:' + lat.toFixed(3) + ',' + lon.toFixed(3);
    const hit = await U.pcache.get(key);
    if (hit) return { ...hit };
    const r = await nominatim(() => U.fetchJSON(url, { timeout: 12000, retries: 2 }));
    const x = r.extratags || {};
    const out = {
      name: (r.namedetails && (r.namedetails['name:he'] || r.namedetails.name)) || r.name,
      wikidata: x.wikidata,
      osmPopulation: x.population ? +x.population : null,
      osmPopulationDate: x['population:date'] || x['source:population'] || '',
      website: x.website || ''
    };
    U.pcache.set(key, out, 30);
    return { ...out };
  };

  API.wikidata = async function (qid) {
    const url = `${C().wikidata}?action=wbgetentities&ids=${qid}&props=claims|labels|sitelinks&languages=he|en&format=json&origin=*`;
    const key = 'wd:' + qid;
    let data = await U.pcache.get(key);
    if (!data) { data = await U.fetchJSON(url, { timeout: 12000, retries: 2 }); U.pcache.set(key, data, 30); }
    const ent = data.entities && data.entities[qid];
    if (!ent) throw new Error('לא נמצא ב-Wikidata');
    const cl = ent.claims || {};
    const amount = (c) => c && c.mainsnak && c.mainsnak.datavalue && parseFloat(c.mainsnak.datavalue.value.amount);
    const byYear = new Map();
    (cl.P1082 || []).forEach((c) => {
      const v = amount(c);
      const q = c.qualifiers && c.qualifiers.P585 && c.qualifiers.P585[0].datavalue;
      const yr = q ? parseInt(q.value.time.slice(1, 5), 10) : null;
      if (v && yr && (!byYear.has(yr) || c.rank === 'preferred')) byYear.set(yr, v);
    });
    const series = [...byYear.entries()].map(([year, value]) => ({ year, value })).sort((a, b) => a.year - b.year);
    const area = amount((cl.P2046 || [])[0]);
    const inc = (cl.P571 || [])[0];
    const founded = inc && inc.mainsnak.datavalue ? parseInt(inc.mainsnak.datavalue.value.time.slice(1, 5), 10) : null;
    const elev = amount((cl.P2044 || [])[0]);
    const he = ent.sitelinks && ent.sitelinks.hewiki;
    return {
      label: (ent.labels.he || ent.labels.en || {}).value,
      series, area, founded, elevation: elev,
      latest: series[series.length - 1] || null,
      wiki: he ? `https://he.wikipedia.org/wiki/${encodeURIComponent(he.title.replace(/ /g, '_'))}` : null
    };
  };

  API.ckanPopulation = async function (city) {
    const base = C().ckan;
    const ps = await U.fetchViaProxy(`${base}/package_search?q=${encodeURIComponent('אוכלוסייה יישובים')}&rows=6`);
    const pkgs = (ps.result && ps.result.results) || [];
    const token = city.split(/[\s\-–]/)[0];
    for (const p of pkgs) {
      for (const r of p.resources || []) {
        if (!r.datastore_active) continue;
        try {
          const ds = await U.fetchViaProxy(`${base}/datastore_search?resource_id=${r.id}&q=${encodeURIComponent(token)}&limit=3`);
          const recs = (ds.result && ds.result.records) || [];
          if (recs.length) return { dataset: p.title, resource: r.name || r.id, url: `https://data.gov.il/dataset/${p.name}`, records: recs };
        } catch (e) { /* next */ }
      }
    }
    throw new Error('לא נמצאו רשומות');
  };
})(window.SA);

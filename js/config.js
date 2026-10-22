/* =========================================================
   SiteLens — הגדרות מקורות מידע
   כל כתובת כאן ניתנת לעריכה מתוך חלון "הגדרות" באתר
   (נשמר בדפדפן), כך שאם שירות ממשלתי משנה כתובת אפשר
   לעדכן בלי לגעת בקוד.
   ========================================================= */
window.SA = window.SA || {};

(function (SA) {
  SA.VERSION = '2026.10.22c';

  /* ---------- מסך שגיאה ידידותי (במקום דף שבור) ---------- */
  SA.fatal = function (msg) {
    if (document.getElementById('fatal')) return;
    const d = document.createElement('div');
    d.id = 'fatal';
    d.setAttribute('role', 'alert');
    d.style.cssText = 'position:fixed;inset:auto 12px 12px 12px;z-index:99999;background:#fff;color:#17191a;border:1px solid #e6e4dd;border-radius:16px;box-shadow:0 18px 50px -18px rgb(0 0 0/45%);padding:14px 16px;font:15px/1.5 Heebo,system-ui,sans-serif;direction:rtl;display:flex;gap:12px;align-items:center;max-width:560px;margin:auto';
    d.innerHTML = '<div style="flex:1"><b>משהו השתבש בטעינת האתר</b><div style="font-size:13px;color:#7d827f">' +
      String(msg || '').replace(/[<>&]/g, '') + '</div></div>' +
      '<button style="border:0;background:#0f766e;color:#fff;border-radius:99px;padding:8px 16px;font:inherit;font-weight:700;cursor:pointer">טעינה מחדש</button>';
    d.querySelector('button').onclick = () => {
      try { sessionStorage.removeItem('sitelens.heal'); } catch (e) { /* ignore */ }
      location.replace(location.pathname + '?v=' + SA.VERSION + '-' + Date.now() + location.hash);
    };
    (document.body || document.documentElement).appendChild(d);
  };
  // שגיאה לפני שהאתר סיים לעלות ← מסך שגיאה; אחרי — רק ביומן
  window.addEventListener('error', (e) => {
    if (!SA.ready && e.error) SA.fatal(e.message);
  });
  const DEFAULTS = {
    // גיאוקודינג (OpenStreetMap)
    nominatim: 'https://nominatim.openstreetmap.org',
    photon: 'https://photon.komoot.io/api/',

    // Overpass — שירותים, תחבורה, סביבה (מספר שרתים לגיבוי)
    overpass: [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.private.coffee/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
    ],

    // מנהל התכנון — תכניות (קווים כחולים / XPLAN)
    xplan: 'https://ags.iplan.gov.il/arcgisiplan/rest/services/PlanningPublic/Xplan/MapServer',

    // תיקיית שירותי התכנון — סריקה אוטומטית לשכבות ייעודי קרקע / קווי בניין / מגרשים
    planFolder: 'https://ags.iplan.gov.il/arcgisiplan/rest/services/PlanningPublic',
    // שירותי MapServer נוספים (למשל GIS עירוני) לסריקה — שורה לכל כתובת
    extraPlanServices: [],

    // למ"ס — שורשי שירותי GIS לסריקת שכבת אזורים סטטיסטיים (מפקד)
    statRoots: [
      'https://gis.cbs.gov.il/arcgis/rest/services',
      'https://gis.cbs.gov.il/server/rest/services'
    ],

    // GovMap / המרכז למיפוי ישראל — שכבות פתוחות (גושים וחלקות)
    govmapWfs: 'https://open.govmap.gov.il/geoserver/opendata/wfs',
    govmapWms: 'https://open.govmap.gov.il/geoserver/opendata/wms',
    parcelLayer: 'opendata:PARCEL_ALL',
    subGushLayer: 'opendata:SUB_GUSH_ALL',

    // מידע ממשלתי פתוח (למ"ס ועוד)
    ckan: 'https://data.gov.il/api/3/action',
    wikidata: 'https://www.wikidata.org/w/api.php',

    // אקלים וטופוגרפיה
    openMeteoArchive: 'https://archive-api.open-meteo.com/v1/archive',
    openMeteoElevation: 'https://api.open-meteo.com/v1/elevation',

    // איזוכרונים (זמני הליכה)
    valhalla: 'https://valhalla1.openstreetmap.de',

    // אריחי גבהים (Terrarium) — לחישוב קווי גובה על המפה
    terrainTiles: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',

    // GIS עירוני — תל אביב-יפו (היתרי בנייה ועוד)
    telAvivGis: 'https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer',

    // פרוקסי CORS אופציונלי (למשל http://localhost:8080/?url=) — ריק = ללא
    corsProxy: ''
  };

  const KEY = 'sitelens.config.v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }

  SA.configDefaults = DEFAULTS;
  SA.config = Object.assign({}, DEFAULTS, saved);

  SA.saveConfig = function (patch) {
    Object.assign(SA.config, patch);
    const diff = {};
    for (const k of Object.keys(SA.config)) {
      if (JSON.stringify(SA.config[k]) !== JSON.stringify(DEFAULTS[k])) diff[k] = SA.config[k];
    }
    try { localStorage.setItem(KEY, JSON.stringify(diff)); } catch (e) { /* ignore */ }
  };

  SA.resetConfig = function () {
    SA.config = Object.assign({}, DEFAULTS);
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  };
})(window.SA);

/* =========================================================
   SiteLens — הגדרות מקורות מידע
   כל כתובת כאן ניתנת לעריכה מתוך חלון "הגדרות" באתר
   (נשמר בדפדפן), כך שאם שירות ממשלתי משנה כתובת אפשר
   לעדכן בלי לגעת בקוד.
   ========================================================= */
window.SA = window.SA || {};

(function (SA) {
  const DEFAULTS = {
    // גיאוקודינג (OpenStreetMap)
    nominatim: 'https://nominatim.openstreetmap.org',
    photon: 'https://photon.komoot.io/api/',

    // Overpass — שירותים, תחבורה, סביבה (מספר שרתים לגיבוי)
    overpass: [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.private.coffee/api/interpreter'
    ],

    // מנהל התכנון — תכניות (קווים כחולים / XPLAN)
    xplan: 'https://ags.iplan.gov.il/arcgisiplan/rest/services/PlanningPublic/Xplan/MapServer',

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

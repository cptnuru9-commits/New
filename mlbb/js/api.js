/*
 * Live statistics. Runs in the user's browser and reads the public MLBB statistics
 * (official Moonton data, exposed by the community "mlbb-stats" API).
 * The base URL is configurable in Settings, so a mirror/proxy can be used.
 * Parsing is defensive: it walks the JSON and picks the known field names wherever they sit.
 */
const API_DEFAULT_BASES = [
  "https://mlbb-stats.ridwaanhall.com/api/",
  "https://mlbb-stats.ridwaanhall.com/api/mlbb/",
];
const CACHE_TTL = 6 * 3600 * 1000;

const Api = {
  bases() {
    const custom = (localStorage.getItem("mlbb.apiBase") || "").trim();
    return custom ? [custom.endsWith("/") ? custom : custom + "/"] : API_DEFAULT_BASES;
  },

  async getJson(path, { cache = true } = {}) {
    const ck = "mlbb.cache." + path;
    if (cache) {
      try {
        const c = JSON.parse(localStorage.getItem(ck) || "null");
        if (c && Date.now() - c.t < CACHE_TTL) return c.v;
      } catch (_) {}
    }
    let lastErr;
    for (const base of this.bases()) {
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 15000);
        const r = await fetch(base + path, { signal: ctrl.signal, headers: { Accept: "application/json" } });
        clearTimeout(to);
        if (!r.ok) throw new Error("HTTP " + r.status);
        const v = await r.json();
        try { localStorage.setItem(ck, JSON.stringify({ t: Date.now(), v })); } catch (_) {}
        return v;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("no API base");
  },

  /* Collect every object that looks like a hero statistics record. */
  findRecords(json, predicate) {
    const out = [];
    const walk = (o, depth) => {
      if (!o || typeof o !== "object" || depth > 12) return;
      if (Array.isArray(o)) { o.forEach((x) => walk(x, depth + 1)); return; }
      if (predicate(o)) { out.push(o); return; }
      Object.values(o).forEach((x) => walk(x, depth + 1));
    };
    walk(json, 0);
    return out;
  },

  deepGet(o, keys) {
    let found;
    const walk = (x, d) => {
      if (found !== undefined || !x || typeof x !== "object" || d > 8) return;
      for (const k of keys) if (x[k] !== undefined && typeof x[k] !== "object") { found = x[k]; return; }
      Object.values(x).forEach((v) => walk(v, d + 1));
    };
    walk(o, 0);
    return found;
  },

  pct(v) {
    const n = Number(v);
    if (!isFinite(n)) return null;
    return n <= 1 ? n * 100 : n;
  },

  /* Hero ranking: win / pick / ban rate for every hero. */
  async heroRank({ days = 7, rank = "mythic" } = {}) {
    const q = `hero-rank/?days=${days}&rank=${rank}&size=300&index=1&sort_field=win_rate&sort_order=desc`;
    const json = await this.getJson(q);
    const recs = this.findRecords(json, (o) => "main_hero_win_rate" in o || "win_rate" in o && ("ban_rate" in o || "appearance_rate" in o));
    const rows = recs.map((r) => {
      const name = this.deepGet(r.main_hero || r, ["name", "hero_name"]);
      const head = this.deepGet(r.main_hero || r, ["head", "smallmap", "image"]);
      const id = r.main_heroid ?? this.deepGet(r, ["main_heroid", "heroid", "hero_id"]);
      return {
        id, name, head,
        win: this.pct(r.main_hero_win_rate ?? r.win_rate),
        pick: this.pct(r.main_hero_appearance_rate ?? r.appearance_rate ?? r.pick_rate),
        ban: this.pct(r.main_hero_ban_rate ?? r.ban_rate),
      };
    }).filter((x) => x.name && x.win != null);
    if (!rows.length) throw new Error("לא נמצאו רשומות בתשובת ה-API");
    return rows;
  },

  /* Parse lists of related heroes (sub_hero = best, sub_hero_last = worst). */
  parseRelated(json) {
    const res = { best: [], worst: [] };
    const recs = this.findRecords(json, (o) => Array.isArray(o.sub_hero) || Array.isArray(o.sub_hero_last));
    const conv = (arr) => (arr || []).map((s) => ({
      id: s.heroid ?? this.deepGet(s, ["heroid", "hero_id"]),
      name: this.deepGet(s, ["name", "hero_name"]),
      head: this.deepGet(s, ["head", "image"]),
      delta: this.pct(s.increase_win_rate ?? s.win_rate),
    }));
    if (recs[0]) { res.best = conv(recs[0].sub_hero); res.worst = conv(recs[0].sub_hero_last); }
    return res;
  },
  async counters(id, { days = 7, rank = "mythic" } = {}) {
    return this.parseRelated(await this.getJson(`hero-counter/${id}/?days=${days}&rank=${rank}`));
  },
  async compatibility(id, { days = 7, rank = "mythic" } = {}) {
    return this.parseRelated(await this.getJson(`hero-compatibility/${id}/?days=${days}&rank=${rank}`));
  },

  clearCache() {
    Object.keys(localStorage).filter((k) => k.startsWith("mlbb.cache.")).forEach((k) => localStorage.removeItem(k));
  },
};

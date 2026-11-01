/* MLBB Meta — UI logic */
const TIER_COLORS = { S: "var(--S)", A: "var(--A)", B: "var(--B)", C: "var(--C)", D: "var(--D)" };
const TIER_META_SCORE = { S: 5, A: 4, B: 3, C: 2, D: 1 };
const state = { live: null, liveByKey: {}, liveError: null, lane: "all", role: "all", sort: "score", allies: {}, enemies: [] };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (v) => (v == null ? "—" : v.toFixed(1) + "%");

/* ---------- hero helpers ---------- */
function allHeroes() {
  const list = HEROES.map((h) => ({ ...h, stats: state.liveByKey[h.key] || null }));
  // heroes that exist in live data but not in the curated list
  if (state.live) state.live.forEach((r) => {
    const k = normName(r.name);
    if (!HERO_BY_KEY[k]) list.push({ name: r.name, key: k, roles: [], lanes: [], metaTier: null, strongAgainst: [], weakAgainst: [], synergy: [], builds: {}, stats: r, unknown: true });
  });
  return list;
}
function heroByName(n) { return allHeroes().find((h) => h.key === normName(n)); }
function avatar(h, cls = "") {
  const head = h.stats && h.stats.head;
  if (head) return `<img class="av ${cls}" src="${esc(head)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  let hash = 0; for (const c of h.name) hash = (hash * 31 + c.charCodeAt(0)) % 360;
  const ini = h.name.split(/[\s-]/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return `<span class="av ${cls}" style="background:hsl(${hash} 55% 38%)">${esc(ini)}</span>`;
}
function damageType(h) {
  if (h.roles.includes("Tank") && !h.roles.includes("Mage")) return "tank";
  const b = Object.values(h.builds)[0] || "";
  return /mage|magic/.test(b) ? "magic" : "physical";
}

/* ---------- scoring / tiers ---------- */
function weightedScore(s) {
  // Win rate dominates; presence (pick+ban) rewards contested heroes.
  return (s.win - 50) * 2 + Math.sqrt(Math.max(0, s.pick)) * 2 + Math.sqrt(Math.max(0, s.ban)) * 1.5;
}
function assignTiers(list, key) {
  const sorted = list.slice().sort((a, b) => b._v - a._v);
  const n = sorted.length;
  sorted.forEach((h, i) => {
    const p = i / n;
    h._tier = p < 0.1 ? "S" : p < 0.3 ? "A" : p < 0.65 ? "B" : p < 0.9 ? "C" : "D";
  });
  return sorted;
}

/* ---------- live data ---------- */
async function loadLive() {
  const st = $("#live-status");
  st.className = "status"; st.textContent = "טוען נתונים חיים…";
  try {
    const rows = await Api.heroRank({ days: $("#f-days").value, rank: $("#f-rank").value });
    state.live = rows; state.liveError = null;
    state.liveByKey = Object.fromEntries(rows.map((r) => [normName(r.name), r]));
    st.className = "status live"; st.textContent = `● נתונים חיים · ${rows.length} דמויות`;
  } catch (e) {
    state.live = null; state.liveByKey = {}; state.liveError = e.message || String(e);
    st.className = "status off"; st.textContent = "● אין חיבור לנתונים חיים";
  }
  renderAll();
}

/* ---------- tier list ---------- */
function renderTier() {
  const lane = state.lane, sort = $("#tier-sort").value;
  let list = allHeroes().filter((h) => lane === "all" || h.lanes.includes(lane) || (h.unknown && lane === "all"));
  const live = !!state.live && sort !== "meta";
  const hint = $("#tier-hint");
  if (live) {
    list = list.filter((h) => h.stats);
    list.forEach((h) => (h._v = sort === "score" ? weightedScore(h.stats) : h.stats[sort]));
    hint.textContent = `טיר מחושב מנתונים חיים (${$("#f-rank").selectedOptions[0].text}, ${$("#f-days").selectedOptions[0].text}) לפי ${$("#tier-sort").selectedOptions[0].text}: S = 10% העליונים, A = 20% הבאים, B = 35%, C = 25%, D = 10%.`;
  } else {
    list = list.filter((h) => h.metaTier);
    list.forEach((h) => (h._v = TIER_META_SCORE[h.metaTier] + (h.stats ? h.stats.win / 1000 : 0)));
    hint.textContent = state.live
      ? `הערכת מטא קהילתית (${META_INFO.patch}, עודכן ${META_INFO.updated}) לפי mlbbhub, timesaver, mlbbdex ו-elitedias.`
      : `⚠️ אין כרגע חיבור לנתונים החיים, ולכן מוצג טיר לפי הסכמה בין אתרי הסטטיסטיקה הגדולים (${META_INFO.patch}, עודכן ${META_INFO.updated}), בלי אחוזים. פרטים בלשונית 'מקורות והגדרות'.`;
  }
  const sorted = live ? assignTiers(list) : list.sort((a, b) => b._v - a._v).map((h) => ((h._tier = h.metaTier), h));
  const out = $("#tier-out");
  if (!sorted.length) { out.innerHTML = `<p class="hint">אין דמויות להצגה.</p>`; return; }

  if ($("#tier-table").checked) {
    out.innerHTML = `<table><thead><tr><th>#</th><th>טיר</th><th>דמות</th><th>ליינים</th><th>ווין רייט</th><th>פיק רייט</th><th>באן רייט</th></tr></thead><tbody>${
      sorted.map((h, i) => `<tr data-hero="${esc(h.name)}"><td>${i + 1}</td><td><span class="tb" style="background:${TIER_COLORS[h._tier]}">${h._tier}</span></td>
      <td>${avatar(h, "sm")} ${esc(h.name)}</td><td>${h.lanes.map((l) => LANE_HE[l]).join(", ")}</td>
      <td>${fmt(h.stats?.win)}</td><td>${fmt(h.stats?.pick)}</td><td>${fmt(h.stats?.ban)}</td></tr>`).join("")}</tbody></table>`;
  } else {
    out.innerHTML = ["S", "A", "B", "C", "D"].map((t) => {
      const hs = sorted.filter((h) => h._tier === t);
      if (!hs.length) return "";
      return `<div class="tier-row"><div class="tier-badge" style="background:${TIER_COLORS[t]}">${t}</div><div class="tier-heroes">${hs.map(heroCard).join("")}</div></div>`;
    }).join("");
  }
}
function heroCard(h) {
  const s = h.stats;
  const st = s ? `WR ${fmt(s.win)}<br>PR ${fmt(s.pick)} · BR ${fmt(s.ban)}` : h.lanes.map((l) => LANE_HE[l]).join(" / ");
  return `<div class="hcard" data-hero="${esc(h.name)}">${avatar(h)}<div class="nm">${esc(h.name)}</div><div class="st">${st}</div></div>`;
}

/* ---------- hero grid ---------- */
function renderHeroes() {
  const q = normName($("#hero-search").value);
  const list = allHeroes().filter((h) => (!q || h.key.includes(q)) && (state.role === "all" || h.roles.includes(state.role)))
    .sort((a, b) => a.name.localeCompare(b.name));
  $("#hero-grid").innerHTML = list.map(heroCard).join("") || `<p class="hint">לא נמצאו דמויות.</p>`;
}

/* ---------- hero modal ---------- */
function miniList(names, extra) {
  if (!names.length) return `<span class="hint">אין נתונים</span>`;
  return `<div class="mini">${names.map((n) => {
    const h = heroByName(n) || { name: n, stats: null };
    return `<span class="mh" data-hero="${esc(h.name)}">${avatar(h, "sm")}${esc(h.name)}${extra ? `<em>${extra(n)}</em>` : ""}</span>`;
  }).join("")}</div>`;
}
function openHero(name) {
  const h = heroByName(name);
  if (!h) return;
  const s = h.stats;
  // reverse relations from the curated DB
  const alsoWeak = HEROES.filter((x) => x.strongAgainst.includes(h.name)).map((x) => x.name);
  const alsoStrong = HEROES.filter((x) => x.weakAgainst.includes(h.name)).map((x) => x.name);
  const uniq = (a) => [...new Set(a)].filter((n) => n !== h.name);
  const weak = uniq([...h.weakAgainst, ...alsoWeak]).slice(0, 8);
  const strong = uniq([...h.strongAgainst, ...alsoStrong]).slice(0, 8);
  const syn = uniq([...h.synergy, ...HEROES.filter((x) => x.synergy.includes(h.name)).map((x) => x.name)]).slice(0, 8);
  const lanes = h.lanes.length ? h.lanes : [];

  $("#modal-body").innerHTML = `
    <div class="hhead">${avatar(h)}<div><h2>${esc(h.name)}</h2>
      <div>${h.roles.map((r) => `<span class="pill">${ROLE_HE[r] || r}</span>`).join("")}${lanes.map((l) => `<span class="pill">${LANE_HE[l]}</span>`).join("")}
      ${h.metaTier ? `<span class="pill">מטא קהילתי: <b>${h.metaTier}</b></span>` : ""}</div></div></div>
    <div class="stats">
      <div class="stat"><b>${fmt(s?.win)}</b><small>ווין רייט</small></div>
      <div class="stat"><b>${fmt(s?.pick)}</b><small>פיק רייט</small></div>
      <div class="stat"><b>${fmt(s?.ban)}</b><small>באן רייט</small></div>
    </div>
    ${h.unknown ? `<p class="warn">הדמות הזו מופיעה בנתונים החיים אבל עדיין אין לה מידע ערוך (קאונטרים/בילד) במאגר.</p>` : ""}
    <div class="cols">
      <div class="box"><h4>🛡️ קאונטרים — מי חזק נגדו</h4>${miniList(weak)}</div>
      <div class="box"><h4>⚔️ הוא חזק נגד</h4>${miniList(strong)}</div>
      <div class="box"><h4>🤝 סינרגיה — עובדים טוב איתו</h4>${miniList(syn)}</div>
    </div>
    <div class="box"><h4>🔗 הדמות באתרי הסטטיסטיקה</h4><div class="mini">${extLinks(h)}</div></div>
    <p class="src">קאונטרים וסינרגיות למעלה: מאגר ערוך לפי ידע קהילתי (קבוע, לא מתעדכן לבד).</p>
    <div class="cols" id="live-rel"><div class="box loading">${s && s.id != null ? "טוען קאונטרים וסינרגיות מהנתונים החיים…" : "קאונטרים וסינרגיות חיים לא זמינים (אין חיבור ל-API)."}</div></div>
    ${lanes.length ? `<h3>🧰 בילד מומלץ לפי ליין</h3><div class="chips" id="build-lanes">${lanes.map((l, i) => `<button class="chip ${i ? "" : "on"}" data-bl="${l}">${LANE_HE[l]}</button>`).join("")}</div><div id="build-out"></div>` : ""}
  `;
  $("#modal").classList.remove("hidden");
  if (lanes.length) renderBuild(h, lanes[0]);
  $("#modal-body").querySelectorAll("[data-bl]").forEach((b) => b.onclick = () => {
    $("#modal-body").querySelectorAll("[data-bl]").forEach((x) => x.classList.toggle("on", x === b));
    renderBuild(h, b.dataset.bl);
  });
  if (s && s.id != null) loadLiveRelations(h);
}
function extLinks(h) {
  const slug = h.name.toLowerCase().replace(/['.]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const wiki = encodeURIComponent(h.name.replace(/ /g, "_"));
  return [["mlbbhub", `https://mlbbhub.com/heroes/${slug}`], ["mlbb.io", `https://mlbb.io/en/hero/${slug}`],
    ["Liquipedia", `https://liquipedia.net/mobilelegends/${wiki}`]]
    .map(([t, u]) => `<a class="mh" href="${u}" target="_blank" rel="noopener">${t} ↗</a>`).join("");
}
function renderBuild(h, lane) {
  const b = buildFor(h, lane);
  if (!b) { $("#build-out").innerHTML = `<p class="hint">אין בילד.</p>`; return; }
  $("#build-out").innerHTML = `<div class="box"><h4>${esc(b.label)} — ${LANE_HE[lane]}</h4>
    <ol class="items">${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ol>
    <p><b>אמבלם:</b> ${esc(b.emblem)}<br><b>ספל:</b> ${esc(b.spell)}</p>
    <p class="hint">💡 ${esc(b.note)}</p>
    <p class="src">בילד ארכיטיפי לפי המלצות קהילה. בדוק תמיד את שינויי הפאץ' האחרון ושנה פריטים לפי ההרכב היריב.</p></div>`;
}
async function loadLiveRelations(h) {
  const box = $("#live-rel");
  const opts = { days: $("#f-days").value, rank: $("#f-rank").value };
  const idName = Object.fromEntries((state.live || []).map((r) => [String(r.id), r.name]));
  const toNames = (arr) => arr.map((x) => x.name || idName[String(x.id)]).filter(Boolean);
  const delta = (arr) => (n) => { const x = arr.find((y) => (y.name || idName[String(y.id)]) === n); return x && x.delta != null ? (x.delta > 0 ? "+" : "") + x.delta.toFixed(1) + "%" : ""; };
  try {
    const [c, m] = await Promise.all([Api.counters(h.stats.id, opts), Api.compatibility(h.stats.id, opts)]);
    if (!box.isConnected) return;
    box.innerHTML = `
      <div class="box"><h4>📊 קאונטרים (נתונים חיים)</h4>${miniList(toNames(c.best), delta(c.best))}</div>
      <div class="box"><h4>📊 שותפים הכי טובים (נתונים חיים)</h4>${miniList(toNames(m.best), delta(m.best))}</div>
      <div class="box"><h4>📊 שותפים הכי גרועים (נתונים חיים)</h4>${miniList(toNames(m.worst), delta(m.worst))}</div>`;
  } catch (e) {
    if (box.isConnected) box.innerHTML = `<div class="box hint">לא הצלחתי לטעון קאונטרים חיים: ${esc(e.message)}</div>`;
  }
}

/* ---------- team builder ---------- */
function slotInput(id, ph) { return `<input type="text" list="hero-names" id="${id}" placeholder="${ph}" autocomplete="off">`; }
function setupTeam() {
  $("#ally-slots").innerHTML = LANES.map((l) => `<div class="slot"><span>${LANE_HE[l]}</span>${slotInput("ally-" + l, "בחר דמות…")}</div>`).join("");
  $("#enemy-slots").innerHTML = [1, 2, 3, 4, 5].map((i) => `<div class="slot"><span>יריב ${i}</span>${slotInput("enemy-" + i, "דמות יריבה…")}</div>`).join("");
  document.querySelectorAll("#ally-slots input,#enemy-slots input").forEach((inp) => inp.addEventListener("input", renderTeam));
  $("#team-clear").onclick = () => { document.querySelectorAll("#ally-slots input,#enemy-slots input").forEach((i) => (i.value = "")); renderTeam(); };
}
function relScore(cand, allies, enemies) {
  let score = 0; const why = [];
  allies.forEach((a) => {
    if (cand.synergy.includes(a.name) || a.synergy.includes(cand.name)) { score += 3; why.push("סינרגיה עם " + a.name); }
  });
  enemies.forEach((e) => {
    if (cand.strongAgainst.includes(e.name) || e.weakAgainst.includes(cand.name)) { score += 3; why.push("קאונטר ל-" + e.name); }
    if (cand.weakAgainst.includes(e.name) || e.strongAgainst.includes(cand.name)) { score -= 3; why.push("חלש מול " + e.name); }
  });
  if (cand.stats) score += (cand.stats.win - 50) * 0.8 + Math.sqrt(cand.stats.ban) * 0.3;
  else if (cand.metaTier) score += (TIER_META_SCORE[cand.metaTier] - 3) * 1.2;
  return { score, why };
}
function renderTeam() {
  const allies = {}; LANES.forEach((l) => { const h = heroByName($("#ally-" + l).value); if (h) allies[l] = h; });
  const enemies = [1, 2, 3, 4, 5].map((i) => heroByName($("#enemy-" + i).value)).filter(Boolean);
  const allyList = Object.values(allies);
  const taken = new Set([...allyList, ...enemies].map((h) => h.key));

  // analysis
  const an = [];
  if (allyList.length) {
    const dmg = allyList.map(damageType);
    const mag = dmg.filter((d) => d === "magic").length, phys = dmg.filter((d) => d === "physical").length;
    const hasFront = allyList.some((h) => h.roles.includes("Tank") || (h.roles.includes("Fighter") && /tank|sustain/.test(Object.values(h.builds).join())));
    const hasHeal = allyList.some((h) => Object.values(h.builds).includes("support_heal"));
    an.push(hasFront ? `<p class="ok">✔ יש פרונטליין/טנק</p>` : `<p class="warn">⚠ אין טנק או פרונטליין — מומלץ לבחור טנק ברואם או ב-EXP</p>`);
    if (allyList.length >= 3 && (mag === 0 || phys === 0)) an.push(`<p class="warn">⚠ כל הנזק מאותו סוג (${mag ? "מג'יק" : "פיזי"}) — קל ליריב לבנות הגנה</p>`);
    else if (allyList.length >= 3) an.push(`<p class="ok">✔ איזון נזק: ${phys} פיזי / ${mag} מג'יק</p>`);
    if (hasHeal) an.push(`<p class="ok">✔ יש תמיכה/ריפוי בקבוצה</p>`);
    const pairs = [];
    for (let i = 0; i < allyList.length; i++) for (let j = i + 1; j < allyList.length; j++) {
      const a = allyList[i], b = allyList[j];
      if (a.synergy.includes(b.name) || b.synergy.includes(a.name)) pairs.push(`${a.name} + ${b.name}`);
    }
    if (pairs.length) an.push(`<p class="ok">🤝 סינרגיות בקבוצה: ${pairs.map(esc).join(" · ")}</p>`);
    enemies.forEach((e) => {
      const hurt = allyList.filter((a) => a.weakAgainst.includes(e.name) || e.strongAgainst.includes(a.name));
      if (hurt.length) an.push(`<p class="warn">⚠ ${esc(e.name)} מאיים על: ${hurt.map((h) => esc(h.name)).join(", ")}</p>`);
    });
  } else an.push(`<p class="hint">בחר דמויות לקבוצה שלך (ולמי שמולך, אם ידוע) כדי לקבל ניתוח והמלצות.</p>`);
  $("#team-analysis").innerHTML = an.join("");

  // recommendations for empty lanes
  const empty = LANES.filter((l) => !allies[l]);
  $("#team-recs").innerHTML = empty.map((l) => {
    const cands = allHeroes().filter((h) => h.lanes.includes(l) && !taken.has(h.key))
      .map((h) => ({ h, ...relScore(h, allyList, enemies) })).sort((a, b) => b.score - a.score).slice(0, 5);
    return `<div class="rec-lane"><h4>${LANE_HE[l]}</h4>${cands.map((c) => `<div class="rec" data-pick="${esc(c.h.name)}" data-lane="${l}">${avatar(c.h, "sm")}
      <div><b>${esc(c.h.name)}</b><div class="why">${esc(c.why.slice(0, 3).join(" · ") || (c.h.stats ? "WR " + fmt(c.h.stats.win) : "מטא " + (c.h.metaTier || "")))}</div></div>
      <span class="sc">${c.score.toFixed(1)}</span></div>`).join("")}</div>`;
  }).join("") || `<p class="ok">✔ הקבוצה מלאה.</p>`;
}
function renderDuos() {
  const score = (h) => (h.stats ? h.stats.win / 10 : 0) + TIER_META_SCORE[h.metaTier || "C"];
  const seen = new Set(), duos = [];
  allHeroes().filter((h) => h.metaTier).forEach((a) => a.synergy.forEach((n) => {
    const b = heroByName(n); if (!b) return;
    const k = [a.key, b.key].sort().join("|"); if (seen.has(k)) return; seen.add(k);
    const mutual = b.synergy.includes(a.name);
    duos.push({ a, b, s: score(a) + score(b) + (mutual ? 2 : 0) });
  }));
  duos.sort((x, y) => y.s - x.s);
  $("#duos").innerHTML = `<div class="mini">${duos.slice(0, 24).map((d) =>
    `<span class="mh" data-hero="${esc(d.a.name)}">${avatar(d.a, "sm")}${esc(d.a.name)} + ${esc(d.b.name)}${avatar(d.b, "sm")}</span>`).join("")}</div>
    <p class="src">מבוסס על מאגר הסינרגיות הערוך ועל דירוג המטא/ווין רייט החי.</p>`;
}

/* ---------- sources ---------- */
function renderSources() {
  $("#sources").innerHTML = `
    <h3>מאיפה הנתונים?</h3>
    <p><b>📊 סטטיסטיקה חיה (ווין רייט, פיק רייט, באן רייט, קאונטרים ושותפים):</b> הנתונים הרשמיים של Moonton מהמשחקים בדירוג
    (אותם נתונים שמוצגים באתר הרשמי <code>m.mobilelegends.com</code>). הם נטענים דרך ה-API הקהילתי הפתוח
    <code>mlbb-stats.ridwaanhall.com</code>. הדפדפן שלך טוען אותם ישירות, והם נשמרים במטמון ל-6 שעות.
    אפשר לסנן לפי דרגה ותקופה בראש הדף.</p>
    <p><b>🧠 ליינים, קאונטרים, סינרגיות ובילדים:</b> מאגר ערוך לפי ידע קהילתי (מדריכים, טורנירי MPL/MSC ודיונים בקהילה).
    הוא <u>לא</u> מתעדכן לבד. דמויות חדשות שעדיין לא נמצאות בו יופיעו בטיר ליסט מהנתונים החיים, אבל בלי בילד או קאונטרים ערוכים.</p>
    <p><b>🗂️ הערכת המטא (${META_INFO.patch}, עודכן ${META_INFO.updated}):</b> הסכמה בין אתרי הסטטיסטיקה הגדולים, בדומה ל-mlbb.gg:</p>
    <ul>${META_INFO.sources.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join("")}</ul>
    <p>בכל דף דמות יש קישורים ישירים לדמות ב-mlbbhub, ב-mlbb.io וב-Liquipedia, לבדיקת המספרים העדכניים ביותר.</p>
    <h3>מצב החיבור</h3>
    <p>${state.live ? `✅ מחובר. נטענו ${state.live.length} דמויות.` : `❌ לא מחובר${state.liveError ? ` (${esc(state.liveError)})` : ""}. ייתכן שה-API חסום ברשת שלך או שאינו זמין כרגע. אפשר להגדיר כתובת חלופית (מראה/פרוקסי) למטה.`}</p>
    <h3>הגדרות</h3>
    <p><label>כתובת API מותאמת: <input type="text" id="api-base" style="width:320px" placeholder="${API_DEFAULT_BASES[0]}" value="${esc(localStorage.getItem("mlbb.apiBase") || "")}"></label>
    <button class="btn" id="api-save">שמור וטען מחדש</button> <button class="btn ghost" id="cache-clear">נקה מטמון</button></p>
    <h3>התקנה באייפון</h3>
    <p>פתח את האתר ב-Safari, לחץ על כפתור השיתוף ובחר <b>"הוסף למסך הבית"</b>. האפליקציה תיפתח במסך מלא, כמו אפליקציה רגילה.</p>
    <p class="src">אתר מעריצים לא רשמי. Mobile Legends: Bang Bang הוא סימן מסחרי של Moonton.</p>`;
  $("#api-save").onclick = () => { localStorage.setItem("mlbb.apiBase", $("#api-base").value.trim()); Api.clearCache(); loadLive(); };
  $("#cache-clear").onclick = () => { Api.clearCache(); loadLive(); };
}

/* ---------- wiring ---------- */
function renderAll() {
  $("#hero-names").innerHTML = allHeroes().map((h) => `<option value="${esc(h.name)}">`).join("");
  renderTier(); renderHeroes(); renderTeam(); renderDuos(); renderSources();
}
function init() {
  $("#tier-lanes").innerHTML = [["all", "הכל"], ...LANES.map((l) => [l, LANE_HE[l]])].map(([v, t], i) => `<button class="chip ${i ? "" : "on"}" data-lane="${v}">${t}</button>`).join("");
  $("#hero-roles").innerHTML = [["all", "הכל"], ...Object.entries(ROLE_HE)].map(([v, t], i) => `<button class="chip ${i ? "" : "on"}" data-role="${v}">${t}</button>`).join("");
  $("#tier-lanes").onclick = (e) => { const b = e.target.closest("[data-lane]"); if (!b) return; state.lane = b.dataset.lane; $("#tier-lanes").querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === b)); renderTier(); };
  $("#hero-roles").onclick = (e) => { const b = e.target.closest("[data-role]"); if (!b) return; state.role = b.dataset.role; $("#hero-roles").querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === b)); renderHeroes(); };
  $("#tier-sort").onchange = renderTier; $("#tier-table").onchange = renderTier;
  $("#hero-search").oninput = renderHeroes;
  $("#f-rank").onchange = loadLive; $("#f-days").onchange = loadLive;
  document.querySelectorAll(".tabs button").forEach((b) => b.onclick = () => {
    document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("active", x === b));
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.id === "tab-" + b.dataset.tab));
  });
  document.body.addEventListener("click", (e) => {
    const pick = e.target.closest("[data-pick]");
    if (pick) { $("#ally-" + pick.dataset.lane).value = pick.dataset.pick; renderTeam(); return; }
    const h = e.target.closest("[data-hero]");
    if (h) openHero(h.dataset.hero);
  });
  $("#modal-close").onclick = () => $("#modal").classList.add("hidden");
  $("#modal").onclick = (e) => { if (e.target.id === "modal") $("#modal").classList.add("hidden"); };
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#modal").classList.add("hidden"); });
  setupTeam();
  renderAll();
  loadLive();
}
init();

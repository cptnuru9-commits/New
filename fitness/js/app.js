/* UI */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const r1 = (n) => Math.round(n * 10) / 10;
  const fmt = (n) => Math.round(n).toLocaleString('he-IL');

  const store = {
    get(k, d) { try { const v = localStorage.getItem('massa:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('massa:' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };

  const EXAMPLE = { sex: 'm', age: 24, height: 178, weight: 68, goal: 76, activity: 1.4, level: 'beg', days: 4, minutes: 60, equip: 'gym', bar: false, pace: 'std', meals: 5, diet: 'all' };
  const saved = store.get('profile', null);
  const S = {
    profile: saved || Object.assign({}, EXAMPLE),
    example: !saved,
    week: store.get('week', 1),
    day: 0,
    swaps: store.get('swaps', {}),
    weights: store.get('weights', []),
    logs: store.get('logs', {}),
    lib: 'all'
  };
  let T = null, PR = null;

  const LEVEL = { beg: 'מתחיל (עד שנה)', int: 'בינוני (1–3 שנים)', adv: 'מתקדם (3+ שנים)' };
  const EQUIP = { gym: 'חדר כושר', db: 'משקולות יד + ספסל', home: 'משקל גוף בבית' };

  // ---------- form ----------
  const form = $('#profileForm');
  function fillForm(p) {
    ['age', 'height', 'weight', 'goal', 'activity', 'minutes', 'meals'].forEach((k) => { const el = form.elements[k]; if (el) el.value = p[k] == null ? '' : p[k]; });
    ['sex', 'level', 'days', 'equip', 'pace', 'diet'].forEach((k) => {
      $$(`input[name="${k}"]`, form).forEach((r) => { r.checked = String(r.value) === String(p[k]); });
    });
    form.elements.bar.checked = !!p.bar;
    syncBar();
  }
  function readForm() {
    const f = form.elements;
    const val = (k) => { const r = $(`input[name="${k}"]:checked`, form); return r ? r.value : EXAMPLE[k]; };
    return {
      sex: val('sex'), age: +f.age.value, height: +f.height.value, weight: +f.weight.value, goal: f.goal.value ? +f.goal.value : '',
      activity: +f.activity.value, level: val('level'), days: +val('days'), minutes: +f.minutes.value, equip: val('equip'),
      bar: f.bar.checked, pace: val('pace'), meals: +f.meals.value, diet: val('diet')
    };
  }
  function syncBar() {
    const gym = ($('input[name="equip"]:checked', form) || {}).value === 'gym';
    $('#barRow').hidden = gym;
  }
  form.addEventListener('change', (e) => { if (e.target.name === 'equip') syncBar(); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const p = readForm();
    const err = [];
    if (!(p.age >= 14 && p.age <= 80)) err.push('גיל בין 14 ל-80');
    if (!(p.height >= 140 && p.height <= 220)) err.push('גובה בין 140 ל-220 ס״מ');
    if (!(p.weight >= 35 && p.weight <= 200)) err.push('משקל בין 35 ל-200 ק״ג');
    if (p.goal && p.goal <= p.weight) err.push('משקל היעד צריך להיות גבוה מהמשקל הנוכחי (או להשאיר ריק)');
    const box = $('#formError');
    if (err.length) { box.textContent = 'כדאי לתקן: ' + err.join(' · '); box.hidden = false; return; }
    box.hidden = true;
    S.profile = p; S.example = false;
    store.set('profile', p);
    renderAll();
    toast('התוכנית נבנתה לפי הנתונים שלך');
    $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#resetExample').addEventListener('click', () => { fillForm(EXAMPLE); });

  // ---------- summary ----------
  function renderSummary() {
    const p = S.profile, t = T;
    $('#exampleBadge').hidden = !S.example;
    $('#sumKcal').textContent = fmt(t.kcal);
    $('#sumGain').textContent = t.mode === 'recomp' ? 'שמירה על המשקל + בניית שריר' : `+${t.gainKgWeek.toFixed(2)} ק״ג לשבוע`;
    $('#sumRate').textContent = t.mode === 'recomp' ? 'ריקומפוזיציה' : `${t.rate}% ממשקל הגוף בשבוע`;
    const macros = [['p', 'חלבון', t.protein, 4, `${r1(t.protein / p.weight)} גרם לק״ג`], ['c', 'פחמימה', t.carbs, 4, `${r1(t.carbs / p.weight)} גרם לק״ג`], ['f', 'שומן', t.fat, 9, `${Math.round(t.fat * 9 / t.kcal * 100)}% מהקלוריות`]];
    $('#sumMacros').innerHTML = macros.map(([k, n, g, kc, sub]) => `
      <div class="macro m-${k}">
        <div class="macro-top"><span class="macro-name">${n}</span><span class="num">${g}<small> ג׳</small></span></div>
        <div class="macro-bar"><i style="width:${Math.round(g * kc / t.kcal * 100)}%"></i></div>
        <div class="macro-sub">${sub}</div>
      </div>`).join('');
    $('#sumEq').innerHTML = `
      <span><b class="num">${fmt(t.bmr)}</b> חילוף חומרים במנוחה</span><i>+</i>
      <span><b class="num">${fmt(t.tdee - t.bmr - t.train)}</b> פעילות יומית</span><i>+</i>
      <span><b class="num">${fmt(t.train)}</b> אימונים (ממוצע ליום)</span><i>+</i>
      <span class="eq-surplus"><b class="num">${fmt(t.surplus)}</b> עודף לבניית מסה</span><i>=</i>
      <span class="eq-total"><b class="num">${fmt(t.kcal)}</b> קלוריות ביום</span>`;
    const bmiTxt = t.bmi < 18.5 ? 'תת-משקל' : t.bmi < 25 ? 'תקין' : t.bmi < 30 ? 'עודף משקל' : 'השמנה';
    const notes = [];
    notes.push(`BMI <b class="num">${r1(t.bmi)}</b> (${bmiTxt}).`);
    if (t.mode === 'recomp') notes.push('ב-BMI מעל 27 עדיף לבנות שריר עם עודף קלורי קטן מאוד (ריקומפוזיציה). כך מצטבר הרבה פחות שומן.');
    else if (t.bmi < 18.5) notes.push('בתת-משקל אפשר לעלות מהר יותר. העודף הוגדל בהתאם.');
    if (p.age < 18) notes.push('מתחת לגיל 18 מומלץ להתאמן בהדרכה ולהתמקד בטכניקה.');
    if (p.goal && t.mode !== 'recomp') {
      const weeks = Math.ceil((p.goal - p.weight) / t.gainKgWeek);
      notes.push(`ליעד <b class="num">${p.goal}</b> ק״ג: בערך <b class="num">${weeks}</b> שבועות (${r1(weeks / 4.3)} חודשים) בקצב הזה.`);
    }
    $('#sumNotes').innerHTML = notes.join(' ');
    projectionChart();
  }

  // ---------- charts ----------
  const NS = 'http://www.w3.org/2000/svg';
  function niceTicks(min, max, n) {
    const span = max - min, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || mag * 10;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const out = []; for (let v = lo; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
    return out;
  }
  function attachTip(box, svg, points, fmtTip) {
    const tip = box.querySelector('.tip');
    const hair = svg.querySelector('.hair');
    const dot = svg.querySelector('.hdot');
    svg.addEventListener('pointermove', (e) => {
      const rc = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const x = (e.clientX - rc.left) / rc.width * vb.width;
      let best = points[0];
      points.forEach((p) => { if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p; });
      hair.setAttribute('x1', best.x); hair.setAttribute('x2', best.x); hair.style.opacity = 1;
      dot.setAttribute('cx', best.x); dot.setAttribute('cy', best.y); dot.style.opacity = 1;
      tip.innerHTML = fmtTip(best);
      tip.hidden = false;
      const px = best.x / vb.width * rc.width, py = best.y / vb.height * rc.height;
      tip.style.left = Math.min(rc.width - tip.offsetWidth - 4, Math.max(4, px - tip.offsetWidth / 2)) + 'px';
      tip.style.top = Math.max(0, py - tip.offsetHeight - 12) + 'px';
    });
    svg.addEventListener('pointerleave', () => { tip.hidden = true; hair.style.opacity = 0; dot.style.opacity = 0; });
  }

  function projectionChart() {
    const box = $('#projChart');
    const w0 = S.profile.weight, g = T.gainKgWeek;
    const data = []; for (let i = 0; i <= 12; i++) data.push({ wk: i, kg: w0 + g * i });
    const W = 360, H = 150, m = { l: 34, r: 12, t: 14, b: 24 };
    const ticks = niceTicks(w0 - 0.5, w0 + g * 12 + 0.5, 3);
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const X = (i) => m.l + (i / 12) * (W - m.l - m.r); // time runs left to right
    const Y = (v) => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
    const pts = data.map((d) => ({ x: X(d.wk), y: Y(d.kg), d }));
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
    const area = line + ` L${X(12)} ${Y(y0)} L${X(0)} ${Y(y0)} Z`;
    const last = pts[12];
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="צפי משקל ל-12 שבועות">
      ${ticks.map((t) => `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="axis" x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end">${t}</text>`).join('')}
      ${[0, 4, 8, 12].map((i) => `<text class="axis" x="${X(i)}" y="${H - 6}" text-anchor="middle">${i ? 'שבוע ' + i : 'היום'}</text>`).join('')}
      <path class="area" d="${area}"/><path class="line" d="${line}"/>
      <circle class="end" cx="${last.x}" cy="${last.y}" r="4.5"/>
      <text class="lbl" x="${last.x}" y="${last.y - 10}" text-anchor="end">${r1(last.d.kg)} ק״ג</text>
      <line class="hair" y1="${m.t}" y2="${H - m.b}" x1="0" x2="0"/><circle class="hdot" r="4" cx="0" cy="0"/>
    </svg><div class="tip" hidden></div>`;
    attachTip(box, box.querySelector('svg'), pts, (p) => `<b>${p.d.wk ? 'שבוע ' + p.d.wk : 'היום'}</b> ${r1(p.d.kg)} ק״ג`);
  }

  function volumeChart() {
    const v = PROG.weeklyVolume(PR.sessions, S.week, S.profile.level);
    const rows = Object.keys(EX.MUSCLES).map((k) => ({ k, n: EX.MUSCLES[k], v: v[k] }));
    const max = 26;
    $('#volChart').innerHTML = `<div class="vol-legend"><span class="band-key"></span> טווח היעד להיפרטרופיה: 10–20 סטים לשריר בשבוע</div>` +
      rows.map((r) => {
        const st = r.v < 8 ? 'low' : r.v > 22 ? 'high' : 'ok';
        return `<div class="vol-row" title="${r.n}: ${r1(r.v)} סטים בשבוע">
          <span class="vol-name">${r.n}</span>
          <span class="vol-track"><span class="vol-band" style="inset-inline-start:${10 / max * 100}%;width:${10 / max * 100}%"></span><span class="vol-bar ${st}" style="width:${Math.min(100, r.v / max * 100)}%"></span></span>
          <span class="vol-val num">${r1(r.v)}</span></div>`;
      }).join('') +
      '<p class="fine">סט בתרגיל שבו השריר עובד כשריר משני נספר כחצי סט. כתף קדמית מקבלת נפח גם מכל לחיצות החזה, ותאומים ובטן צריכים פחות נפח מהשרירים הגדולים.</p>';
  }

  function trackChart() {
    const box = $('#trackChart');
    const pts0 = S.weights.slice().sort((a, b) => a.d.localeCompare(b.d));
    if (pts0.length < 2) {
      box.innerHTML = `<div class="empty">אחרי שתי שקילות יופיע כאן גרף: המשקל שלך מול קו היעד (${T.gainKgWeek} ק״ג בשבוע).<br>שוקלים פעם-פעמיים בשבוע, בבוקר אחרי שירותים ולפני אוכל.</div>`;
      return;
    }
    const t0 = new Date(pts0[0].d).getTime(), day = 864e5;
    const data = pts0.map((p) => ({ x: (new Date(p.d).getTime() - t0) / day, kg: +p.w, d: p.d }));
    const span = Math.max(14, data[data.length - 1].x + 3);
    const target = (x) => data[0].kg + T.gainKgWeek * x / 7;
    const vals = data.map((d) => d.kg).concat([target(0), target(span)]);
    const ticks = niceTicks(Math.min(...vals) - 0.3, Math.max(...vals) + 0.3, 4);
    const W = 640, H = 220, m = { l: 40, r: 16, t: 16, b: 28 };
    const X = (x) => m.l + x / span * (W - m.l - m.r);
    const Y = (v) => m.t + (1 - (v - ticks[0]) / (ticks[ticks.length - 1] - ticks[0])) * (H - m.t - m.b);
    const pts = data.map((d) => ({ x: X(d.x), y: Y(d.kg), d }));
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
    const fmtD = (s) => { const [y, mo, dd] = s.split('-'); return `${+dd}.${+mo}`; };
    box.innerHTML = `<div class="legend"><span><i class="k-actual"></i>המשקל שלך</span><span><i class="k-target"></i>קו היעד</span></div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="מעקב משקל מול יעד">
      ${ticks.map((t) => `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="axis" x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end">${t}</text>`).join('')}
      <line class="target" x1="${X(0)}" y1="${Y(target(0))}" x2="${X(span)}" y2="${Y(target(span))}"/>
      <path class="line" d="${line}"/>
      ${pts.map((p) => `<circle class="dot" cx="${p.x}" cy="${p.y}" r="4.5"/>`).join('')}
      <text class="axis" x="${X(0)}" y="${H - 8}" text-anchor="middle">${fmtD(data[0].d)}</text>
      <text class="axis" x="${pts[pts.length - 1].x}" y="${H - 8}" text-anchor="middle">${fmtD(data[data.length - 1].d)}</text>
      <line class="hair" y1="${m.t}" y2="${H - m.b}" x1="0" x2="0"/><circle class="hdot" r="5" cx="0" cy="0"/>
    </svg><div class="tip" hidden></div>`;
    attachTip(box, box.querySelector('svg'), pts, (p) => `<b>${fmtD(p.d.d)}</b> ${p.d.kg} ק״ג · יעד ${r1(target(p.d.x))}`);
  }

  // ---------- training ----------
  function presc(f) {
    const reps = f.time ? '<span class="num">30–60</span> שנ׳' : `<span class="num">${f.reps[0]}–${f.reps[1]}</span>`;
    return { reps, sets: f.sets, rir: f.rir, rest: f.rest >= 120 ? `<span class="num">${r1(f.rest / 60)}</span> דק׳` : `<span class="num">${f.rest}</span> שנ׳` };
  }

  function renderTrain() {
    const p = S.profile, wi = PROG.weekInfo(S.week);
    $('#splitName').textContent = PR.split.name;
    $('#splitWhy').textContent = PR.split.why;
    $('#splitMeta').innerHTML = `<span>${LEVEL[p.level]}</span><span>${EQUIP[p.equip]}${p.bar && p.equip !== 'gym' ? ' + מוט מתח' : ''}</span><span>${PR.days} אימונים בשבוע</span>`;
    $('#weekStrip').innerHTML = Array.from({ length: 12 }, (_, i) => {
      const w = PROG.weekInfo(i + 1);
      return `<button type="button" class="wk${w.add === -1 ? ' deload' : ''}" aria-pressed="${S.week === i + 1}" data-w="${i + 1}"><span class="num">${i + 1}</span><small>${w.label}</small></button>`;
    }).join('');
    $('#weekNote').innerHTML = `<b>שבוע ${S.week} · מחזור ${wi.block} · ${wi.label}</b> · מאמץ: ${wi.rir} חזרות ברזרבה (RIR) · ${wi.note}`;
    $('#schedule').innerHTML = PROG.DAYS.map((d, i) => {
      const s = PR.sessions.find((x) => x.day === i);
      return `<div class="sd${s ? ' on' : ''}"><b>${d}</b><span>${s ? esc(s.title) : 'מנוחה'}</span></div>`;
    }).join('');
    $('#sessions').innerHTML = PR.sessions.map((s, si) => `
      <article class="session">
        <header><div><span class="eyebrow">יום ${PROG.DAYS[s.day]}</span><h3>${esc(s.title)}</h3></div><span class="dur">~<span class="num">${PROG.sessionMinutes(s.list.map((e) => Object.assign({}, e, { sets: PROG.forWeek(e, S.week, p.level).sets })))}</span> דק׳</span></header>
        <div class="ex-head" aria-hidden="true"><span></span><span>תרגיל</span><span>סטים × חזרות</span><span>RIR</span><span>מנוחה</span></div>
        <ol class="ex-list">${s.list.map((e, ei) => {
          const ex = EX.X[e.id], f = PROG.forWeek(e, S.week, p.level), pr = presc(f);
          const lg = (S.logs[e.id] || {})[S.week];
          return `<li><button type="button" class="ex-row" data-ex="${e.id}" data-s="${si}" data-e="${ei}">
            <span class="thumb" data-anim="${ex.a}"></span>
            <span class="ex-name"><b>${esc(ex.n)}</b><small>${ex.en}${e.role === 'M' ? ' · תרגיל מרכזי' : ''}${lg ? ` · נרשם: ${lg.w || 0}×${lg.r}` : ''}</small></span>
            <span class="ex-sr"><span class="num">${pr.sets} × ${f.time ? '30–60s' : f.reps[0] + '–' + f.reps[1]}</span>${f.lastToFailure ? '<em>סט אחרון לכשל</em>' : ''}</span>
            <span class="ex-rir num">${pr.rir}</span>
            <span class="ex-rest">${pr.rest}</span>
          </button></li>`;
        }).join('')}</ol>
      </article>`).join('');
    $$('#sessions .thumb').forEach((el) => Figure.mount(el, el.dataset.anim, { speed: 0.9 }));
    Figure.sweep();
    volumeChart();
  }

  $('#weekStrip').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-w]'); if (!b) return;
    S.week = +b.dataset.w; store.set('week', S.week); renderTrain();
  });
  $('#sessions').addEventListener('click', (e) => {
    const b = e.target.closest('.ex-row'); if (!b) return;
    const s = PR.sessions[+b.dataset.s], row = s.list[+b.dataset.e];
    openEx(b.dataset.ex, row);
  });

  // ---------- exercise dialog ----------
  const dlg = $('#exDlg');
  let dlgFig = null;
  function openEx(id, row) {
    const ex = EX.X[id];
    $('#dlgTitle').textContent = ex.n;
    $('#dlgEn').textContent = ex.en;
    const view = Figure.view(ex.a);
    $('#dlgView').textContent = view === 'front' ? 'מבט מלפנים' : view === 'top' ? 'מבט מלמעלה' : 'מבט מהצד';
    $('#dlgMuscles').innerHTML = ex.m.map((m) => `<span class="chip strong">${EX.MUSCLES[m]}</span>`).join('') + ex.s.map((m) => `<span class="chip">${EX.MUSCLES[m]}</span>`).join('');
    const tempo = Figure.anims[ex.a].tempo || [1.6, 1.2];
    let pres = '';
    if (row) {
      const f = PROG.forWeek(row, S.week, S.profile.level), pr = presc(f);
      pres = `<div class="pres">
        <div><small>סטים</small><b class="num">${pr.sets}</b></div>
        <div><small>${f.time ? 'זמן' : 'חזרות'}</small><b>${pr.reps}</b></div>
        <div><small>RIR</small><b class="num">${pr.rir}</b></div>
        <div><small>מנוחה</small><b>${pr.rest}</b></div>
      </div>`;
    }
    $('#dlgPres').innerHTML = pres + `<p class="fine">קצב: ירידה מבוקרת של 2–3 שניות, עלייה חזקה ומהירה בשליטה. האיור מדגים את המסלול. החלקים באדום הם השרירים שעובדים.</p>`;
    $('#dlgCues').innerHTML = ex.cues.map((c) => `<li>${esc(c)}</li>`).join('');
    $('#dlgErr').innerHTML = ex.err.map((c) => `<li>${esc(c)}</li>`).join('');
    // log
    const logBox = $('#dlgLog');
    if (row) {
      logBox.hidden = false;
      const L = S.logs[id] || {};
      const prev = L[S.week - 1], cur = L[S.week] || {};
      $('#logW').value = cur.w == null ? '' : cur.w;
      $('#logR').value = cur.r == null ? '' : cur.r;
      $('#logWeek').textContent = S.week;
      const f = PROG.forWeek(row, S.week, S.profile.level);
      let hint = 'רושמים את הסט הכבד ביותר: משקל וחזרות. בשבוע הבא תופיע כאן המלצה להתקדמות.';
      if (prev) {
        const lower = ex.m.some((m) => ['quads', 'hams', 'glutes'].includes(m));
        if (!prev.w) hint = `שבוע שעבר: ${prev.r} חזרות. הוסיפו חזרה, האטו את הירידה ל-4 שניות או הוסיפו משקל בתיק.`;
        else if (prev.r >= f.reps[1]) hint = `שבוע שעבר: ${prev.w} ק״ג × ${prev.r}, הטווח העליון. הגיע הזמן להעלות ל-${r1(+prev.w + (lower ? 5 : 2.5))} ק״ג ולחזור ל-${f.reps[0]} חזרות.`;
        else hint = `שבוע שעבר: ${prev.w} ק״ג × ${prev.r}. היעד השבוע: ${prev.w} ק״ג × ${+prev.r + 1}.`;
      }
      $('#logHint').textContent = hint;
      logBox.dataset.id = id;
    } else logBox.hidden = true;
    if (dlgFig) dlgFig.destroy();
    dlgFig = Figure.mount($('#dlgFig'), ex.a, { label: ex.n });
    $('#dlgPlay').textContent = Figure.reduce ? 'הפעל' : 'עצור';
    $('#dlgSlow').setAttribute('aria-pressed', 'false');
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }
  $('#dlgPlay').addEventListener('click', (e) => { const on = dlgFig.toggle(); e.target.textContent = on ? 'עצור' : 'הפעל'; });
  $('#dlgSlow').addEventListener('click', (e) => {
    const on = e.target.getAttribute('aria-pressed') !== 'true';
    e.target.setAttribute('aria-pressed', on); dlgFig.setSpeed(on ? 0.45 : 1);
  });
  $('#dlgClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { if (dlgFig) { dlgFig.destroy(); dlgFig = null; } });
  $('#logForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = $('#dlgLog').dataset.id;
    const w = $('#logW').value, r = $('#logR').value;
    if (!r) { $('#logHint').textContent = 'צריך לפחות מספר חזרות כדי לשמור.'; return; }
    S.logs[id] = S.logs[id] || {};
    S.logs[id][S.week] = { w: w === '' ? 0 : +w, r: +r };
    store.set('logs', S.logs);
    toast('הסט נשמר');
    renderTrain();
    dlg.close();
  });

  // ---------- nutrition ----------
  function renderFood() {
    const p = S.profile;
    $('#foodTargets').innerHTML = [
      ['קלוריות', fmt(T.kcal), ''], ['חלבון', T.protein, 'ג׳', 'p'], ['פחמימה', T.carbs, 'ג׳', 'c'], ['שומן', T.fat, 'ג׳', 'f'],
      ['סיבים', T.fiber, 'ג׳'], ['מים', T.water, 'ליטר']
    ].map(([n, v, u, k]) => `<div class="ft${k ? ' m-' + k : ''}"><small>${n}</small><b class="num">${v}</b><span>${u}</span></div>`).join('');
    $('#dayStrip').innerHTML = PROG.DAYS.map((d, i) => `<button type="button" aria-pressed="${S.day === i}" data-d="${i}">${d}</button>`).join('');
    const plan = NUT.dayPlan(T, p, S.day, S.swaps[S.day]);
    $('#meals').innerHTML = plan.meals.map((m, mi) => `
      <article class="meal">
        <header><div><span class="eyebrow">${m.label} · ${Math.round(m.share * 100)}% מהיום</span><h3>${esc(m.name)}</h3></div>
        ${m.count > 1 ? `<button type="button" class="ghost sm" data-swap="${mi}">החלפת מנה</button>` : ''}</header>
        <ul class="items">${m.items.map((it) => `<li><span>${esc(it.food.n)}</span><span class="qty"><b class="num">${it.g}</b> ג׳${NUT.unitText(it) ? ` <small>· ${NUT.unitText(it)}</small>` : ''}</span></li>`).join('')}</ul>
        <footer class="mm num"><span>${fmt(m.tot.k)} קק״ל</span><span class="t-p">ח ${Math.round(m.tot.p)}</span><span class="t-c">פ ${Math.round(m.tot.c)}</span><span class="t-f">ש ${Math.round(m.tot.f)}</span></footer>
      </article>`).join('');
    const d = (a, b) => { const x = Math.round(a - b); return x === 0 ? '±0' : (x > 0 ? '+' : '−') + Math.abs(x); };
    $('#dayTotal').innerHTML = `סה״כ ביום ${PROG.DAYS[S.day]}: <b class="num">${fmt(plan.tot.k)}</b> קק״ל (${d(plan.tot.k, T.kcal)}) · חלבון <b class="num">${Math.round(plan.tot.p)}</b> ג׳ · פחמימה <b class="num">${Math.round(plan.tot.c)}</b> ג׳ · שומן <b class="num">${Math.round(plan.tot.f)}</b> ג׳`;
    const list = NUT.shopping(T, p, null);
    $('#shopList').innerHTML = list.map((x) => {
      const kg = x.g >= 1000 ? `<span class="num">${r1(x.g / 1000)}</span> ק״ג` : `<span class="num">${Math.round(x.g / 10) * 10}</span> ג׳`;
      const u = x.food.u && x.food.whole ? ` (${Math.round(x.g / x.food.u[1])} ${x.food.u[2]})` : '';
      return `<li><span>${esc(x.food.n)}</span><b>${kg}${u}</b></li>`;
    }).join('');
  }
  $('#dayStrip').addEventListener('click', (e) => { const b = e.target.closest('button[data-d]'); if (!b) return; S.day = +b.dataset.d; renderFood(); });
  $('#meals').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-swap]'); if (!b) return;
    const mi = +b.dataset.swap;
    S.swaps[S.day] = S.swaps[S.day] || {};
    S.swaps[S.day][mi] = (S.swaps[S.day][mi] || 0) + 1;
    store.set('swaps', S.swaps);
    renderFood();
  });

  // ---------- tracking ----------
  function renderTrack() {
    const list = S.weights.slice().sort((a, b) => b.d.localeCompare(a.d));
    $('#wList').innerHTML = list.length ? list.map((x) => `<li><span class="num">${x.d.split('-').reverse().join('.')}</span><b><span class="num">${x.w}</span> ק״ג</b><button type="button" class="ghost sm" data-del="${x.d}" aria-label="מחיקת השקילה מ-${x.d}">מחיקה</button></li>`).join('') : '';
    trackChart();
    $('#advice').innerHTML = advice();
  }
  function advice() {
    const pts = S.weights.slice().sort((a, b) => a.d.localeCompare(b.d));
    if (pts.length < 3) return `<b>מה עושים עם המספרים?</b> אחרי שבועיים של שקילות תופיע כאן המלצה. אם העלייה איטית מהיעד מוסיפים 150 קק״ל, ואם מהירה מדי מורידים 100.`;
    const t0 = new Date(pts[0].d).getTime();
    const xs = pts.map((p) => (new Date(p.d).getTime() - t0) / 864e5 / 7), ys = pts.map((p) => +p.w);
    const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
    let num = 0, den = 0; xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) * (x - mx); });
    const span = xs[n - 1];
    if (span < 1.5) return '<b>עוד קצת סבלנות.</b> צריך לפחות 10 ימים של שקילות כדי לראות מגמה אמיתית ולא תנודות של מים ומלח.';
    const slope = den ? num / den : 0, tgt = T.gainKgWeek;
    const s = `קצב בפועל: <b class="num">${slope >= 0 ? '+' : ''}${slope.toFixed(2)}</b> ק״ג לשבוע. יעד: <b class="num">${tgt}</b>.`;
    if (slope < tgt * 0.5) return `<span class="state warn">איטי מהיעד</span> ${s} הוסיפו <b>150 קק״ל</b> ביום (למשל כוס חלב וחופן אגוזים, או עוד סקופ בשייק), ובדקו שוב בעוד שבועיים.`;
    if (slope > tgt * 1.6) return `<span class="state warn">מהיר מהיעד</span> ${s} חלק גדול מהעלייה עלול להיות שומן. הורידו <b>100–150 קק״ל</b> ביום, בעיקר מפחמימות או משומן.`;
    return `<span class="state ok">בדיוק בקצב</span> ${s} ממשיכים כך. המשקל בחדר הכושר צריך לעלות במקביל.`;
  }
  $('#wForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = $('#wDate').value, w = +$('#wVal').value;
    if (!d || !(w > 30 && w < 250)) { toast('צריך תאריך ומשקל בין 30 ל-250 ק״ג'); return; }
    S.weights = S.weights.filter((x) => x.d !== d).concat([{ d, w }]);
    store.set('weights', S.weights);
    $('#wVal').value = '';
    renderTrack();
    toast('השקילה נשמרה');
  });
  $('#wList').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-del]'); if (!b) return;
    S.weights = S.weights.filter((x) => x.d !== b.dataset.del); store.set('weights', S.weights); renderTrack();
  });

  // ---------- library ----------
  function renderLibrary() {
    const groups = [['all', 'הכול']].concat(Object.keys(EX.MUSCLES).map((k) => [k, EX.MUSCLES[k]]));
    $('#libFilter').innerHTML = groups.map(([k, n]) => `<button type="button" aria-pressed="${S.lib === k}" data-m="${k}">${n}</button>`).join('');
    const ids = Object.keys(EX.X).filter((id) => S.lib === 'all' || EX.X[id].m.includes(S.lib));
    const EQ = { gym: 'חדר כושר', db: 'משקולות', home: 'בבית', bar: 'מוט מתח' };
    $('#libGrid').innerHTML = ids.map((id) => {
      const ex = EX.X[id];
      return `<button type="button" class="lib-card" data-ex="${id}"><span class="thumb lg" data-anim="${ex.a}"></span><b>${esc(ex.n)}</b><small>${ex.m.map((m) => EX.MUSCLES[m]).join(' · ')} · ${EQ[ex.eq]}</small></button>`;
    }).join('');
    $$('#libGrid .thumb').forEach((el) => Figure.mount(el, el.dataset.anim));
    Figure.sweep();
  }
  $('#libFilter').addEventListener('click', (e) => { const b = e.target.closest('button[data-m]'); if (!b) return; S.lib = b.dataset.m; renderLibrary(); });
  $('#libGrid').addEventListener('click', (e) => { const b = e.target.closest('.lib-card'); if (b) openEx(b.dataset.ex, null); });

  // ---------- tabs ----------
  const TABS = ['train', 'food', 'track', 'library', 'science'];
  let libDone = false;
  function showTab(id, push) {
    if (!TABS.includes(id)) id = 'train';
    $$('.tabs [role="tab"]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === id));
    TABS.forEach((t) => { $('#p-' + t).hidden = t !== id; });
    if (id === 'library' && !libDone) { renderLibrary(); libDone = true; }
    if (push && location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
  }
  $('.tabs').addEventListener('click', (e) => { const b = e.target.closest('[role="tab"]'); if (b) showTab(b.dataset.tab, true); });
  window.addEventListener('hashchange', () => showTab(location.hash.slice(1)));

  // ---------- misc ----------
  let toastT = 0;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }

  function renderAll() {
    T = NUT.calc(S.profile);
    PR = PROG.build(S.profile);
    renderSummary(); renderTrain(); renderFood(); renderTrack();
    if (libDone) renderLibrary();
  }

  fillForm(S.profile);
  $('#wDate').value = new Date().toISOString().slice(0, 10);
  renderAll();
  showTab(location.hash.slice(1) || 'train');
})();

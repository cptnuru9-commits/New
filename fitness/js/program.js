/* Training program builder: splits, set/rep schemes, 12-week periodization. */
(function () {
  'use strict';
  const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  // [slot, role, alt]  role: M = main compound, S = secondary, I = isolation
  const T = {
    FBA2: ['גוף מלא A', [['squat', 'M'], ['hpush', 'M'], ['hpull', 'M'], ['hinge', 'S'], ['vpush', 'S'], ['biceps', 'I'], ['triceps', 'I']]],
    FBB2: ['גוף מלא B', [['hinge', 'M', 1], ['vpull', 'M'], ['hpush', 'S', 1], ['single', 'S'], ['lateral', 'I'], ['ham', 'I'], ['calf', 'I'], ['core', 'I']]],
    FBA: ['גוף מלא A', [['squat', 'M'], ['hpush', 'M'], ['hpull', 'S'], ['lateral', 'I'], ['triceps', 'I'], ['core', 'I']]],
    FBB: ['גוף מלא B', [['hinge', 'M'], ['vpull', 'M'], ['vpush', 'S'], ['single', 'S'], ['biceps', 'I'], ['calf', 'I']]],
    FBC: ['גוף מלא C', [['squat', 'S', 1], ['hpush', 'S', 1], ['hpull', 'M', 1], ['fly', 'I'], ['rear', 'I'], ['ham', 'I'], ['triceps', 'I', 1]]],
    UA: ['פלג גוף עליון A', [['hpush', 'M'], ['hpull', 'M'], ['vpush', 'S'], ['vpull', 'S'], ['lateral', 'I'], ['triceps', 'I'], ['biceps', 'I']]],
    LA: ['פלג גוף תחתון A', [['squat', 'M'], ['hinge', 'S'], ['single', 'S'], ['quad', 'I'], ['ham', 'I'], ['calf', 'I']]],
    UB: ['פלג גוף עליון B', [['hpush', 'S', 1], ['vpull', 'M', 1], ['hpull', 'S', 1], ['fly', 'I'], ['rear', 'I'], ['biceps', 'I', 1], ['triceps', 'I', 1]]],
    LB: ['פלג גוף תחתון B', [['hinge', 'M', 1], ['squat', 'S', 1], ['glute', 'S'], ['ham', 'I'], ['quad', 'I'], ['calf', 'I'], ['core', 'I']]],
    PU: ['דחיפה', [['vpush', 'M'], ['hpush', 'S', 1], ['dip', 'S'], ['fly', 'I'], ['lateral', 'I'], ['triceps', 'I', 1]]],
    PL: ['משיכה', [['vpull', 'M', 1], ['hpull', 'M', 1], ['rear', 'I'], ['biceps', 'I'], ['biceps', 'I', 1], ['core', 'I']]],
    LG: ['רגליים', [['hinge', 'M', 1], ['squat', 'S', 1], ['glute', 'S'], ['ham', 'I'], ['quad', 'I'], ['calf', 'I']]],
    PUA: ['דחיפה A', [['hpush', 'M'], ['vpush', 'S'], ['fly', 'I'], ['lateral', 'I'], ['triceps', 'I'], ['triceps', 'I', 1]]],
    PLA: ['משיכה A', [['vpull', 'M'], ['hpull', 'S'], ['rear', 'I'], ['biceps', 'I'], ['biceps', 'I', 1]]],
    LGA: ['רגליים A', [['squat', 'M'], ['hinge', 'S'], ['single', 'S'], ['ham', 'I'], ['calf', 'I'], ['core', 'I']]],
    PUB: ['דחיפה B', [['vpush', 'M'], ['hpush', 'S', 1], ['dip', 'S'], ['lateral', 'I'], ['triceps', 'I']]],
    PLB: ['משיכה B', [['hpull', 'M'], ['vpull', 'S', 1], ['rear', 'I', 1], ['biceps', 'I', 1], ['core', 'I', 1]]],
    LGB: ['רגליים B', [['hinge', 'M', 1], ['squat', 'S', 1], ['glute', 'S'], ['quad', 'I'], ['ham', 'I'], ['calf', 'I']]]
  };

  const SPLITS = {
    2: { name: 'גוף מלא ×2', why: 'פעמיים בשבוע: כל שריר מקבל גירוי פעמיים, הנפח השבועי מרוכז בתרגילים מורכבים.', days: [0, 3], t: ['FBA2', 'FBB2'] },
    3: { name: 'גוף מלא ×3', why: 'כל שריר מאומן 3 פעמים בשבוע. זו התדירות שהמחקר מראה כיעילה ביותר למתחילים, ודומה לתוכניות מתחילים מוכרות.', days: [0, 2, 4], t: ['FBA', 'FBB', 'FBC'] },
    4: { name: 'עליון / תחתון', why: 'פיצול עליון/תחתון: כל שריר פעמיים בשבוע עם יותר נפח לכל אימון. זה הפורמט של PHUL ושל רוב תוכניות ההיפרטרופיה לרמת ביניים.', days: [0, 1, 3, 4], t: ['UA', 'LA', 'UB', 'LB'] },
    5: { name: 'עליון / תחתון + דחיפה / משיכה / רגליים', why: 'שילוב של עליון/תחתון עם PPL: כל שריר פעמיים בשבוע בגירויים שונים.', days: [0, 1, 3, 4, 5], t: ['UA', 'LA', 'PU', 'PL', 'LG'] },
    6: { name: 'דחיפה / משיכה / רגליים ×2', why: 'PPL פעמיים בשבוע: נפח גבוה ותדירות 2 לכל שריר. מתאים למתאמנים מנוסים עם זמן התאוששות טוב.', days: [0, 1, 2, 3, 4, 5], t: ['PUA', 'PLA', 'LGA', 'PUB', 'PLB', 'LGB'] }
  };

  const SCHEME = {
    beg: { M: { sets: 3, reps: [6, 10], rest: 150 }, S: { sets: 3, reps: [8, 12], rest: 120 }, I: { sets: 2, reps: [10, 15], rest: 75 } },
    int: { M: { sets: 4, reps: [6, 10], rest: 180 }, S: { sets: 3, reps: [8, 12], rest: 120 }, I: { sets: 3, reps: [10, 15], rest: 75 } },
    adv: { M: { sets: 4, reps: [5, 8], rest: 180 }, S: { sets: 4, reps: [8, 12], rest: 120 }, I: { sets: 3, reps: [12, 20], rest: 60 } }
  };
  const HOME_REPS = { M: [8, 15], S: [10, 20], I: [12, 25] };

  // 6-week mesocycle, repeated twice. Week 6 and 12 are deloads.
  const MESO = [
    { rir: 3, add: 0, label: 'כניסה', note: 'בחרו משקלים שמשאירים 3 חזרות ברזרבה. רושמים את המשקל והחזרות של כל תרגיל.' },
    { rir: 2, add: 0, label: 'בנייה', note: 'מוסיפים חזרה או משקל לעומת השבוע שעבר בכל תרגיל.' },
    { rir: 2, add: 1, label: 'נפח +', note: 'סט נוסף בתרגילים המשניים ובתרגילי הבידוד.' },
    { rir: 1, add: 1, label: 'עומס', note: 'קרוב לכשל: חזרה אחת ברזרבה. הטכניקה נשארת נקייה.' },
    { rir: 1, add: 2, label: 'שיא', note: 'שבוע הנפח הגבוה במחזור. בתרגילי בידוד הסט האחרון עד כשל.' },
    { rir: 4, add: -1, label: 'דילואוד', note: 'חצי מהסטים, אותם משקלים, רחוק מכשל. הגוף מתאושש ומתכונן למחזור הבא.' }
  ];

  function weekInfo(w) {
    const i = (w - 1) % 6, block = w <= 6 ? 1 : 2;
    return Object.assign({ week: w, block, wb: i + 1 }, MESO[i]);
  }

  function build(profile) {
    const days = Math.min(6, Math.max(2, +profile.days));
    const split = SPLITS[days];
    const equip = profile.equip, bar = !!profile.bar;
    const sch = SCHEME[profile.level] || SCHEME.beg;
    const sessions = split.t.map((key, i) => {
      const [title, items] = T[key];
      const list = [];
      items.forEach(([slot, role, alt]) => {
        let id = EX.pick(slot, alt, equip, bar);
        if (list.some((e) => e.id === id)) id = EX.pick(slot, !alt, equip, bar);
        const dup = list.find((e) => e.id === id);
        const base = sch[role];
        let sets = base.sets + (days === 2 && role === 'M' ? 1 : 0);
        if (dup) { dup.sets = Math.min(5, dup.sets + 1); return; }
        const ex = EX.X[id];
        let reps = base.reps.slice();
        if (equip === 'home' && !ex.time && !['pullup', 'chinup'].includes(id)) reps = HOME_REPS[role].slice();
        list.push({ id, slot, role, sets, reps, rest: base.rest });
      });
      return { key, title, day: split.days[i], list };
    });
    fitTime(sessions, +profile.minutes || 60);
    return { split, sessions, days };
  }

  function sessionMinutes(list) {
    let sec = 8 * 60; // general warm-up
    list.forEach((e, i) => {
      sec += e.sets * (45 + e.rest);
      if (e.role === 'M') sec += 120; // ramp-up sets
      if (i) sec += 45; // changeover
    });
    return Math.round(sec / 60);
  }

  function fitTime(sessions, limit) {
    sessions.forEach((s) => {
      while (sessionMinutes(s.list) > limit + 3 && s.list.length > 4) {
        const idx = s.list.map((e) => e.role).lastIndexOf('I');
        if (idx < 0) break;
        s.list.splice(idx, 1);
      }
      if (sessionMinutes(s.list) > limit + 3) s.list.forEach((e) => { e.rest = Math.max(60, e.rest - 30); });
      s.minutes = sessionMinutes(s.list);
    });
  }

  // Apply the week's periodization to one exercise row.
  function forWeek(e, w, level) {
    const wi = weekInfo(w);
    let sets = e.sets;
    if (wi.add === -1) sets = Math.max(1, Math.ceil(e.sets / 2));
    else if (wi.add >= 1 && e.role !== 'M') sets = e.sets + 1;
    if (wi.add === 2 && e.role === 'M' && level !== 'beg') sets = e.sets + 1;
    let reps = e.reps.slice();
    if (wi.block === 2 && e.role === 'M' && level !== 'beg' && reps[0] >= 6 && reps[1] <= 12) reps = [reps[0] - 1, reps[1] - 2];
    let rir = wi.rir;
    if (level === 'beg' && rir < 2 && wi.add !== -1) rir = 2;
    const ex = EX.X[e.id];
    return { sets, reps, rir, rest: e.rest, time: !!ex.time, lastToFailure: wi.wb === 5 && e.role === 'I' };
  }

  function weeklyVolume(sessions, w, level) {
    const v = {};
    Object.keys(EX.MUSCLES).forEach((m) => { v[m] = 0; });
    sessions.forEach((s) => s.list.forEach((e) => {
      const ex = EX.X[e.id];
      const sets = forWeek(e, w, level).sets;
      ex.m.forEach((m) => { v[m] += sets; });
      ex.s.forEach((m) => { v[m] += sets / 2; });
    }));
    return v;
  }

  window.PROG = { build, forWeek, weekInfo, weeklyVolume, DAYS, MESO, sessionMinutes };
})();

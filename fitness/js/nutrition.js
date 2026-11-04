/* Energy & macro targets + meal plan generator. Food values per 100 g (cooked where noted),
 * based on USDA FoodData Central and Israeli product labels. */
(function () {
  'use strict';
  const FOODS = {
    egg:      { n: 'ביצים', k: 143, p: 12.6, c: 0.7, f: 9.5, u: ['ביצה', 55, 'ביצים'], whole: true },
    chicken:  { n: 'חזה עוף (מבושל)', k: 165, p: 31, c: 0, f: 3.6, meat: true },
    turkey:   { n: 'חזה הודו (מבושל)', k: 135, p: 30, c: 0, f: 1.5, meat: true },
    beef:     { n: 'בקר טחון 5% (מבושל)', k: 170, p: 26, c: 0, f: 7, meat: true },
    salmon:   { n: 'סלמון (אפוי)', k: 206, p: 22, c: 0, f: 12, meat: true },
    tuna:     { n: 'טונה במים (מסוננת)', k: 116, p: 26, c: 0, f: 1, meat: true, u: ['קופסה', 120, 'קופסאות'] },
    cottage:  { n: 'קוטג׳ 5%', k: 96, p: 11, c: 1.5, f: 5, u: ['גביע', 250, 'גביעים'] },
    wcheese:  { n: 'גבינה לבנה 5%', k: 97, p: 9, c: 3.5, f: 5 },
    pyogurt:  { n: 'יוגורט חלבון 0%', k: 60, p: 10, c: 4, f: 0, u: ['גביע', 200, 'גביעים'] },
    milk:     { n: 'חלב 3%', k: 60, p: 3.3, c: 4.7, f: 3, u: ['כוס', 240, 'כוסות'] },
    whey:     { n: 'אבקת חלבון (Whey)', k: 390, p: 78, c: 7, f: 6, u: ['סקופ', 30, 'סקופים'] },
    tofu:     { n: 'טופו קשה', k: 144, p: 15.5, c: 3, f: 8.7 },
    oats:     { n: 'שיבולת שועל', k: 379, p: 13, c: 67, f: 6.5, u: ['כוס', 80, 'כוסות'] },
    rice:     { n: 'אורז לבן (מבושל)', k: 130, p: 2.7, c: 28, f: 0.3, u: ['כוס', 160, 'כוסות'] },
    pasta:    { n: 'פסטה (מבושלת)', k: 158, p: 5.8, c: 31, f: 0.9, u: ['כוס', 140, 'כוסות'] },
    potato:   { n: 'תפוח אדמה (אפוי)', k: 93, p: 2.5, c: 21, f: 0.1, u: ['בינוני', 170, 'בינוניים'] },
    sweetpot: { n: 'בטטה (אפויה)', k: 90, p: 2, c: 21, f: 0.2, u: ['בינונית', 150, 'בינוניות'] },
    bread:    { n: 'לחם מלא', k: 240, p: 11, c: 43, f: 3, u: ['פרוסה', 30, 'פרוסות'] },
    pita:     { n: 'פיתה', k: 275, p: 9, c: 55, f: 1.2, u: ['פיתה', 90, 'פיתות'] },
    ricecake: { n: 'פריכיות אורז', k: 387, p: 8, c: 81, f: 3, u: ['פריכית', 9, 'פריכיות'] },
    granola:  { n: 'גרנולה', k: 450, p: 10, c: 64, f: 17 },
    lentils:  { n: 'עדשים (מבושלות)', k: 116, p: 9, c: 20, f: 0.4 },
    banana:   { n: 'בננה', k: 89, p: 1.1, c: 23, f: 0.3, u: ['בננה', 120, 'בננות'] },
    dates:    { n: 'תמרים מג׳הול', k: 277, p: 1.8, c: 75, f: 0.2, u: ['תמר', 24, 'תמרים'] },
    berries:  { n: 'פירות יער', k: 50, p: 0.7, c: 12, f: 0.3 },
    veg:      { n: 'ירקות / סלט', k: 22, p: 1, c: 4, f: 0.2 },
    hummus:   { n: 'חומוס (ממרח)', k: 240, p: 8, c: 14, f: 17, u: ['כף', 30, 'כפות'] },
    tahini:   { n: 'טחינה גולמית', k: 595, p: 17, c: 21, f: 54, u: ['כף', 15, 'כפות'] },
    nuts:     { n: 'אגוזים / שקדים', k: 600, p: 18, c: 18, f: 52, u: ['חופן', 30, 'חופנים'] },
    pb:       { n: 'חמאת בוטנים', k: 588, p: 25, c: 20, f: 50, u: ['כף', 16, 'כפות'] },
    avocado:  { n: 'אבוקדו', k: 160, p: 2, c: 9, f: 15 },
    oil:      { n: 'שמן זית', k: 884, p: 0, c: 0, f: 100, u: ['כף', 13, 'כפות'] }
  };

  // Meal options by category. Each item: [food, role] with role P/C/F (solved) or a fixed gram amount.
  const MEALS = {
    breakfast: [
      { n: 'חביתה, לחם מלא וסלט', i: [['egg', 'P'], ['bread', 'C'], ['avocado', 'F'], ['veg', 150]] },
      { n: 'דייסת שיבולת שועל עם חלבון', i: [['whey', 'P'], ['oats', 'C'], ['pb', 'F'], ['banana', 120], ['milk', 200]] },
      { n: 'יוגורט חלבון, גרנולה ופירות יער', i: [['pyogurt', 'P'], ['granola', 'C'], ['nuts', 'F'], ['berries', 100]] }
    ],
    lunch: [
      { n: 'חזה עוף, אורז וסלט', i: [['chicken', 'P'], ['rice', 'C'], ['oil', 'F'], ['veg', 200]] },
      { n: 'בולונז בקר עם פסטה', i: [['beef', 'P'], ['pasta', 'C'], ['oil', 'F'], ['veg', 150]] },
      { n: 'סלמון, בטטה וטחינה', i: [['salmon', 'P'], ['sweetpot', 'C'], ['tahini', 'F'], ['veg', 150]] },
      { n: 'הודו, תפוחי אדמה וירקות', i: [['turkey', 'P'], ['potato', 'C'], ['oil', 'F'], ['veg', 200]] },
      { n: 'טופו מוקפץ עם אורז', i: [['tofu', 'P'], ['rice', 'C'], ['tahini', 'F'], ['veg', 200]] },
      { n: 'מג׳דרה עם יוגורט חלבון', i: [['pyogurt', 'P'], ['lentils', 'C'], ['oil', 'F'], ['rice', 100], ['veg', 150]] }
    ],
    snack: [
      { n: 'פיתה עם קוטג׳ ואבוקדו', i: [['cottage', 'P'], ['pita', 'C'], ['avocado', 'F'], ['veg', 100]] },
      { n: 'טונה עם פריכיות', i: [['tuna', 'P'], ['ricecake', 'C'], ['oil', 'F'], ['veg', 100]] },
      { n: 'פיתה עם חומוס וביצים קשות', i: [['egg', 'P'], ['pita', 'C'], ['hummus', 'F']] },
      { n: 'יוגורט חלבון, תמרים ושקדים', i: [['pyogurt', 'P'], ['dates', 'C'], ['nuts', 'F']] }
    ],
    shake: [
      { n: 'שייק מסה ביתי', i: [['whey', 'P'], ['oats', 'C'], ['pb', 'F'], ['banana', 120], ['milk', 300]] },
      { n: 'שייק חלבון, בננה ותמרים', i: [['whey', 'P'], ['dates', 'C'], ['nuts', 'F'], ['banana', 120], ['milk', 250]] }
    ],
    dinner: [
      { n: 'חביתה, גבינה לבנה ולחם', i: [['egg', 'P'], ['bread', 'C'], ['avocado', 'F'], ['wcheese', 100], ['veg', 150]] },
      { n: 'פסטה עם טונה', i: [['tuna', 'P'], ['pasta', 'C'], ['oil', 'F'], ['veg', 150]] },
      { n: 'עוף בתנור עם בטטה', i: [['chicken', 'P'], ['sweetpot', 'C'], ['oil', 'F'], ['veg', 150]] },
      { n: 'פסטה עם טופו ועגבניות', i: [['tofu', 'P'], ['pasta', 'C'], ['oil', 'F'], ['veg', 150]] }
    ],
    bedtime: [
      { n: 'קוטג׳ עם פריכיות ואגוזים', i: [['cottage', 'P'], ['ricecake', 'C'], ['nuts', 'F']] },
      { n: 'גבינה לבנה עם לחם וטחינה', i: [['wcheese', 'P'], ['bread', 'C'], ['tahini', 'F']] },
      { n: 'יוגורט חלבון עם חמאת בוטנים', i: [['pyogurt', 'P'], ['granola', 'C'], ['pb', 'F'], ['berries', 80]] }
    ]
  };

  const LAYOUT = {
    3: [['ארוחת בוקר', 'breakfast', 0.30], ['ארוחת צהריים', 'lunch', 0.38], ['ארוחת ערב', 'dinner', 0.32]],
    4: [['ארוחת בוקר', 'breakfast', 0.25], ['ארוחת צהריים', 'lunch', 0.30], ['אחרי אימון', 'shake', 0.17], ['ארוחת ערב', 'dinner', 0.28]],
    5: [['ארוחת בוקר', 'breakfast', 0.22], ['ארוחת צהריים', 'lunch', 0.27], ['לפני אימון', 'snack', 0.14], ['ארוחת ערב', 'dinner', 0.24], ['לפני שינה', 'bedtime', 0.13]],
    6: [['ארוחת בוקר', 'breakfast', 0.19], ['ביניים', 'snack', 0.12], ['ארוחת צהריים', 'lunch', 0.24], ['אחרי אימון', 'shake', 0.14], ['ארוחת ערב', 'dinner', 0.19], ['לפני שינה', 'bedtime', 0.12]]
  };

  const LEVEL_RATE = { beg: 0.5, int: 0.35, adv: 0.25 }; // % body weight per week
  const PACE = { lean: 0.7, std: 1, fast: 1.4 };

  function calc(p) {
    const w = +p.weight, h = +p.height, a = +p.age;
    const bmi = w / Math.pow(h / 100, 2);
    const bmr = 10 * w + 6.25 * h - 5 * a + (p.sex === 'f' ? -161 : 5); // Mifflin-St Jeor
    const neat = bmr * (+p.activity || 1.4);
    const train = 0.07 * w * (+p.minutes || 60) * (+p.days || 3) / 7; // ~5 MET resistance training, net of rest
    const tdee = neat + train;
    let rate = LEVEL_RATE[p.level] * PACE[p.pace || 'std'];
    let mode = 'bulk';
    if (bmi < 18.5) rate *= 1.2;
    if (bmi >= 27) { rate = 0.1; mode = 'recomp'; }
    if (a < 18) rate = Math.min(rate, 0.35);
    const gainKgWeek = w * rate / 100;
    const surplus = Math.round(Math.min(700, Math.max(mode === 'recomp' ? 100 : 200, gainKgWeek * 6000 / 7)) / 10) * 10;
    const kcal = Math.round((tdee + surplus) / 10) * 10;
    const basis = bmi > 27 ? 25 * Math.pow(h / 100, 2) : w;
    const protein = Math.round(basis * (p.diet === 'veg' ? 2.1 : 2.0));
    const fat = Math.round(Math.max(0.8 * w, 0.27 * kcal / 9));
    const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
    const water = Math.round((w * 0.035 + (+p.minutes || 60) / 60 * 0.5) * 10) / 10;
    const fiber = Math.round(kcal / 1000 * 14);
    return { bmi, bmr: Math.round(bmr), tdee: Math.round(tdee), train: Math.round(train), surplus, kcal, protein, fat, carbs,
      rate: Math.round(rate * 100) / 100, gainKgWeek: Math.round(gainKgWeek * 100) / 100, mode, water, fiber, basis: Math.round(basis) };
  }

  function solveMeal(tpl, target) {
    const items = tpl.i.map(([id, r]) => ({ id, food: FOODS[id], role: typeof r === 'string' ? r : null, g: typeof r === 'number' ? r : 0 }));
    const sum = (key, skip) => items.reduce((s, it) => it === skip ? s : s + it.food[key] * it.g / 100, 0);
    const key = { P: 'p', C: 'c', F: 'f' };
    for (let n = 0; n < 40; n++) {
      items.forEach((it) => {
        if (!it.role) return;
        const k = key[it.role];
        let need = target[k] - sum(k, it);
        if (it.role === 'P') need = Math.max(need, target.p * 0.5); // the protein food carries most of the meal's protein
        it.g = Math.max(0, Math.min(it.role === 'F' ? 120 : 600, need / it.food[k] * 100));
      });
    }
    items.forEach((it) => {
      if (!it.role) return;
      const f = it.food;
      if (f.u) {
        const step = f.whole || f.u[1] <= 30 ? 1 : 0.5;
        let units = Math.round(it.g / f.u[1] / step) * step;
        if (f.u[1] <= 20) units = Math.round(it.g / f.u[1]); // spoons/rice cakes: whole units
        it.g = units * f.u[1];
      } else {
        const step = f.f > 40 ? 5 : 10;
        it.g = Math.round(it.g / step) * step;
      }
    });
    items.forEach((it) => { if (it.role === 'F' && it.food.f * it.g / 100 < 3) it.g = 0; });
    const out = items.filter((it) => it.g > 0);
    const tot = { k: 0, p: 0, c: 0, f: 0 };
    out.forEach((it) => { ['k', 'p', 'c', 'f'].forEach((m) => { tot[m] += it.food[m] * it.g / 100; }); });
    return { name: tpl.n, items: out, tot };
  }

  function unitText(it) {
    const f = it.food;
    if (!f.u) return '';
    const n = Math.round(it.g / f.u[1] * 2) / 2;
    if (!n) return '';
    const nn = n === 0.5 ? 'חצי' : String(n).replace('.5', '½');
    return n > 1 ? `${nn} ${f.u[2] || f.u[0]}` : `${nn} ${f.u[0]}`;
  }

  function options(cat, diet) {
    return MEALS[cat].filter((m) => diet !== 'veg' || !m.i.some(([id]) => FOODS[id].meat));
  }

  function dayPlan(t, p, day, swaps) {
    const lay = LAYOUT[p.meals] || LAYOUT[5];
    const meals = lay.map(([label, cat, share], mi) => {
      const opts = options(cat, p.diet);
      const sw = (swaps && swaps[mi]) || 0;
      const tpl = opts[(day + mi + sw) % opts.length];
      const m = solveMeal(tpl, { p: t.protein * share, c: t.carbs * share, f: t.fat * share });
      return Object.assign(m, { label, cat, share, count: opts.length });
    });
    const tot = { k: 0, p: 0, c: 0, f: 0 };
    meals.forEach((m) => { ['k', 'p', 'c', 'f'].forEach((k) => { tot[k] += m.tot[k]; }); });
    return { meals, tot };
  }

  function shopping(t, p, swaps) {
    const g = {};
    for (let d = 0; d < 7; d++) {
      dayPlan(t, p, d, swaps).meals.forEach((m) => m.items.forEach((it) => { g[it.id] = (g[it.id] || 0) + it.g; }));
    }
    return Object.keys(g).map((id) => ({ id, food: FOODS[id], g: g[id] })).sort((a, b) => b.g - a.g);
  }

  window.NUT = { FOODS, MEALS, calc, dayPlan, shopping, unitText };
})();

/* Animated exercise figures.
 * A 2D stick figure posed by inverse kinematics: each keyframe gives the hip
 * position, the torso angle and *targets* for the hands and feet, so hands stay
 * on the bar and feet stay planted while the body moves between keyframes.
 * Angles: 0 = pointing down, 90 = pointing right (the figure faces right), 180 = up.
 */
(function () {
  'use strict';
  const L = { torso: 52, neck: 8, head: 10, ua: 29, fa: 27, th: 42, sh: 40, ft: 13 };
  const R = Math.PI / 180;
  const dir = (a) => [Math.sin(a * R), Math.cos(a * R)];
  const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
  const F = (n) => (Math.round(n * 10) / 10).toString();
  const pt = (p) => F(p[0]) + ',' + F(p[1]);

  function ik(root, target, l1, l2, bend) {
    let dx = target[0] - root[0], dy = target[1] - root[1];
    let d = Math.hypot(dx, dy);
    if (d < 1e-6) { dx = 0; dy = 1; d = 1e-6; }
    const ux = dx / d, uy = dy / d;
    const max = l1 + l2 - 0.01, min = Math.abs(l1 - l2) + 0.01;
    const dc = Math.min(max, Math.max(min, d));
    const end = [root[0] + ux * dc, root[1] + uy * dc];
    const base = Math.atan2(uy, ux);
    const a = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc))));
    const j1 = [root[0] + l1 * Math.cos(base + a), root[1] + l1 * Math.sin(base + a)];
    const j2 = [root[0] + l1 * Math.cos(base - a), root[1] + l1 * Math.sin(base - a)];
    const m = [(root[0] + end[0]) / 2, (root[1] + end[1]) / 2];
    const s1 = (j1[0] - m[0]) * bend[0] + (j1[1] - m[1]) * bend[1];
    const s2 = (j2[0] - m[0]) * bend[0] + (j2[1] - m[1]) * bend[1];
    return { j: s1 >= s2 ? j1 : j2, e: end };
  }

  function lerp(a, b, t) {
    if (typeof a === 'number') return a + (b - a) * t;
    if (Array.isArray(a)) return a.map((v, i) => lerp(v, b[i], t));
    if (a && typeof a === 'object') {
      const o = {};
      for (const k in a) o[k] = b && k in b ? lerp(a[k], b[k], t) : a[k];
      return o;
    }
    return a;
  }

  function solve(p) {
    const hip = p.hip, td = dir(p.torso);
    const sh = add(hip, td, L.torso);
    const head = add(sh, dir(p.torso + (p.ht || 0)), L.neck + L.head);
    const front = !!p.front;
    const shN = front ? [sh[0] + 13, sh[1]] : sh;
    const shF = front ? [sh[0] - 13, sh[1]] : sh;
    const hipN = front ? [hip[0] + 8, hip[1]] : hip;
    const hipF = front ? [hip[0] - 8, hip[1]] : hip;
    const res = (spec, s, h) => Array.isArray(spec) ? spec : spec.s ? add(s, spec.s) : add(h, spec.h);
    const cx = sh[0];
    const mir = (q) => [2 * cx - q[0], q[1]];
    const mirV = (v) => [-v[0], v[1]];

    const eb = p.eb || [0, 1], kb = p.kb || [1, 0];
    const fa = p.fa == null ? 82 : p.fa;
    const hN = res(p.hand, shN, hipN);
    const armN = ik(shN, hN, L.ua, L.fa, eb);
    const fN = res(p.foot, shN, hipN);
    const legN = ik(hipN, fN, L.th, L.sh, kb);
    let armF, legF, fa2;
    if (front) {
      armF = ik(shF, mir(hN), L.ua, L.fa, mirV(eb));
      legF = ik(hipF, mir(fN), L.th, L.sh, mirV(kb));
      fa2 = -fa;
    } else {
      armF = ik(shF, p.hand2 ? res(p.hand2, shF, hipF) : hN, L.ua, L.fa, p.eb2 || eb);
      legF = ik(hipF, p.foot2 ? res(p.foot2, shF, hipF) : fN, L.th, L.sh, p.kb2 || kb);
      fa2 = p.fa2 == null ? fa : p.fa2;
    }
    return {
      front, flip: !!p.flip, hip, sh, head, shN, shF, hipN, hipF, td,
      arm: [shN, armN.j, armN.e], arm2: [shF, armF.j, armF.e],
      leg: [hipN, legN.j, legN.e, add(legN.e, dir(fa), L.ft)],
      leg2: [hipF, legF.j, legF.e, add(legF.e, dir(fa2), L.ft)],
      hand: armN.e, hand2: armF.e, ankle: legN.e, ankle2: legF.e
    };
  }

  const TOOLS = {
    barbell: (h) => `<circle class="fx-plate" cx="${F(h[0])}" cy="${F(h[1])}" r="15"/><circle class="fx-hub" cx="${F(h[0])}" cy="${F(h[1])}" r="3"/>`,
    ez: (h) => `<circle class="fx-plate" cx="${F(h[0])}" cy="${F(h[1])}" r="10"/><circle class="fx-hub" cx="${F(h[0])}" cy="${F(h[1])}" r="2.5"/>`,
    db: (h) => `<circle class="fx-db" cx="${F(h[0])}" cy="${F(h[1])}" r="6.5"/><circle class="fx-hub" cx="${F(h[0])}" cy="${F(h[1])}" r="2"/>`,
    handle: (h) => `<circle class="fx-handle" cx="${F(h[0])}" cy="${F(h[1])}" r="4"/>`,
    bar: (h) => `<rect class="fx-handle" x="${F(h[0] - 14)}" y="${F(h[1] - 2.5)}" width="28" height="5" rx="2.5"/>`
  };

  const line = (a, b, cls) => `<line class="${cls}" x1="${F(a[0])}" y1="${F(a[1])}" x2="${F(b[0])}" y2="${F(b[1])}"/>`;
  const cable = (from) => (J) => line(from, J.hand, 'fx-cable');

  // ---------- anatomical body ----------
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const len = (v) => Math.hypot(v[0], v[1]) || 1e-6;
  const unit = (v) => { const l = len(v); return [v[0] / l, v[1] / l]; };
  const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
  const angBetween = (u, v) => Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]);
  const P2 = (p) => F(p[0]) + ' ' + F(p[1]);

  // Body segment widths: [start, middle, end]
  const WD = { th: [21, 22, 13], sh: [13, 13, 8], ua: [13, 13.5, 10], fa: [10.5, 10, 7], ft: [8, 7, 6] };
  const wAt = (w, t) => (t < 0.5 ? w[0] + (w[1] - w[0]) * t * 2 : w[1] + (w[2] - w[1]) * (t - 0.5) * 2);

  // A tapered limb with rounded ends that passes through the mid width.
  function seg(a, b, w, cls) {
    const u = unit(sub(b, a)), n = [-u[1], u[0]];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const A1 = add(a, n, w[0] / 2), B1 = add(b, n, w[2] / 2), A2 = add(a, n, -w[0] / 2), B2 = add(b, n, -w[2] / 2);
    const c1 = add(m, n, w[1] - (w[0] + w[2]) / 4), c2 = add(m, n, -(w[1] - (w[0] + w[2]) / 4));
    return `<path class="${cls}" d="M${P2(A1)} Q${P2(c1)} ${P2(B1)} A${F(w[2] / 2)} ${F(w[2] / 2)} 0 0 0 ${P2(B2)} Q${P2(c2)} ${P2(A2)} A${F(w[0] / 2)} ${F(w[0] / 2)} 0 0 0 ${P2(A1)} Z"/>`;
  }
  // A muscle belly lying on the surface of a segment, on the side `side` (unit vector perpendicular to the segment).
  function belly(a, b, w, side, t0, t1, h, cls) {
    const d = sub(b, a), tm = (t0 + t1) / 2;
    const at = (t, k) => add(add(a, d, t), side, wAt(w, t) / 2 + k);
    const p0 = at(t0, -1.2), p1 = at(t1, -1.2);
    return `<path class="${cls}" d="M${P2(p0)} Q${P2(at(tm, h))} ${P2(p1)} Q${P2(at(tm, -h * 1.7))} ${P2(p0)} Z"/>`;
  }
  // A muscle in the middle of a segment (front view: facing the viewer).
  function inset(a, b, w, t0, t1, k, cls) {
    const d = sub(b, a);
    const p0 = add(a, d, t0), p1 = add(a, d, t1);
    return seg(p0, p1, [wAt(w, t0) * k, wAt(w, (t0 + t1) / 2) * k * 1.12, wAt(w, t1) * k], cls);
  }
  // Smooth closed curve through points (Catmull-Rom).
  function smooth(pts) {
    const n = pts.length;
    let d = `M${P2(pts[0])}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${P2(c1)} ${P2(c2)} ${P2(p2)}`;
    }
    return d + ' Z';
  }

  function draw(anim, J, mus) {
    const prim = mus.m || [], sec = mus.s || [];
    const mc = (k) => (prim.includes(k) ? 'fx-m fx-on' : sec.includes(k) ? 'fx-m fx-on2' : 'fx-m');
    let s = '';
    if (!anim.nofloor) s += '<line class="fx-floor" x1="0" y1="186" x2="240" y2="186"/>';
    s += anim.scene || '';
    if (anim.back) s += anim.back(J);

    const td = J.td;
    let Fv = [-td[1], td[0]];
    if (J.flip) Fv = [-Fv[0], -Fv[1]];
    const down = [-td[0], -td[1]];

    // limb: chain [root, joint, end, (toe)], returns svg; far = drawn behind the body
    function limb(ch, kind, far) {
      const base = far ? 'fx-body fx-farb' : 'fx-body';
      const mcF = (k) => mc(k) + (far ? ' fx-farm' : '');
      let out = '';
      const u1 = unit(sub(ch[1], ch[0])), u2 = unit(sub(ch[2], ch[1]));
      if (J.front) {
        if (kind === 'leg') {
          out += seg(ch[2], ch[3], WD.ft, 'fx-shoe');
          out += seg(ch[1], ch[2], WD.sh, base) + seg(ch[0], ch[1], WD.th, base);
          out += inset(ch[0], ch[1], WD.th, 0.12, 0.86, 0.62, mcF('quads'));
        } else {
          out += seg(ch[1], ch[2], WD.fa, base) + seg(ch[0], ch[1], WD.ua, base);
          out += inset(ch[0], ch[1], WD.ua, 0.25, 0.85, 0.6, mcF('biceps'));
          out += `<circle class="fx-hand${far ? ' fx-farb' : ''}" cx="${F(ch[2][0])}" cy="${F(ch[2][1])}" r="4.6"/>`;
        }
        return out;
      }
      // anatomical front of each segment: the torso front rotated by the limb's flexion
      const f1 = rot(Fv, angBetween(down, u1));
      const f2 = rot(f1, angBetween(u1, u2));
      const nb1 = [-f1[0], -f1[1]], nb2 = [-f2[0], -f2[1]];
      if (kind === 'leg') {
        out += seg(ch[2], ch[3], WD.ft, 'fx-shoe');
        out += seg(ch[1], ch[2], WD.sh, base);
        out += belly(ch[1], ch[2], WD.sh, nb2, 0.08, 0.58, 4.2, mcF('calves'));
        out += seg(ch[0], ch[1], WD.th, base);
        out += belly(ch[0], ch[1], WD.th, f1, 0.14, 0.9, 3.8, mcF('quads'));
        out += belly(ch[0], ch[1], WD.th, nb1, 0.18, 0.86, 3.2, mcF('hams'));
      } else {
        out += seg(ch[1], ch[2], WD.fa, base);
        out += `<circle class="fx-hand${far ? ' fx-farb' : ''}" cx="${F(ch[2][0])}" cy="${F(ch[2][1])}" r="4.6"/>`;
        out += seg(ch[0], ch[1], WD.ua, base);
        out += belly(ch[0], ch[1], WD.ua, f1, 0.22, 0.86, 3.4, mcF('biceps'));
        out += belly(ch[0], ch[1], WD.ua, nb1, 0.12, 0.82, 3.4, mcF('tris'));
      }
      return out;
    }

    let chestTop = '';
    function torsoSide() {
      const L0 = L.torso;
      const prof = [[-0.14, 8, 10], [0.02, 10.5, 13], [0.3, 9.5, 9.5], [0.6, 11.5, 10.5], [0.84, 14, 11.5], [1.0, 11, 10.5], [1.12, 5, 6]];
      const at = (t, off, side) => add(add(J.hip, td, t * L0), side, off);
      const pts = prof.map(([t, f]) => at(t, f, Fv)).concat(prof.slice().reverse().map(([t, , b]) => at(t, -b, Fv)));
      let o = `<path class="fx-body" d="${smooth(pts)}"/>`;
      const fAt = (t) => { for (let i = 1; i < prof.length; i++) if (t <= prof[i][0]) { const [t0, f0, b0] = prof[i - 1], [t1, f1, b1] = prof[i]; const k = (t - t0) / (t1 - t0); return [f0 + (f1 - f0) * k, b0 + (b1 - b0) * k]; } return [prof[6][1], prof[6][2]]; };
      const lens = (t0, t1, front, h, cls) => {
        const side = front ? Fv : [-Fv[0], -Fv[1]], idx = front ? 0 : 1, tm = (t0 + t1) / 2;
        const p = (t, k) => at(t, fAt(t)[idx] + k, side);
        return `<path class="${cls}" d="M${P2(p(t0, -1.5))} Q${P2(p(tm, h))} ${P2(p(t1, -1.5))} Q${P2(p(tm, -h * 1.8))} ${P2(p(t0, -1.5))} Z"/>`;
      };
      o += lens(-0.16, 0.24, false, 5.5, mc('glutes'));
      o += lens(0.34, 0.9, false, 3.6, mc('back'));
      o += lens(0.86, 1.12, false, 2.4, mc('back'));
      chestTop = lens(0.54, 0.99, true, 5, mc('chest'));
      o += lens(0.1, 0.58, true, 2.6, mc('core'));
      [0.25, 0.4].forEach((t) => { o += line(at(t, fAt(t)[0] - 4, Fv), at(t, fAt(t)[0] + 0.5, Fv), 'fx-line'); });
      return o;
    }

    function torsoFront() {
      const c = J.sh[0], y0 = J.sh[1], y1 = J.hip[1];
      const H = y1 - y0;
      const pts = [[c - 22, y0 - 1], [c - 19, y0 + H * 0.3], [c - 14, y0 + H * 0.65], [c - 16, y1 + 2], [c - 9, y1 + 9], [c + 9, y1 + 9], [c + 16, y1 + 2], [c + 14, y0 + H * 0.65], [c + 19, y0 + H * 0.3], [c + 22, y0 - 1], [c + 6, y0 - 6], [c - 6, y0 - 6]];
      let o = `<path class="fx-body" d="${smooth(pts)}"/>`;
      o += `<path class="${mc('back')}" d="M${c - 19} ${y0 + H * 0.12} Q${c - 22} ${y0 + H * 0.4} ${c - 14} ${y0 + H * 0.62} L${c - 15} ${y0 + H * 0.2} Z"/>`;
      o += `<path class="${mc('back')}" d="M${c + 19} ${y0 + H * 0.12} Q${c + 22} ${y0 + H * 0.4} ${c + 14} ${y0 + H * 0.62} L${c + 15} ${y0 + H * 0.2} Z"/>`;
      o += `<ellipse class="${mc('chest')}" cx="${c - 8.5}" cy="${y0 + 9}" rx="9" ry="6.5"/><ellipse class="${mc('chest')}" cx="${c + 8.5}" cy="${y0 + 9}" rx="9" ry="6.5"/>`;
      o += `<rect class="${mc('core')}" x="${c - 6.5}" y="${y0 + 18}" width="13" height="${Math.max(8, H - 24)}" rx="4"/>`;
      o += `<path class="fx-line" d="M${c} ${y0 + 19} V${y1 - 7} M${c - 6} ${y0 + 18 + (H - 24) / 3} H${c + 6} M${c - 6} ${y0 + 18 + (H - 24) * 2 / 3} H${c + 6}"/>`;
      return o;
    }

    function head() {
      const h = J.head;
      let o = line(J.sh, add(J.sh, td, L.neck + 2), 'fx-neck');
      o += `<circle class="fx-body" cx="${F(h[0])}" cy="${F(h[1])}" r="${L.head + 1}"/>`;
      if (J.front) {
        o += `<path class="fx-hair" d="M${F(h[0] - 11)} ${F(h[1] - 1)} A11 11 0 0 1 ${F(h[0] + 11)} ${F(h[1] - 1)} Q${F(h[0])} ${F(h[1] - 7)} ${F(h[0] - 11)} ${F(h[1] - 1)} Z"/>`;
        o += `<circle class="fx-eye" cx="${F(h[0] - 4)}" cy="${F(h[1] + 1)}" r="1.4"/><circle class="fx-eye" cx="${F(h[0] + 4)}" cy="${F(h[1] + 1)}" r="1.4"/>`;
      } else {
        const back = add(h, Fv, -11), top = add(h, td, 11), fr = add(add(h, Fv, 6), td, 7);
        o += `<path class="fx-hair" d="M${P2(back)} A11 11 0 0 1 ${P2(fr)} Q${P2(add(h, td, 3))} ${P2(back)} Z"/>`;
        o += `<circle class="fx-eye" cx="${F(h[0] + Fv[0] * 6 + td[0] * 1.5)}" cy="${F(h[1] + Fv[1] * 6 + td[1] * 1.5)}" r="1.5"/>`;
        void top;
      }
      return o;
    }

    function delt(p, far) {
      const k = (prim.includes('shoulders') || prim.includes('rear')) ? 'fx-m fx-on' : (sec.includes('shoulders') || sec.includes('rear')) ? 'fx-m fx-on2' : 'fx-m';
      return `<circle class="${k}${far ? ' fx-farm' : ''}" cx="${F(p[0])}" cy="${F(p[1])}" r="7.6"/>`;
    }

    s += limb(J.leg2, 'leg', !J.front);
    s += limb(J.arm2, 'arm', !J.front);
    if (J.front && anim.tool && TOOLS[anim.tool]) s += TOOLS[anim.tool](J.hand2);
    s += J.front ? torsoFront() : torsoSide();
    s += head();
    if (J.front) s += delt(J.shF, false);
    s += limb(J.leg, 'leg', false);
    s += limb(J.arm, 'arm', false);
    s += chestTop;
    s += delt(J.front ? J.shN : add(J.sh, unit(sub(J.arm[1], J.sh)), 4), false);
    if (anim.tool && TOOLS[anim.tool]) s += TOOLS[anim.tool](J.hand);
    if (anim.front) s += anim.front(J);
    return s;
  }

  // ---------- scenes ----------
  const benchFlat = '<rect class="fx-eq" x="40" y="120" width="132" height="9" rx="3"/><path class="fx-eqline" d="M60 129 V186 M152 129 V186"/>';
  const pullBar = '<path class="fx-eqline" d="M70 4 H190 M80 4 V-28 M180 4 V-28"/><circle class="fx-handle" cx="118" cy="4" r="3"/>';

  const S = { hip: [110, 102], torso: 180, foot: [108, 182], kb: [1, 0], fa: 82 };
  const P = (o) => Object.assign({}, S, o);

  const A = {
    'squat-bb': { hi: ['legs'], tool: 'barbell', tempo: [1.8, 1.2],
      kf: [P({ torso: 178, hand: { s: [-6, 4] }, eb: [-1, 0.4] }), P({ hip: [84, 148], torso: 140, hand: { s: [-6, 4] }, eb: [-1, 0.4] })] },
    'squat-goblet': { hi: ['legs'], tool: 'db', tempo: [1.8, 1.2],
      kf: [P({ torso: 178, hand: { s: [10, 24] } }), P({ hip: [86, 150], torso: 152, hand: { s: [10, 24] } })] },
    'squat-bw': { hi: ['legs'], tempo: [1.6, 1.1],
      kf: [P({ hand: { s: [4, 54] } }), P({ hip: [84, 148], torso: 142, hand: { s: [52, 6] } })] },
    'legpress': { hi: ['legs'], tempo: [1.8, 1.2],
      scene: '<path class="fx-pad" d="M24 104 L76 168 L116 172"/><path class="fx-eqline" d="M60 172 V186 M100 172 V186 M150 186 L214 60"/>',
      front: (J) => {
        const n = [0.707, -0.707], u = [0.707, 0.707];
        const c0 = add(J.ankle, n, 5);
        return line(add(c0, u, 10), add(c0, u, -22), 'fx-sled');
      },
      kf: [
        { hip: [80, 160], torso: 220, foot: [135, 105], kb: [-0.7, -0.7], fa: 225, hand: [84, 160], eb: [0, 1] },
        { hip: [80, 160], torso: 220, foot: [108, 132], kb: [-0.7, -0.7], fa: 225, hand: [84, 160], eb: [0, 1] }] },
    'rdl-bb': { hi: ['legs', 'torso'], tool: 'barbell', tempo: [2, 1.2],
      kf: [P({ hand: { s: [2, 54] }, eb: [1, 0] }), P({ hip: [88, 108], torso: 120, hand: { s: [-6, 55] }, eb: [1, 0] })] },
    'rdl-db': { hi: ['legs', 'torso'], tool: 'db', tempo: [2, 1.2],
      kf: [P({ hand: { s: [2, 54] }, eb: [1, 0] }), P({ hip: [88, 108], torso: 120, hand: { s: [-6, 55] }, eb: [1, 0] })] },
    'deadlift': { hi: ['legs', 'torso'], tool: 'barbell', tempo: [1.6, 1.4],
      kf: [P({ hand: { s: [2, 54] }, eb: [1, 0] }), P({ hip: [86, 135], torso: 112, kb: [1, -0.2], hand: { s: [-12, 55] }, eb: [1, 0] })] },
    'sl-rdl': { hi: ['legs', 'torso'], tool: 'db', tempo: [2, 1.4],
      kf: [P({ foot2: { h: [-4, 80] }, kb2: [0, 1], fa2: 82, hand: { s: [2, 54] }, eb: [1, 0] }),
        P({ hip: [100, 104], torso: 100, foot2: { h: [-80, -6] }, kb2: [0, 1], fa2: 10, hand: { s: [0, 54] }, eb: [1, 0] })] },
    'lunge': { hi: ['legs'], tool: 'db', tempo: [1.6, 1.2],
      kf: [{ hip: [110, 104], torso: 180, foot: [135, 182], kb: [1, -0.3], foot2: [74, 172], kb2: [0.3, 1], fa: 82, fa2: 30, hand: { s: [0, 54] } },
        { hip: [106, 140], torso: 178, foot: [135, 182], kb: [1, -0.3], foot2: [74, 172], kb2: [0.3, 1], fa: 82, fa2: 30, hand: { s: [0, 54] } }] },
    'bulgarian': { hi: ['legs'], tool: 'db', tempo: [1.8, 1.2],
      scene: '<rect class="fx-eq" x="20" y="138" width="56" height="9" rx="3"/><path class="fx-eqline" d="M30 147 V186 M66 147 V186"/>',
      kf: [{ hip: [114, 104], torso: 176, foot: [140, 182], kb: [1, -0.3], foot2: [62, 134], kb2: [0.2, 1], fa: 82, fa2: -70, hand: { s: [0, 54] } },
        { hip: [110, 140], torso: 166, foot: [140, 182], kb: [1, -0.3], foot2: [62, 134], kb2: [0.2, 1], fa: 82, fa2: -70, hand: { s: [0, 54] } }] },
    'stepup': { hi: ['legs'], tool: 'db', tempo: [1.4, 1.4],
      scene: '<rect class="fx-eq" x="120" y="150" width="58" height="36" rx="3"/>',
      kf: [{ hip: [98, 108], torso: 166, foot: [140, 146], kb: [1, -0.5], foot2: [92, 182], kb2: [1, 0], fa: 82, fa2: 82, hand: { s: [0, 54] } },
        { hip: [136, 66], torso: 180, foot: [140, 146], kb: [1, -0.5], foot2: [118, 130], kb2: [1, 0], fa: 82, fa2: 70, hand: { s: [0, 54] } }] },
    'bench-bb': { hi: ['arms', 'torso'], tool: 'barbell', tempo: [2, 1], scene: benchFlat,
      kf: [{ hip: [80, 112], torso: 90, foot: [60, 182], kb: [0.2, -1], hand: { s: [2, -55] }, eb: [0, 1] },
        { hip: [80, 112], torso: 90, foot: [60, 182], kb: [0.2, -1], hand: { s: [8, -16] }, eb: [-0.3, 1] }] },
    'bench-db': { hi: ['arms', 'torso'], tool: 'db', tempo: [2, 1], scene: benchFlat,
      kf: [{ hip: [80, 112], torso: 90, foot: [60, 182], kb: [0.2, -1], hand: { s: [2, -55] }, eb: [0, 1] },
        { hip: [80, 112], torso: 90, foot: [60, 182], kb: [0.2, -1], hand: { s: [6, -10] }, eb: [-0.3, 1] }] },
    'incline': { hi: ['arms', 'torso'], tool: 'db', tempo: [2, 1],
      scene: '<path class="fx-pad" d="M82 143 L150 96"/><path class="fx-eqline" d="M56 148 H92 M90 148 V186 M138 106 L150 186"/>',
      kf: [{ hip: [84, 132], torso: 125, foot: [52, 182], kb: [0, -1], hand: { s: [0, -55] }, eb: [0, 1] },
        { hip: [84, 132], torso: 125, foot: [52, 182], kb: [0, -1], hand: { s: [10, -14] }, eb: [0, 1] }] },
    'incline-bb': { hi: ['arms', 'torso'], tool: 'barbell', tempo: [2, 1],
      scene: '<path class="fx-pad" d="M82 143 L150 96"/><path class="fx-eqline" d="M56 148 H92 M90 148 V186 M138 106 L150 186"/>',
      kf: [{ hip: [84, 132], torso: 125, foot: [52, 182], kb: [0, -1], hand: { s: [0, -55] }, eb: [0, 1] },
        { hip: [84, 132], torso: 125, foot: [52, 182], kb: [0, -1], hand: { s: [12, -16] }, eb: [0, 1] }] },
    'fly-db': { hi: ['arms', 'torso'], tool: 'db', tempo: [2, 1.4], view: 'top',
      scene: '<rect class="fx-eq" x="102" y="18" width="36" height="150" rx="6"/>', nofloor: true,
      kf: [{ front: true, hip: [120, 120], torso: 180, foot: { h: [22, 62] }, kb: [1, 0], fa: 90, hand: { s: [-11, 10] }, eb: [1, 0.3] },
        { front: true, hip: [120, 120], torso: 180, foot: { h: [22, 62] }, kb: [1, 0], fa: 90, hand: { s: [52, 4] }, eb: [0, 1] }] },
    'fly-cable': { hi: ['arms', 'torso'], tool: 'handle', tempo: [1.6, 1.2], view: 'front',
      back: (J) => line([232, -24], J.hand, 'fx-cable') + line([8, -24], J.hand2, 'fx-cable'),
      kf: [{ front: true, hip: [120, 102], torso: 180, foot: { h: [6, 80] }, kb: [1, 0], fa: 70, hand: { s: [50, -12] }, eb: [0, 1] },
        { front: true, hip: [120, 102], torso: 180, foot: { h: [6, 80] }, kb: [1, 0], fa: 70, hand: { s: [-9, 34] }, eb: [1, 0.3] }] },
    'pushup': { hi: ['arms', 'torso'], tempo: [1.6, 1],
      kf: [{ hip: [127.5, 147.3], torso: 109, foot: [50, 174], kb: [0, -1], fa: 15, hand: [178, 184], eb: [-1, -0.6] },
        { hip: [131.5, 165.4], torso: 96, foot: [50, 174], kb: [0, -1], fa: 15, hand: [178, 184], eb: [-1, -0.6] }] },
    'pike': { hi: ['arms'], tempo: [1.6, 1.1],
      kf: [{ hip: [112, 104], torso: 52.7, foot: [70, 174], kb: [0, -1], fa: 15, hand: [156, 184], eb: [-1, -0.5] },
        { hip: [114, 112], torso: 35, foot: [70, 174], kb: [0, -1], fa: 15, hand: [156, 184], eb: [-1, -0.5] }] },
    'bench-dip': { hi: ['arms'], tempo: [1.6, 1.1],
      scene: '<rect class="fx-eq" x="26" y="120" width="62" height="66" rx="3"/>',
      kf: [{ hip: [94, 120], torso: 178, foot: [150, 182], kb: [0, -1], hand: [88, 120], eb: [-1, -0.5] },
        { hip: [96, 152], torso: 178, foot: [150, 182], kb: [0, -1], hand: [88, 120], eb: [-1, -0.5] }] },
    'dip': { hi: ['arms', 'torso'], tempo: [1.8, 1.1],
      scene: '<path class="fx-eqline" d="M104 70 V186 M80 70 H130"/><circle class="fx-handle" cx="104" cy="70" r="4"/>',
      kf: [{ hip: [98, 68], torso: 176, foot: { h: [-22, 60] }, kb: [1, 0], fa: 40, hand: [104, 70], eb: [-1, -0.3] },
        { hip: [96, 102], torso: 160, foot: { h: [-22, 60] }, kb: [1, 0], fa: 40, hand: [104, 70], eb: [-1, -0.3] }] },
    'ohp-bb': { hi: ['arms'], tool: 'barbell', tempo: [1.6, 1.2],
      kf: [P({ hand: { s: [12, 4] }, eb: [0.4, 1] }), P({ hand: { s: [2, -55] }, eb: [0.4, 1] })] },
    'ohp-db': { hi: ['arms'], tool: 'db', tempo: [1.6, 1.2],
      scene: '<rect class="fx-eq" x="70" y="146" width="56" height="8" rx="3"/><rect class="fx-eq" x="84" y="64" width="8" height="84" rx="3"/><path class="fx-eqline" d="M80 154 V186 M118 154 V186"/>',
      kf: [{ hip: [100, 138], torso: 180, foot: [146, 182], kb: [1, -1], hand: { s: [0, -6] }, eb: [0, 1] },
        { hip: [100, 138], torso: 180, foot: [146, 182], kb: [1, -1], hand: { s: [0, -55] }, eb: [0, 1] }] },
    'lateral': { hi: ['arms'], tool: 'db', tempo: [1.6, 1.1], view: 'front',
      kf: [{ front: true, hip: [120, 102], torso: 180, foot: [132, 182], kb: [1, 0], fa: 70, hand: { s: [5, 53] }, eb: [1, 0] },
        { front: true, hip: [120, 102], torso: 180, foot: [132, 182], kb: [1, 0], fa: 70, hand: { s: [52, -2] }, eb: [0, -1] }] },
    'row-bb': { hi: ['arms', 'torso'], tool: 'barbell', tempo: [1.6, 1.1],
      kf: [{ hip: [92, 104], torso: 115, foot: [106, 182], kb: [1, 0], hand: { s: [0, 54] }, eb: [-0.5, -1] },
        { hip: [92, 104], torso: 115, foot: [106, 182], kb: [1, 0], hand: { s: [-26, 22] }, eb: [-0.5, -1] }] },
    'row-db': { hi: ['arms', 'torso'], tool: 'db', tempo: [1.6, 1.1],
      scene: '<rect class="fx-eq" x="122" y="128" width="84" height="8" rx="3"/><path class="fx-eqline" d="M134 136 V186 M196 136 V186"/>',
      kf: [{ hip: [96, 104], torso: 100, foot: [104, 182], kb: [1, 0], hand: { s: [0, 52] }, eb: [-1, -0.3], hand2: [150, 128], eb2: [0, 1] },
        { hip: [96, 104], torso: 100, foot: [104, 182], kb: [1, 0], hand: { s: [-24, 18] }, eb: [-0.3, -1], hand2: [150, 128], eb2: [0, 1] }] },
    'row-cable': { hi: ['arms', 'torso'], tool: 'handle', tempo: [1.6, 1.1],
      scene: '<rect class="fx-eq" x="58" y="166" width="64" height="20" rx="3"/><path class="fx-eqline" d="M176 156 V186 M222 140 V186"/><circle class="fx-handle" cx="222" cy="150" r="4"/>',
      back: cable([222, 150]),
      kf: [{ hip: [90, 158], torso: 148, foot: [170, 170], kb: [0, -1], fa: 180, hand: { s: [54, 6] }, eb: [0, 1] },
        { hip: [90, 158], torso: 186, foot: [170, 170], kb: [0, -1], fa: 180, hand: { s: [16, 26] }, eb: [-1, 0] }] },
    'row-inverted': { hi: ['arms', 'torso'], tempo: [1.4, 1.2],
      scene: '<rect class="fx-eq" x="124" y="104" width="100" height="8" rx="2"/><path class="fx-eqline" d="M214 112 V186"/>',
      kf: [{ hip: [109.8, 171.8], torso: 94.3, foot: [28, 178], kb: [0, -1], fa: 160, hand: [160, 112], eb: [-0.6, 1] },
        { hip: [103.6, 146.3], torso: 112.8, foot: [28, 178], kb: [0, -1], fa: 160, hand: [160, 112], eb: [-0.6, 1] }] },
    'pullup': { hi: ['arms', 'torso'], tempo: [1.4, 1.6], scene: pullBar,
      kf: [{ hip: [110, 110], torso: 178, foot: { h: [-22, 62] }, kb: [1, 0.2], fa: 40, hand: [118, 4], eb: [-0.4, 1] },
        { hip: [108, 74], torso: 172, foot: { h: [-22, 62] }, kb: [1, 0.2], fa: 40, hand: [118, 4], eb: [-0.4, 1] }] },
    'latpull': { hi: ['arms', 'torso'], tool: 'bar', tempo: [1.4, 1.6],
      scene: '<rect class="fx-eq" x="70" y="144" width="62" height="8" rx="3"/><circle class="fx-eq" cx="138" cy="124" r="7"/><path class="fx-eqline" d="M100 152 V186 M150 -28 V186"/>',
      back: (J) => line([J.hand[0], -28], J.hand, 'fx-cable'),
      kf: [{ hip: [100, 138], torso: 186, foot: [146, 182], kb: [1, -1], hand: { s: [6, -54] }, eb: [0, 1] },
        { hip: [100, 138], torso: 186, foot: [146, 182], kb: [1, -1], hand: { s: [10, 2] }, eb: [-0.3, 1] }] },
    'pullover': { hi: ['torso', 'arms'], tool: 'db', tempo: [2, 1.4], scene: benchFlat,
      kf: [{ hip: [80, 112], torso: 90, foot: [60, 182], kb: [0.2, -1], hand: { s: [0, -54] }, eb: [0, -1] },
        { hip: [80, 112], torso: 90, foot: [60, 182], kb: [0.2, -1], hand: { s: [50, -14] }, eb: [0, -1] }] },
    'curl': { hi: ['arms'], tool: 'db', tempo: [1.8, 1],
      kf: [P({ hand: { s: [3, 55] }, eb: [-1, 0.2] }), P({ hand: { s: [18, 10] }, eb: [-1, 0.2] })] },
    'curl-bb': { hi: ['arms'], tool: 'ez', tempo: [1.8, 1],
      kf: [P({ hand: { s: [3, 55] }, eb: [-1, 0.2] }), P({ hand: { s: [18, 10] }, eb: [-1, 0.2] })] },
    'curl-cable': { hi: ['arms'], tool: 'handle', tempo: [1.8, 1], back: cable([156, 184]),
      scene: '<path class="fx-eqline" d="M166 186 V-20"/>',
      kf: [P({ hand: { s: [3, 55] }, eb: [-1, 0.2] }), P({ hand: { s: [18, 10] }, eb: [-1, 0.2] })] },
    'pushdown': { hi: ['arms'], tool: 'handle', tempo: [1.6, 1], back: cable([150, -26]),
      scene: '<path class="fx-eqline" d="M162 186 V-28"/>',
      kf: [P({ torso: 174, foot: [106, 182], hand: { s: [24, 16] }, eb: [-1, 0] }), P({ torso: 174, foot: [106, 182], hand: { s: [8, 54] }, eb: [-1, 0] })] },
    'oh-ext': { hi: ['arms'], tool: 'db', tempo: [2, 1],
      kf: [P({ hand: { s: [-10, -6] }, eb: [0.3, -1] }), P({ hand: { s: [2, -55] }, eb: [0.3, -1] })] },
    'skull': { hi: ['arms'], tool: 'ez', tempo: [2, 1], scene: benchFlat,
      kf: [{ hip: [80, 112], torso: 90, foot: [60, 182], kb: [0.2, -1], hand: { s: [0, -55] }, eb: [-0.6, -1] },
        { hip: [80, 112], torso: 90, foot: [60, 182], kb: [0.2, -1], hand: { s: [24, -17] }, eb: [-0.6, -1] }] },
    'leg-ext': { hi: ['legs'], tempo: [1.8, 1],
      scene: '<rect class="fx-eq" x="70" y="144" width="74" height="8" rx="3"/><rect class="fx-eq" x="78" y="68" width="8" height="80" rx="3"/><path class="fx-eqline" d="M80 152 V186 M138 152 V186"/>',
      front: (J) => `<circle class="fx-eq" cx="${F(J.ankle[0] + 4)}" cy="${F(J.ankle[1] - 2)}" r="6"/>`,
      kf: [{ hip: [100, 138], torso: 180, foot: [138, 180], kb: [1, -0.6], fa: 82, hand: { h: [4, 10] } },
        { hip: [100, 138], torso: 180, foot: [182, 132], kb: [1, -0.6], fa: 150, hand: { h: [4, 10] } }] },
    'leg-curl': { hi: ['legs'], tempo: [1.8, 1],
      scene: '<rect class="fx-eq" x="60" y="124" width="142" height="9" rx="3"/><path class="fx-eqline" d="M76 133 V186 M186 133 V186"/>',
      front: (J) => `<circle class="fx-eq" cx="${F(J.ankle[0])}" cy="${F(J.ankle[1] - 7)}" r="6"/>`,
      kf: [{ hip: [110, 118], torso: 90, foot: [30, 120], kb: [0, 1], fa: 0, hand: { s: [14, 24] }, eb: [1, 0] },
        { hip: [110, 118], torso: 90, foot: [74, 74], kb: [0, 1], fa: -60, hand: { s: [14, 24] }, eb: [1, 0] }] },
    'slider-curl': { hi: ['legs'], tempo: [1.8, 1.2],
      kf: [{ hip: [118, 160], torso: 73, foot: [40, 180], kb: [0, -1], fa: 170, hand: [118, 182], eb: [0, 1] },
        { hip: [114, 148], torso: 63, foot: [70, 180], kb: [0, -1], fa: 170, hand: [118, 182], eb: [0, 1] }] },
    'calf': { hi: ['legs'], tool: 'db', tempo: [1.2, 1],
      kf: [P({ hip: [110, 100], foot: [108, 180], hand: { s: [0, 54] } }), P({ hip: [114, 92], foot: [112, 172], fa: 42, hand: { s: [0, 54] } })] },
    'hip-thrust': { hi: ['legs'], tempo: [1.4, 1.2],
      scene: '<rect class="fx-eq" x="150" y="134" width="70" height="9" rx="3"/><path class="fx-eqline" d="M160 143 V186 M210 143 V186"/>',
      front: (J) => TOOLS.barbell([J.hip[0], J.hip[1] - 12]),
      kf: [{ hip: [118, 176], torso: 132, foot: [74, 182], kb: [-0.3, -1], hand: { h: [2, -10] }, eb: [0, 1] },
        { hip: [114, 138], torso: 92, foot: [74, 182], kb: [-0.3, -1], hand: { h: [2, -10] }, eb: [0, 1] }] },
    'bridge': { hi: ['legs'], tempo: [1.4, 1.2],
      kf: [{ hip: [118, 178], torso: 92, foot: [76, 182], kb: [0, -1], hand: [124, 183], eb: [0, 1] },
        { hip: [118, 156], torso: 65, foot: [76, 182], kb: [0, -1], hand: [124, 183], eb: [0, 1] }] },
    'plank': { hi: ['torso'], tempo: [2, 2],
      kf: [{ hip: [109.2, 164.4], torso: 98.2, foot: [28, 176], kb: [0, -1], fa: 15, hand: [187, 184], eb: [0, 1] },
        { hip: [109.2, 162.6], torso: 97.4, foot: [28, 176], kb: [0, -1], fa: 15, hand: [187, 184], eb: [0, 1] }] },
    'knee-raise': { hi: ['torso', 'legs'], tempo: [1.6, 1.2], scene: pullBar,
      kf: [{ hip: [110, 110], torso: 178, foot: { h: [-4, 80] }, kb: [1, 0], hand: [118, 4], eb: [-0.4, 1] },
        { hip: [104, 108], torso: 186, foot: { h: [21, 4] }, kb: [1, -1], hand: [118, 4], eb: [-0.4, 1] }] },
    'cable-crunch': { hi: ['torso'], tool: 'handle', tempo: [1.4, 1.2], back: cable([150, -26]),
      scene: '<path class="fx-eqline" d="M162 186 V-28"/>',
      kf: [{ hip: [100, 132], torso: 178, foot: [52, 182], kb: [0.4, 1], fa: -100, hand: { s: [8, -8] }, eb: [1, 0.5] },
        { hip: [104, 130], torso: 115, foot: [52, 182], kb: [0.4, 1], fa: -100, hand: { s: [8, -8] }, eb: [1, 0.5] }] },
    'crunch': { hi: ['torso'], tempo: [1.4, 1.2],
      kf: [{ hip: [110, 176], torso: 92, foot: [62, 182], kb: [0, -1], hand: { s: [6, -10] }, eb: [1, -0.5] },
        { hip: [110, 176], torso: 114, foot: [62, 182], kb: [0, -1], hand: { s: [6, -10] }, eb: [1, -0.5] }] },
    'face-pull': { hi: ['arms', 'torso'], tool: 'handle', tempo: [1.4, 1.2], back: cable([226, 46]),
      scene: '<path class="fx-eqline" d="M232 186 V-20"/>',
      kf: [{ hip: [100, 102], torso: 186, foot: [100, 182], kb: [1, 0], hand: { s: [54, 4] }, eb: [0, 1] },
        { hip: [100, 102], torso: 186, foot: [100, 182], kb: [1, 0], hand: { s: [8, -12] }, eb: [-1, -0.5] }] },
    'rev-fly': { hi: ['arms', 'torso'], tool: 'db', tempo: [1.4, 1.2],
      kf: [{ hip: [92, 104], torso: 110, foot: [106, 182], kb: [1, 0], hand: { s: [2, 52] }, eb: [-1, 0] },
        { hip: [92, 104], torso: 110, foot: [106, 182], kb: [1, 0], hand: { s: [-4, 8] }, eb: [0, -1] }] },
    'ytw': { hi: ['arms', 'torso'], tempo: [1.4, 1.2],
      kf: [{ hip: [96, 178], torso: 90, foot: [16, 180], kb: [0, 1], fa: 0, hand: { s: [52, 4] }, eb: [0, -1] },
        { hip: [96, 178], torso: 98, foot: [16, 180], kb: [0, 1], fa: 0, hand: { s: [50, -14] }, eb: [0, -1] }] }
  };

  // Faces up (lying on the back): the chest points away from the default side.
  ['bench-bb', 'bench-db', 'incline', 'incline-bb', 'pullover', 'skull', 'hip-thrust', 'bridge', 'slider-curl', 'crunch', 'row-inverted']
    .forEach((k) => A[k].kf.forEach((p) => { p.flip = true; }));

  // ---------- machines ----------
  const seatUp = '<rect class="fx-eq" x="68" y="146" width="58" height="8" rx="3"/><rect class="fx-eq" x="72" y="62" width="9" height="88" rx="3"/><path class="fx-eqline" d="M80 154 V186 M118 154 V186 M62 186 H132"/>';
  const lever = (pivot) => (J) => `<line class="fx-lever" x1="${F(pivot[0])}" y1="${F(pivot[1])}" x2="${F(J.hand[0])}" y2="${F(J.hand[1])}"/><circle class="fx-handle" cx="${F(pivot[0])}" cy="${F(pivot[1])}" r="5"/>`;
  Object.assign(A, {
    'chest-press-m': { tool: 'handle', tempo: [1.8, 1.1],
      scene: seatUp + '<path class="fx-eqline" d="M200 186 V20 H176"/><rect class="fx-stack" x="206" y="96" width="18" height="60" rx="2"/>',
      back: lever([196, 24]),
      kf: [{ hip: [97, 140], torso: 182, foot: [140, 182], kb: [1, -1], hand: { s: [14, 8] }, eb: [-1, 0.3] },
        { hip: [97, 140], torso: 182, foot: [140, 182], kb: [1, -1], hand: { s: [54, 6] }, eb: [-1, 0.3] }] },
    'shoulder-press-m': { tool: 'handle', tempo: [1.8, 1.1],
      scene: seatUp + '<path class="fx-eqline" d="M40 186 V-24 H70"/><rect class="fx-stack" x="16" y="96" width="18" height="60" rx="2"/>',
      back: lever([60, -20]),
      kf: [{ hip: [99, 140], torso: 180, foot: [140, 182], kb: [1, -1], hand: { s: [6, -4] }, eb: [0, 1] },
        { hip: [99, 140], torso: 180, foot: [140, 182], kb: [1, -1], hand: { s: [6, -54] }, eb: [0, 1] }] },
    'pec-deck': { tool: 'handle', tempo: [1.8, 1.1], view: 'front',
      scene: '<rect class="fx-eq" x="103" y="44" width="34" height="92" rx="6"/><path class="fx-eqline" d="M60 -10 H180 M120 -10 V44 M120 136 V186"/><rect class="fx-eq" x="96" y="132" width="48" height="10" rx="3"/>',
      front: (J) => line(add(J.hand, [0, -13]), add(J.hand, [0, 13]), 'fx-lever') + line(add(J.hand2, [0, -13]), add(J.hand2, [0, 13]), 'fx-lever'),
      kf: [{ front: true, hip: [120, 126], torso: 180, foot: { h: [10, 58] }, kb: [1, 0], fa: 70, hand: { s: [44, 2] }, eb: [0, 1] },
        { front: true, hip: [120, 126], torso: 180, foot: { h: [10, 58] }, kb: [1, 0], fa: 70, hand: { s: [-9, 12] }, eb: [1, 0.3] }] },
    'cable-lateral': { tool: 'handle', tempo: [1.6, 1.1], view: 'front',
      scene: '<path class="fx-eqline" d="M8 186 V150 M232 186 V150"/>',
      back: (J) => line([12, 170], J.hand, 'fx-cable') + line([228, 170], J.hand2, 'fx-cable'),
      kf: [{ front: true, hip: [120, 102], torso: 180, foot: [132, 182], kb: [1, 0], fa: 70, hand: { s: [-2, 50] }, eb: [1, 0] },
        { front: true, hip: [120, 102], torso: 180, foot: [132, 182], kb: [1, 0], fa: 70, hand: { s: [52, -2] }, eb: [0, -1] }] },
    'hack-squat': { tempo: [1.8, 1.2],
      scene: '<path class="fx-eqline" d="M118 186 L60 24"/><rect class="fx-eq" x="112" y="180" width="54" height="6" rx="2"/>',
      back: (J) => {
        const Fv = [-J.td[1], J.td[0]];
        return line(add(add(J.hip, Fv, -13), J.td, -6), add(add(J.sh, Fv, -13), J.td, 10), 'fx-padl');
      },
      kf: [{ hip: [112, 103], torso: 194, foot: [130, 180], kb: [1, -0.2], fa: 70, hand: { s: [8, 4] }, eb: [0, 1] },
        { hip: [94, 146], torso: 202, foot: [130, 180], kb: [1, -0.2], fa: 70, hand: { s: [8, 4] }, eb: [0, 1] }] },
    'row-machine': { tool: 'handle', tempo: [1.4, 1.2],
      scene: '<rect class="fx-eq" x="70" y="152" width="46" height="8" rx="3"/><path class="fx-eqline" d="M92 160 V186 M128 186 V96 M204 186 V24"/><rect class="fx-eq" x="122" y="92" width="10" height="44" rx="4"/>',
      back: lever([204, 30]),
      kf: [{ hip: [92, 146], torso: 164, foot: [140, 182], kb: [1, -1], hand: { s: [54, 10] }, eb: [0, 1] },
        { hip: [92, 146], torso: 164, foot: [140, 182], kb: [1, -1], hand: { s: [4, 26] }, eb: [-1, 0.2] }] },
    'seated-leg-curl': { tempo: [1.6, 1.1],
      scene: '<rect class="fx-eq" x="70" y="144" width="74" height="8" rx="3"/><rect class="fx-eq" x="78" y="68" width="8" height="80" rx="3"/><path class="fx-eqline" d="M80 152 V186 M138 152 V186"/>',
      front: (J) => `<circle class="fx-eq" cx="132" cy="126" r="6"/><circle class="fx-eq" cx="${F(J.ankle[0] + 3)}" cy="${F(J.ankle[1] + 7)}" r="6"/>`,
      kf: [{ hip: [100, 138], torso: 180, foot: [182, 134], kb: [1, -0.6], fa: 150, hand: { h: [4, 10] } },
        { hip: [100, 138], torso: 180, foot: [130, 176], kb: [1, -0.6], fa: 82, hand: { h: [4, 10] } }] },
    'calf-m': { tempo: [1.2, 1],
      back: (J) => `<path class="fx-eqline" d="M62 186 V${F(J.sh[1] - 8)} H${F(J.sh[0])}"/>`,
      front: (J) => `<rect class="fx-eq" x="${F(J.sh[0] - 12)}" y="${F(J.sh[1] - 14)}" width="24" height="8" rx="4"/>`,
      scene: '<rect class="fx-eq" x="96" y="180" width="40" height="6" rx="2"/>',
      kf: [P({ hip: [110, 98], foot: [108, 178], hand: { s: [6, -8] }, eb: [0, 1] }), P({ hip: [114, 90], foot: [112, 170], fa: 42, hand: { s: [6, -8] }, eb: [0, 1] })] }
  });
  A['smith-squat'] = Object.assign({}, A['squat-bb'], { scene: '<path class="fx-eqline" d="M90 186 V-28 M134 186 V-28"/>' });

  // ---------- player ----------
  const ease = (x) => (1 - Math.cos(Math.PI * x)) / 2;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const figs = new Set();
  let raf = 0, last = 0;

  function phase(anim, t) {
    const [down, up] = anim.tempo || [1.6, 1.2];
    const hold = 0.35;
    const total = hold + down + hold + up;
    let x = t % total;
    if (x < hold) return 0;
    x -= hold;
    if (x < down) return ease(x / down);
    x -= down;
    if (x < hold) return 1;
    x -= hold;
    return 1 - ease(x / up);
  }

  function render(fig, k) {
    const anim = fig.anim;
    const pose = lerp(anim.kf[0], anim.kf[1], k);
    fig.g.innerHTML = draw(anim, solve(pose), fig.mus);
  }

  function loop(ts) {
    raf = 0;
    if (ts - last > 30) {
      last = ts;
      figs.forEach((f) => {
        if (f.visible && f.playing) render(f, phase(f.anim, ts / 1000 * f.speed + f.offset));
      });
    }
    if ([...figs].some((f) => f.visible && f.playing)) raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((e) => { const f = e.target.__fig; if (f) f.visible = e.isIntersecting; });
    kick();
  }, { rootMargin: '80px' }) : null;

  function mount(el, key, opts) {
    opts = opts || {};
    const anim = A[key];
    if (!anim) return null;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 -30 240 222');
    svg.setAttribute('class', 'fx');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', opts.label || 'אנימציית תרגיל');
    const g = document.createElementNS(ns, 'g');
    svg.appendChild(g);
    el.textContent = '';
    el.appendChild(svg);
    const fig = { el, svg, g, anim, mus: { m: opts.m || [], s: opts.s || [] }, visible: !io, playing: !reduce, offset: Math.random() * 2, speed: opts.speed || 1 };
    el.__fig = fig;
    render(fig, reduce ? 0.6 : 0);
    figs.add(fig);
    if (io) io.observe(el);
    kick();
    return {
      toggle() { fig.playing = !fig.playing; if (!fig.playing) render(fig, 0.6); kick(); return fig.playing; },
      setSpeed(s) { fig.speed = s; },
      destroy() { figs.delete(fig); if (io) io.unobserve(el); }
    };
  }

  function sweep() { figs.forEach((f) => { if (!document.body.contains(f.el)) { figs.delete(f); if (io) io.unobserve(f.el); } }); }

  window.Figure = { mount, sweep, anims: A, view: (k) => (A[k] && A[k].view) || 'side', reduce };
})();

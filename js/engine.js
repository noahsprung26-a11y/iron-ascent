'use strict';
// ---------- State ----------
const KEY = 'ironascent_v1';
function fresh() {
  return {
    profile: null, nut: null, plan: null, e1: null, logs: {}, mods: {}, reports: [], weights: [],
    food: { days: {}, custom: [] },
    hero: { xp: 0, streak: 0, best: 0, lastDay: null, freeze: 1, unlocked: {}, badges: {}, quests: {}, prs: {}, sets: 0, sessions: 0, weeksDone: 0, bossWon: {} },
    set: { key: '' }, ui: { tab: 'home' },
  };
}
let S = (() => { try { const r = JSON.parse(localStorage.getItem(KEY)); if (r) return Object.assign(fresh(), r); } catch (e) { } return fresh(); })();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }

// ---------- Helpers ----------
const dkey = d => { d = new Date(d); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const addDays = (k, n) => { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return dkey(d); };
const todayK = () => dkey(new Date());
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const med = a => { a = [...a].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const rnd = (x, s = 2.5) => Math.round(x / s) * s;
const r1 = x => Math.round(x * 10) / 10;

// %1RM aus Wiederholungen + RPE (RIR = 10 - RPE); an gängige RPE-Tabellen angelehnt
const pct = (r, rpe) => 1 / (1 + (r + (10 - rpe) - 1) / 25);
const e1of = (w, r, rpe) => w / pct(r, rpe);
// Verletzungslogik: sev 1 leicht (nur sehr belastende Übungen raus), 2 mäßig, 3 stark (alles was belastet raus)
const blocked = (ex, inj) => (inj || []).some(i => { const l = (ex.st || {})[i.area] || 0; return l > 0 && l >= 4 - i.sev; });

// ---------- Periodisierung ----------
function buildStructure(p) {
  const comp = p.compDate ? Math.ceil((new Date(p.compDate + 'T12:00:00') - new Date(p.start + 'T12:00:00')) / 6048e5) : 0;
  let acc, int, peak, taper;
  if (comp >= 1) {
    const total = Math.min(comp, 36); taper = 1;
    peak = total >= 8 ? 3 : total >= 5 ? 2 : Math.max(0, total - 1);
    const rest = Math.max(0, total - taper - peak); acc = Math.ceil(rest * .55); int = rest - acc;
  } else { acc = 5; int = 4; peak = 3; taper = 0; }
  const spec = []; let n = 0;
  const add = (phase, len) => { for (let i = 0; i < len; i++) { n++; const deload = (phase === 'acc' || phase === 'int') && ((i + 1) % 5 === 0 || (phase === 'acc' && i === len - 1 && len >= 4 && comp >= 1 && false)); spec.push({ n, phase, i, len, deload }); } };
  add('acc', acc); add('int', int); add('peak', peak); add('taper', taper);
  spec.forEach(s => { s.label = PHASES[s.phase] + (s.deload ? ' · Deload' : '') + (!p.compDate && s.n === spec.length ? ' · Test' : ''); });
  return spec;
}

function prescribe(type, phase, i, len, exp, deload) {
  const base = { beginner: { H: 3, V: 3, L: 2 }, intermediate: { H: 4, V: 4, L: 3 }, advanced: { H: 4, V: 5, L: 3 } }[exp][type];
  const prog = len > 1 ? i / (len - 1) : 0;
  let reps, rpe, sets;
  if (phase === 'acc') { reps = { H: 5, V: 8, L: 5 }[type]; rpe = { H: 7 + prog * 1.5, V: 6.5 + prog * 1.5, L: 6 }[type]; sets = base + Math.round(prog * 2); }
  else if (phase === 'int') { reps = { H: prog < .34 ? 4 : prog < .67 ? 3 : 2, V: 5, L: 3 }[type]; rpe = { H: 8 + prog, V: 7.5 + prog * .5, L: 6 }[type]; sets = base; }
  else if (phase === 'peak') { reps = { H: i < len - 1 ? 2 : 1, V: 3, L: 2 }[type]; rpe = { H: 8.5 + prog * .5, V: 7.5, L: 6 }[type]; sets = Math.max(2, base - 1); }
  else { reps = { H: 1, V: 2, L: 2 }[type]; rpe = { H: 7.5, V: 6.5, L: 6 }[type]; sets = 2; }
  if (deload) { sets = Math.max(2, Math.ceil(base / 2)); rpe = Math.min(rpe, 6.5); }
  rpe = Math.min(10, Math.round(rpe * 2) / 2);
  return { sets, reps, rpe, top: type === 'H' && exp !== 'beginner' && !deload && phase !== 'taper' };
}

function pickMain(lift, type, p, spec, warn) {
  const inj = p.injuries || [], ok = id => EX[id] && !blocked(EX[id], inj);
  let want = COMP[lift];
  if (type === 'V' && p.exp !== 'beginner' && spec.phase !== 'peak' && spec.phase !== 'taper') want = WVAR[lift][(p.weak || {})[lift]] || DEFVAR[lift];
  if (ok(want)) return want;
  if (ok(COMP[lift])) return COMP[lift];
  const fb = FALL[lift].find(ok);
  warn(`${LIFTS[lift]}: Wettkampfübung wegen Beschwerden ersetzt durch „${EX[fb || COMP[lift]].n}“.`);
  return fb || FALL[lift][FALL[lift].length - 1];
}

function pickAccs(lifts, p, spec, count, used) {
  const order = [];
  for (let i = 0; i < 6; i++) lifts.forEach(l => { if (SLOTS[l][i]) order.push([l, SLOTS[l][i]]); });
  const out = [], inj = p.injuries || [], rot = Math.floor((spec.n - 1) / 4);
  for (const [l, slot] of order) {
    if (out.length >= count) break;
    let pool = Object.entries(EX).filter(([id, e]) => e.acc && e.l.includes(l) && e.cat === slot && !used.has(id) && !blocked(e, inj));
    if (!pool.length) continue;
    const w = (p.weak || {})[l];
    pool = pool.map(([id, e], k) => [id, (w && e.tag.includes(w) ? 2 : 0) + ((k + rot) % pool.length) / 10]).sort((a, b) => b[1] - a[1]);
    used.add(pool[0][0]); out.push([pool[0][0], l]);
  }
  return out;
}

const estMin = items => 10 + items.reduce((t, it) => t + 1 + it.sets * (it.role === 'main' ? (it.type === 'L' ? 2.5 : 3.5) : 2.5), 0);

function buildSession(p, spec, si, tpl, warn) {
  const mains = tpl.split(' ').map(t => [t[0], t[1]]);
  const items = mains.map(([l, t]) => {
    const ex = pickMain(l, t, p, spec, warn), pr = prescribe(t, spec.phase, spec.i, spec.len, p.exp, spec.deload), main = !!EX[ex].f;
    const it = { ex, lift: l, type: t, role: main ? 'main' : 'acc', ...pr };
    if (!main) { it.rep = [pr.reps, pr.reps + 4]; it.top = false; it.sets = Math.max(2, pr.sets); }
    return it;
  });
  let g = 20; while (estMin(items) > p.minutes && g--) { const c = items.filter(i => i.sets > 2).sort((a, b) => b.sets - a.sets)[0]; if (!c) break; c.sets--; }
  const accSets = spec.deload || spec.phase === 'peak' ? 2 : p.exp === 'beginner' ? 2 : 3;
  let n = spec.phase === 'taper' ? 0 : Math.min(5, Math.floor((p.minutes - estMin(items)) / (1 + accSets * 2.5)));
  if (n < 1 && spec.phase !== 'taper' && p.minutes - estMin(items) >= 6) n = 1;
  const used = new Set(items.map(i => i.ex));
  pickAccs([...new Set(mains.map(m => m[0]))], p, spec, n, used).forEach(([id, l]) => items.push({ ex: id, lift: l, role: 'acc', type: 'A', sets: accSets, reps: EX[id].rep[0], rep: EX[id].rep, rpe: spec.deload ? 6.5 : 8, top: false }));
  return { name: 'Tag ' + (si + 1), focus: [...new Set(mains.map(m => LIFTS[m[0]]))].join(' · '), items, est: Math.round(estMin(items)), over: estMin(items) > p.minutes + 5 };
}

function buildPlan(p) {
  const warn = []; const w = m => { if (!warn.includes(m)) warn.push(m); };
  const struct = buildStructure(p), tpl = TPL[p.days.length] || TPL[3];
  return { created: todayK(), start: p.start, notes: warn, weeks: struct.map(s => ({ ...s, sessions: tpl.map((t, si) => buildSession(p, s, si, t, w)) })) };
}
function rebuildFuture(fromWeek) {
  const warn = S.plan.notes = []; const w = m => { if (!warn.includes(m)) warn.push(m); }; const tpl = TPL[S.profile.days.length] || TPL[3];
  S.plan.weeks.forEach(wk => { if (wk.n >= fromWeek) wk.sessions = tpl.map((t, si) => buildSession(S.profile, wk, si, t, w)); });
}

// ---------- Sätze, Lasten ----------
function itemSets(it, wn) {
  const m = S.mods[wn] || {}; let n = it.sets;
  if (it.role === 'main') { const a = m[it.lift] || 0, b = m.all || 0; n += a < 0 && b < 0 ? Math.min(a, b) : a + b; } else if ((m.all || 0) < 0) n -= 1;
  n = Math.max(it.role === 'main' ? 2 : 1, n); let rpe = it.rpe;
  if (m.deload) { n = Math.max(2, Math.ceil(n / 2)); rpe = Math.min(rpe, 6.5); }
  return Array.from({ length: n }, (_, k) => ({ reps: it.reps, rpe: it.top && k > 0 ? Math.max(6, rpe - 1) : rpe, top: it.top && k === 0 }));
}
function plannedLoad(it, set) {
  if (it.role === 'main' && S.e1) return Math.max(20, rnd(S.e1[it.lift] * EX[it.ex].f * pct(set.reps, set.rpe)));
  return accSuggest(it.ex);
}
function accSuggest(ex) {
  const ws = Object.keys(S.logs).map(Number).sort((a, b) => b - a);
  for (const w of ws) {
    const ss = S.logs[w];
    for (const s of Object.keys(ss).sort((a, b) => b - a)) {
      const L = ss[s]; if (!L.done) continue;
      const it = L.items.find(i => i.ex === ex); if (!it) continue;
      const d = it.sets.filter(x => x.done && x.w > 0); if (!d.length) continue;
      const w0 = Math.max(...d.map(x => x.w)), hi = EX[ex].rep && EX[ex].rep[1];
      return hi && avg(d.map(x => x.r)) >= hi && avg(d.map(x => x.rpe || 8)) <= 8.5 ? Math.max(rnd(w0 * 1.025, 1), w0 + 1) : w0;
    }
  }
  return null;
}

// ---------- Wochenfortschritt ----------
const isDone = (w, s) => { const L = (S.logs[w] || {})[s]; return !!(L && (L.done || L.skipped)); };
const weekDone = w => S.plan.weeks[w - 1].sessions.every((_, s) => isDone(w, s));
function curWeek() { const ws = S.plan.weeks; for (const w of ws) if (!weekDone(w.n)) return w.n; return ws.length; }
function nextSession(w) { const wk = S.plan.weeks[w - 1]; const i = wk.sessions.findIndex((_, s) => !isDone(w, s)); return i < 0 ? null : i; }
function initLog(w, s) {
  S.logs[w] = S.logs[w] || {};
  if (!S.logs[w][s]) {
    const ses = S.plan.weeks[w - 1].sessions[s];
    S.logs[w][s] = { done: false, items: ses.items.map(it => ({ ex: it.ex, sets: itemSets(it, w).map(x => ({ w: plannedLoad(it, x) || 0, r: x.reps, rpe: x.rpe, done: false })) })) };
  }
  return S.logs[w][s];
}

// ---------- Wochenanalyse + automatische Anpassung ----------
function analyzeWeek(wn) {
  const wk = S.plan.weeks[wn - 1], rep = { week: wn, date: todayK(), lines: [], changes: [] };
  let planned = 0, done = 0; const st = { S: { est: [], dev: [], miss: 0 }, B: { est: [], dev: [], miss: 0 }, D: { est: [], dev: [], miss: 0 } };
  const ready = [], pain = {};
  wk.sessions.forEach((ses, si) => {
    const L = (S.logs[wn] || {})[si];
    ses.items.forEach((it, ii) => {
      const ps = itemSets(it, wn); planned += ps.length;
      if (!L || !L.done) return;
      (L.items[ii].sets || []).forEach((x, k) => {
        if (!x.done) return; done++;
        if (it.role !== 'main' || !ps[k]) return;
        const t = st[it.lift];
        if (x.rpe && x.r <= 8 && x.w > 0) t.est.push(e1of(x.w, x.r, x.rpe) / EX[it.ex].f);
        if (x.rpe) t.dev.push(x.rpe - ps[k].rpe);
        if (x.r < ps[k].reps) t.miss++;
      });
    });
    if (L && L.done) { if (L.sleep) ready.push(L.sleep); if (L.energy) ready.push(L.energy); Object.entries(L.pain || {}).forEach(([a, v]) => pain[a] = Math.max(pain[a] || 0, v)); }
  });
  const comp = planned ? done / planned : 0; rep.compliance = Math.round(comp * 100);
  rep.lines.push(`Umsetzung: ${done}/${planned} Sätze (${rep.compliance}%).`);
  const nm = S.mods[wn + 1] = S.mods[wn + 1] || {};
  const canUpdate = !wk.deload && wk.phase !== 'taper';
  for (const l of ['S', 'B', 'D']) {
    const t = st[l];
    if (t.est.length && canUpdate) {
      const old = S.e1[l], m = med(t.est);
      const nw = Math.min(old * 1.04, Math.max(old * .96, old * .6 + m * .4));
      if (Math.abs(nw - old) >= .5) { S.e1[l] = r1(nw); rep.changes.push(`${LIFTS[l]}: geschätztes Max ${r1(old)} → ${r1(nw)} kg – Lasten werden neu berechnet.`); }
    }
    const dev = avg(t.dev);
    if (t.dev.length) {
      if (dev >= 1 || t.miss >= 2) { nm[l] = -1; rep.changes.push(`${LIFTS[l]}: war härter als geplant (Ø RPE ${dev >= 0 ? '+' : ''}${r1(dev)}, ${t.miss} verfehlte Sätze) → nächste Woche −1 Satz.`); }
      else if (dev <= -1.2 && wk.phase === 'acc' && !wk.deload) { nm[l] = 1; rep.changes.push(`${LIFTS[l]}: deutlich leichter als geplant (Ø RPE ${r1(dev)}) → nächste Woche +1 Satz.`); }
      else rep.lines.push(`${LIFTS[l]}: im Plan (Ø RPE-Abweichung ${dev >= 0 ? '+' : ''}${r1(dev)}).`);
    }
  }
  const rd = avg(ready);
  const prev = S.reports[0];
  if ((ready.length && rd <= 2.5) || comp < .6) {
    if (prev && prev.low) { nm.deload = true; rep.changes.push('Zwei schwache Wochen in Folge (Erholung/Umsetzung) → nächste Woche wird zum Deload.'); }
    else { nm.all = -1; rep.changes.push('Erholung oder Umsetzung niedrig → nächste Woche −1 Satz pro Hauptübung. Schlaf, Stress und Kalorien prüfen.'); }
    rep.low = true;
  } else if (ready.length) rep.lines.push(`Erholung: Ø ${r1(rd)}/5 – gut.`);
  if (comp < .75) rep.lines.push('Tipp: Wenn du öfter ausfällst, reduziere die Trainingstage (Hunter → Plan neu erstellen).');
  let regen = false;
  Object.entries(pain).forEach(([a, v]) => {
    if (v < 2) return; const inj = S.profile.injuries, ex = inj.find(i => i.area === a);
    if (!ex) { inj.push({ area: a, sev: v }); regen = true; rep.changes.push(`Schmerzen: ${AREAS[a]} (Stufe ${v}) → belastende Übungen werden ersetzt.`); }
    else if (ex.sev < v) { ex.sev = v; regen = true; rep.changes.push(`Schmerzen: ${AREAS[a]} verschlechtert → Plan angepasst.`); }
    if (v >= 3) rep.lines.push(`⚠ ${AREAS[a]}: starke Beschwerden – lass das bitte ärztlich/physio­therapeutisch abklären.`);
  });
  if (regen && wn < S.plan.weeks.length) rebuildFuture(wn + 1);
  // Gewicht → Kalorien
  const nutLine = adaptCalories(rep); if (nutLine) rep.changes.push(nutLine);
  if (!rep.changes.length) rep.changes.push('Keine Anpassung nötig – weiter wie geplant.');
  S.reports.unshift(rep);
  return rep;
}

function adaptCalories(rep) {
  if (!S.nut || S.weights.length < 4) return null;
  const w = S.weights.slice(-14), n = w.length, a = avg(w.slice(0, n >> 1).map(x => x.kg)), b = avg(w.slice(n >> 1).map(x => x.kg));
  if (n < 6) return null;
  const rate = (b - a) / a * 100 / ((n >> 1) / 3.5 || 1); // grob %/Woche
  const goal = { cut: -.6, mod: -.3, maint: 0, lean: .25, bulk: .5 }[S.nut.goal];
  if (goal === undefined) return null;
  const diff = rate - goal;
  if (Math.abs(diff) < .3) return null;
  const adj = diff > 0 ? -120 : 120; S.nut.adj = (S.nut.adj || 0) + adj;
  return `Gewichtstrend ${rate >= 0 ? '+' : ''}${r1(rate)}%/Woche (Ziel ${goal >= 0 ? '+' : ''}${goal}%) → Kalorien ${adj > 0 ? '+' : ''}${adj} kcal.`;
}

// ---------- Ernährung ----------
const lastWeight = () => (S.weights.length ? S.weights[S.weights.length - 1].kg : S.profile.bw);
function targets() {
  const n = S.nut, p = S.profile; if (!n || !p) return null;
  const bw = lastWeight(), bmr = 10 * bw + 6.25 * p.height - 5 * p.age + (p.sex === 'm' ? 5 : -161);
  const pal = { sed: 1.3, light: 1.4, active: 1.5, heavy: 1.6 }[n.job] + .035 * p.days.length, tdee = bmr * pal;
  let rate = { cut: -.6, mod: -.3, maint: 0, lean: p.exp === 'beginner' ? .4 : .25, bulk: .5 }[n.goal], warn = [];
  if (n.goal === 'class' && n.classKg && n.weighDate) {
    const wks = Math.max(1, (new Date(n.weighDate + 'T12:00:00') - new Date()) / 6048e5);
    rate = -((bw - n.classKg) / bw * 100) / wks;
    if (rate < -1) { warn.push('Das Ziel erfordert >1% Gewichtsverlust pro Woche – das kostet Kraft. Erwäge eine höhere Klasse oder einen früheren Start.'); rate = -1; }
    if (rate > 0) rate = 0;
  }
  const delta = rate / 100 * bw * 7700 / 7;
  let kcal = Math.max(bmr, tdee + delta + (n.adj || 0));
  const pg = (rate < 0 ? 2.2 : 1.8) + (n.diet === 3 ? .2 : 0), P = Math.round(bw * pg);
  const F = Math.round(Math.min(1.3 * bw, Math.max(.8 * bw, .25 * kcal / 9)));
  const C = Math.max(0, Math.round((kcal - P * 4 - F * 9) / 4));
  if (C < 3 * bw) warn.push('Wenig Kohlenhydrate für schwere Beintage – achte auf Leistung/Erholung.');
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal: Math.round(kcal), p: P, c: C, f: F, fiber: Math.round(14 * kcal / 1000), water: Math.round((bw * 35 + 500) / 100) / 10, rate: r1(rate), warn };
}

function composeMeal(slot, t, idx, ok) {
  const pick = (r, s, off) => { let a = FOODS.filter(f => f.r === r && f.s.includes(s) && ok(f)); if (!a.length) a = FOODS.filter(f => f.r === r && ok(f)); return a.length ? a[(idx + off) % a.length] : null; };
  const P = pick('P', slot, 0), C = pick('C', slot, 1), V = slot === 'm' ? pick('V', 'm', 2) : pick('X', slot, 2), Fa = pick('F', slot, 3);
  const rem = { p: t.p, c: t.c, f: t.f }, items = [];
  const add = (f, g, step = 5) => { g = Math.round(g / step) * step; if (g <= 0 || !f) return; const x = g / 100; items.push({ n: f.n, g, k: f.k * x, p: f.p * x, c: f.c * x, f: f.f * x }); rem.p -= f.p * x; rem.c -= f.c * x; rem.f -= f.f * x; };
  add(V, slot === 'm' ? 150 : 100);
  if (P) add(P, Math.min(500, Math.max(0, rem.p * .85) / (P.p / 100), P.c > 8 ? Math.max(0, rem.c) * .6 / (P.c / 100) : 1e9), P.k > 300 ? 10 : 5);
  if (C) add(C, Math.min(450, Math.max(0, rem.c) / (C.c / 100)));
  if (Fa && rem.f > 4) add(Fa, Math.min(40, rem.f / (Fa.f / 100)));
  const tot = items.reduce((a, i) => ({ k: a.k + i.k, p: a.p + i.p, c: a.c + i.c, f: a.f + i.f }), { k: 0, p: 0, c: 0, f: 0 });
  return { slot, items, name: [P, C].filter(Boolean).map(x => x.n).join(' mit ') || 'Mahlzeit', ...tot };
}
function mealPlan() {
  const t = targets(), n = S.nut; if (!t) return null;
  const dis = (n.dislikes || '').toLowerCase().split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  const ok = f => f.kat >= n.diet && !(f.al.split(' ').some(a => (n.allerg || []).includes(a))) && !dis.some(d => f.n.toLowerCase().includes(d));
  const slots = { 3: ['b', 'm', 'm'], 4: ['b', 'm', 's', 'm'], 5: ['b', 's', 'm', 's', 'm'], 6: ['b', 's', 'm', 's', 'm', 's'] }[n.meals] || ['b', 'm', 's', 'm'];
  const wt = { b: .9, m: 1, s: .5 }, sum = slots.reduce((a, s) => a + wt[s], 0), days = [], shop = {};
  for (let d = 0; d < 7; d++) {
    const meals = slots.map((s, i) => composeMeal(s, { p: t.p * wt[s] / sum, c: t.c * wt[s] / sum, f: t.f * wt[s] / sum }, d * 2 + i, ok));
    meals.forEach(m => m.items.forEach(it => shop[it.n] = (shop[it.n] || 0) + it.g));
    days.push({ meals, tot: meals.reduce((a, m) => ({ k: a.k + m.k, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), { k: 0, p: 0, c: 0, f: 0 }) });
  }
  return { days, shop: Object.entries(shop).sort((a, b) => b[1] - a[1]) };
}
const dayFood = k => { const d = (S.food.days[k] = S.food.days[k] || { e: { b: [], m: [], d: [], s: [] }, water: 0 }); return d; };
const dayTot = k => { const d = S.food.days[k]; const t = { k: 0, p: 0, c: 0, f: 0, n: 0, water: d ? d.water : 0 }; if (d) Object.values(d.e).forEach(a => a.forEach(e => { t.k += e.k; t.p += e.p; t.c += e.c; t.f += e.f; t.n++; })); return t; };

// ---------- Gamification ----------
const lvlOf = xp => Math.floor(Math.sqrt(xp / 25)) + 1;
const xpFor = l => 25 * (l - 1) ** 2;
const rankOf = lvl => RANKS.filter(r => lvl >= r[0]).pop();
function addXP(n) { const h = S.hero, before = lvlOf(h.xp); h.xp += n; const after = lvlOf(h.xp); if (after > before) { const r0 = rankOf(before)[1], r1_ = rankOf(after)[1]; pushToast(r0 !== r1_ ? `RANG-AUFSTIEG! Du bist jetzt ${r1_}-Rang!` : `LEVEL UP! Level ${after}`); } }
const toastQ = []; function pushToast(m) { toastQ.push(m); }
function isRestDay(k) { return !S.profile.days.includes(new Date(k + 'T12:00:00').getDay()); }
function sessionDoneOn(k) { return Object.values(S.logs).some(w => Object.values(w).some(l => l.done && l.date === k)); }
function questsFor(k) {
  const q = S.hero.quests[k] || {}, t = S.nut ? targets() : null, f = dayTot(k), rest = isRestDay(k);
  return [
    rest ? { id: 'mob', label: 'Mobility / Spaziergang (10+ Min.)', done: !!q.mob, manual: 1 } : { id: 'train', label: 'Trainings-Quest absolvieren', done: sessionDoneOn(k) },
    { id: 'food', label: 'Mahlzeiten tracken (3+ Einträge)', done: f.n >= 3 },
    { id: 'prot', label: 'Proteinziel (≥90 %)', done: !!t && f.p >= t.p * .9 },
    { id: 'water', label: 'Wasser ≥ 2,5 L', done: f.water >= 2500 },
    { id: 'sleep', label: '7+ Stunden Schlaf', done: !!q.sleep, manual: 1 },
  ];
}
const daySuccess = k => questsFor(k).filter(q => q.done).length >= 3;
function rollStreak() {
  const h = S.hero, t = todayK(); if (!h.lastDay) { h.lastDay = addDays(t, -1); return; }
  let d = addDays(h.lastDay, 1);
  while (d < t) {
    if (daySuccess(d)) { h.streak++; h.best = Math.max(h.best, h.streak); if (h.streak % 7 === 0 && h.freeze < 2) h.freeze++; }
    else if (h.freeze > 0) h.freeze--; else h.streak = 0;
    h.lastDay = d; d = addDays(d, 1);
  }
}
const curStreak = () => S.hero.streak + (daySuccess(todayK()) ? 1 : 0);
function checkUnlocks() {
  const h = S.hero, st = curStreak();
  if (h.sets >= 100) giveBadge('sets100'); if (h.sets >= 500) giveBadge('sets500'); if (h.weeksDone >= 4) giveBadge('weeks4');
  if (Object.keys(S.food.days).filter(k => dayTot(k).n >= 3).length >= 7) giveBadge('food7');
  CHARS.forEach(c => { if (h.unlocked[c.id]) return; if ((c.need && Math.max(st, h.best) >= c.need) || (c.badge && h.badges[c.badge])) { h.unlocked[c.id] = todayK(); pushToast(`Neuer Schatten erwacht: ${c.n}!`); } });
}
function giveBadge(id) { if (!S.hero.badges[id]) { S.hero.badges[id] = todayK(); pushToast(`Abzeichen: ${BADGES[id][0]}`); addXP(50); } }

function finishSession(w, s, extra) {
  const L = S.logs[w][s], h = S.hero, ses = S.plan.weeks[w - 1].sessions[s];
  Object.assign(L, extra, { done: true, date: todayK() });
  let sets = 0, xp = 100, prs = [];
  L.items.forEach((li, ii) => {
    const it = ses.items[ii];
    li.sets.forEach(x => {
      if (!x.done) return; sets++; xp += x.rpe ? 15 : 10;
      if (it.role === 'main' && x.w > 0 && x.rpe && x.r <= 8) {
        const e = e1of(x.w, x.r, x.rpe) / EX[it.ex].f, best = h.prs[it.lift] || 0;
        if (it.ex === COMP[it.lift] && x.r <= 3 && x.rpe >= 9 && x.w > (h.prs['w' + it.lift] || 0)) { if (best) prs.push(`${LIFTS[it.lift]} ${x.w} kg × ${x.r}`); h.prs['w' + it.lift] = x.w; }
        h.prs[it.lift] = Math.max(best, e);
      }
    });
  });
  h.sets += sets; h.sessions++; xp += prs.length * 150;
  if (h.sessions === 1) giveBadge('first'); if (prs.length) giveBadge('pr1');
  addXP(xp);
  let report = null, boss = false;
  if (weekDone(w)) {
    report = analyzeWeek(w); h.weeksDone++; addXP(300);
    const wk = S.plan.weeks[w - 1];
    if (wk.sessions.every((_, i) => (S.logs[w][i] || {}).done)) { boss = true; h.bossWon[w] = 1; giveBadge('boss1'); addXP(200); }
  }
  checkUnlocks(); save();
  return { xp, sets, prs, report, boss };
}

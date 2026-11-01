'use strict';
// ---------- UI-Helfer ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const getP = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setP = (o, p, v) => { const ks = p.split('.'); const l = ks.pop(); ks.reduce((a, k) => a[k], o)[l] = v; };
const DAYN = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
// Wochentag + Datum einer Einheit (Tag 1..n werden den gewählten Trainingstagen Mo→So zugeordnet)
function sessDate(w, s) {
  const days = S.profile.days.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)), d = days[s % days.length];
  const st = new Date(S.plan.start + 'T12:00:00'), dt = new Date(st);
  dt.setDate(st.getDate() - ((st.getDay() + 6) % 7) + 7 * (w - 1) + ((d + 6) % 7));
  return { k: dkey(dt), txt: `${DAYN[d]} ${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.` };
}
const sdl = (w, s) => { const x = sessDate(w, s); return x.txt + (x.k === todayK() ? ' (heute)' : ''); };
const fmt = n => Math.round(n);
let D = null; // Wizard-Entwurf
let N = null; // Ernährungs-Entwurf
const draftOf = () => S.ui.nutDraft ? N : D;

const inp = (path, label, type = 'text', extra = '', o = D) => `<label class="f"><span>${label}</span><input data-b="${path}" data-t="${type === 'number' ? 'n' : 's'}" type="${type}" value="${esc(getP(o, path))}" ${extra}></label>`;
const sel = (path, label, opts, o = D, num = false) => `<label class="f"><span>${label}</span><select data-b="${path}" data-t="${num ? 'n' : 's'}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(getP(o, path)) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
const chk = (path, val, label, o = D) => `<label class="chip"><input type="checkbox" data-b="${path}" data-t="a" data-v="${val}" ${(getP(o, path) || []).includes(val) ? 'checked' : ''}><span>${label}</span></label>`;

// ---------- Figuren ----------
function figure(c, locked) {
  const g = 'g' + c.id, sk = c.skin, col = c.col, ac = c.acc;
  const accs = {
    headband: `<rect x="43" y="26" width="34" height="6" rx="3" fill="${c.aura}"/>`,
    ears: `<path d="M46 26 L42 10 L54 20Z M74 26 L78 10 L66 20Z" fill="${sk}"/>`,
    helm: `<path d="M43 36 Q43 16 60 16 Q77 16 77 36 L77 30 L43 30Z" fill="#94a3b8"/><rect x="58" y="14" width="4" height="12" fill="${c.aura}"/>`,
    horns: `<path d="M46 26 Q38 10 44 6 Q48 16 54 22Z M74 26 Q82 10 76 6 Q72 16 66 22Z" fill="#e2e8f0"/>`,
    crown: `<path d="M44 24 L46 10 L53 18 L60 8 L67 18 L74 10 L76 24Z" fill="#fbbf24"/>`,
    cape: '', none: ''
  };
  return `<svg viewBox="0 0 120 140" class="fig ${locked ? 'lock' : ''}"><defs><radialGradient id="${g}"><stop offset="0" stop-color="${c.aura}" stop-opacity=".6"/><stop offset="1" stop-color="${c.aura}" stop-opacity="0"/></radialGradient></defs>
  <circle cx="60" cy="75" r="58" fill="url(#${g})"/>
  ${c.cape ? `<path d="M38 56 L20 128 L100 128 L82 56Z" fill="${c.cape}" opacity=".92"/>` : ''}
  <rect x="44" y="100" width="14" height="28" rx="5" fill="#1e293b"/><rect x="62" y="100" width="14" height="28" rx="5" fill="#1e293b"/>
  <path d="M32 58 Q60 46 88 58 L80 106 Q60 112 40 106Z" fill="${col}"/>
  <rect x="8" y="38" width="104" height="4" rx="2" fill="#cbd5e1"/>
  <rect x="4" y="24" width="9" height="32" rx="3" fill="${c.plate}"/><rect x="107" y="24" width="9" height="32" rx="3" fill="${c.plate}"/>
  <path d="M34 62 L22 42 M86 62 L98 42" stroke="${sk}" stroke-width="9" stroke-linecap="round"/><circle cx="34" cy="60" r="8" fill="${col}"/><circle cx="86" cy="60" r="8" fill="${col}"/>
  <circle cx="60" cy="38" r="17" fill="${sk}"/>${accs[ac] || ''}
  <rect x="51" y="35" width="6" height="4" rx="2" fill="${c.aura}"/><rect x="63" y="35" width="6" height="4" rx="2" fill="${c.aura}"/><path d="M54 45 Q60 49 66 45" stroke="#0f172a" stroke-width="2" fill="none"/>
  <rect x="42" y="84" width="36" height="7" rx="3" fill="#0f172a"/><rect x="56" y="83" width="8" height="9" rx="2" fill="${c.aura}"/></svg>`;
}

// ---------- Rendering ----------
function render() {
  rollStreak();
  S.coach = S.coach || { msgs: [] };
  const h = !S.profile ? wizard() : header() + ({ home, train, plan: planV, nutri, coach: coachV, hero: heroV }[S.ui.tab] || home)() + tabbar();
  $('#app').innerHTML = h;
  flushToasts();
}
function flushToasts() {
  while (toastQ.length) { const m = toastQ.shift(), d = document.createElement('div'); d.className = 'toast'; d.textContent = '[SYSTEM] ' + m; $('#toasts').appendChild(d); setTimeout(() => d.remove(), 5000); }
}
function tabbar() {
  const t = [['home', '⚔', 'Quest'], ['train', '🏋', 'Training'], ['plan', '📅', 'Plan'], ['nutri', '🍽', 'Essen'], ['coach', '🤖', 'Coach'], ['hero', '👤', 'Hunter']];
  return `<nav class="tabs">${t.map(([k, i, l]) => `<button data-a="tab" data-v="${k}" class="${S.ui.tab === k ? 'on' : ''}"><i>${i}</i>${l}</button>`).join('')}</nav>`;
}
function header() {
  const h = S.hero, l = lvlOf(h.xp), rk = rankOf(l), pc = (h.xp - xpFor(l)) / (xpFor(l + 1) - xpFor(l)) * 100;
  return `<header class="hdr"><div class="rank r${rk[1]}">${rk[1]}</div><div class="hd-m"><b>${esc(S.profile.name || 'Hunter')}</b> <small>Lv ${l} · ${rk[2]}</small><div class="bar"><i style="width:${pc}%"></i></div></div><div class="flame">🔥 ${curStreak()}</div></header><div id="timer" class="timer" hidden></div>`;
}

// ---------- Wizard ----------
const defaultDraft = () => ({
  name: '', sex: 'm', age: 25, height: 178, bw: 80, years: 1, equip: 'gym', goal: 'comp', compDate: '', klass: '',
  lifts: { S: { w: '', r: 3, rpe: 9 }, B: { w: '', r: 3, rpe: 9 }, D: { w: '', r: 3, rpe: 9 } }, weak: { S: '', B: '', D: '' },
  days: [1, 3, 5], minutes: 75, start: todayK(), inj: { shoulder: 0, elbow: 0, wrist: 0, back: 0, hip: 0, knee: 0 }, sleep: 7, stress: 2, notes: ''
});
const WSTEPS = ['Willkommen', 'Körper', 'Erfahrung', 'Maximalkraft', 'Ziele', 'Zeit', 'Gesundheit', 'Fertig'];
function wizard() {
  if (!D) D = S.ui.draft || defaultDraft();
  const st = S.ui.step || 0; let b = '';
  if (st === 0) b = `<div class="sys"><div class="sys-t">[SYSTEM]</div><p>Hunter-Registrierung erkannt.</p><p>Beantworte ein paar Fragen. Je genauer, desto präziser wird dein Powerlifting-Plan: Zeitbudget, Verletzungen, Ziele und Schwachstellen fließen direkt in Übungsauswahl, Volumen und Intensität ein.</p><p class="mut">Dauer: ca. 3 Minuten. Alle Daten bleiben auf deinem Gerät.</p></div>${inp('name', 'Dein Hunter-Name')}`;
  if (st === 1) b = `<div class="grid2">${sel('sex', 'Geschlecht', [['m', 'Männlich'], ['f', 'Weiblich']])}${inp('age', 'Alter', 'number')}${inp('height', 'Größe (cm)', 'number')}${inp('bw', 'Körpergewicht (kg)', 'number', 'step="0.1"')}</div>`;
  if (st === 2) b = `${inp('years', 'Jahre strukturiertes Krafttraining (mit den Big 3)', 'number', 'step="0.5" min="0"')}<p class="mut">→ Einstufung: <b>${expOf(D)}</b> (&lt;1 J. Anfänger, 1–3 J. Fortgeschritten, &gt;3 J. Erfahren). Das bestimmt Volumen, Progression und Struktur.</p>${sel('equip', 'Ausstattung', [['gym', 'Voll ausgestattetes Gym / Powerlifting-Gym'], ['basic', 'Standard-Fitnessstudio'], ['home', 'Home-Gym (Rack, Hantel, Bank)']])}`;
  if (st === 3) b = `<p class="mut">Gib für jede Übung einen aktuellen Satz an (Gewicht × Wiederholungen @ RPE). Eine echte Wiederholung am Limit = 1 Wdh @ RPE 10. Ungefähre Werte reichen – die App kalibriert sich nach den ersten Wochen automatisch.</p>${['S', 'B', 'D'].map(l => `<div class="card"><h4>${LIFTS[l]}</h4><div class="grid3">${inp(`lifts.${l}.w`, 'Gewicht kg', 'number', 'step="0.5"')}${inp(`lifts.${l}.r`, 'Wdh', 'number', 'min="1" max="8"')}${sel(`lifts.${l}.rpe`, 'RPE', [[10, '10 (Limit)'], [9.5, '9.5'], [9, '9 (1 Wdh Reserve)'], [8.5, '8.5'], [8, '8 (2 Reserve)'], [7, '7 (3 Reserve)']], D, true)}</div></div>`).join('')}`;
  if (st === 4) b = `${sel('goal', 'Hauptziel', [['comp', 'Wettkampf (Meet)'], ['max', 'Maximalkraft steigern'], ['mix', 'Kraft + Muskelaufbau'], ['tech', 'Technik & Gesundheit']])}${inp('compDate', 'Wettkampfdatum (optional)', 'date')}<h4>Schwachstellen (wo scheitert die Wiederholung?)</h4><div class="grid3">${['S', 'B', 'D'].map(l => sel(`weak.${l}`, LIFTS[l], WEAK[l])).join('')}</div>`;
  if (st === 5) b = `<h4>Trainingstage (2–6)</h4><div class="chips">${[1, 2, 3, 4, 5, 6, 0].map(d => chk('days', d, DAYN[d])).join('')}</div>${sel('minutes', 'Zeit pro Einheit', [[45, '45 Min.'], [60, '60 Min.'], [75, '75 Min.'], [90, '90 Min.'], [120, '120 Min.']], D, true)}${inp('start', 'Start des Plans', 'date')}<p class="mut">Die App kürzt Sätze und Zubehör, damit jede Einheit in dein Zeitfenster passt (inkl. ca. 10 Min. Aufwärmen).</p>`;
  if (st === 6) b = `<h4>Verletzungen / Beschwerden</h4><p class="mut">0 = keine · 1 = leicht (stört kaum) · 2 = mäßig (Übungen anpassen) · 3 = stark (belastende Übungen streichen)</p><div class="grid2">${Object.entries(AREAS).map(([k, v]) => sel(`inj.${k}`, v, [[0, '0 – keine'], [1, '1 – leicht'], [2, '2 – mäßig'], [3, '3 – stark']], D, true)).join('')}</div><div class="grid2">${inp('sleep', 'Ø Schlaf (Std.)', 'number', 'step="0.5"')}${sel('stress', 'Stress (Job/Alltag)', [[1, 'niedrig'], [2, 'mittel'], [3, 'hoch'], [4, 'sehr hoch']], D, true)}</div><label class="f"><span>Sonstiges (Vorerkrankungen etc.)</span><textarea data-b="notes">${esc(D.notes)}</textarea></label><p class="mut">Hinweis: Die App ersetzt keine ärztliche Beratung. Bei starken oder anhaltenden Schmerzen bitte abklären lassen.</p>`;
  if (st === 7) b = `<div class="sys"><div class="sys-t">[SYSTEM]</div><p>Registrierung abgeschlossen. Bereit, deinen Plan zu erzeugen?</p><p class="mut">${D.days.length} Tage/Woche · ${D.minutes} Min. · Stufe ${expOf(D)}${D.compDate ? ' · Wettkampf ' + D.compDate : ' · 12-Wochen-Zyklus'}</p></div>`;
  return `<main class="wiz"><div class="steps">${WSTEPS.map((s, i) => `<i class="${i <= st ? 'on' : ''}"></i>`).join('')}</div><h2>${WSTEPS[st]}</h2>${b}<div class="nav">${st ? '<button class="btn ghost" data-a="wback">Zurück</button>' : ''}<button class="btn" data-a="wnext">${st === 7 ? 'Plan erstellen' : 'Weiter'}</button></div></main>`;
}
const expOf = d => d.years < 1 ? 'beginner' : d.years < 3 ? 'intermediate' : 'advanced';
function wizardValid() {
  const st = S.ui.step || 0;
  if (st === 1 && !(D.age > 12 && D.height > 100 && D.bw > 30)) return 'Bitte Körperdaten prüfen.';
  if (st === 3 && ['S', 'B', 'D'].some(l => !(D.lifts[l].w > 0 && D.lifts[l].r >= 1))) return 'Bitte für alle drei Übungen einen Satz eintragen.';
  if (st === 5 && (D.days.length < 2 || D.days.length > 6)) return 'Bitte 2 bis 6 Trainingstage wählen.';
  return '';
}
function createProfile() {
  const e1 = {}; ['S', 'B', 'D'].forEach(l => e1[l] = r1(e1of(+D.lifts[l].w, +D.lifts[l].r, +D.lifts[l].rpe)));
  const injuries = Object.entries(D.inj).filter(([, v]) => v > 0).map(([area, sev]) => ({ area, sev }));
  S.profile = { name: D.name, sex: D.sex, age: +D.age, height: +D.height, bw: +D.bw, exp: expOf(D), equip: D.equip, goal: D.goal, compDate: D.compDate || '', weak: D.weak, days: D.days.slice().sort(), minutes: +D.minutes, start: D.start || todayK(), injuries, sleep: D.sleep, stress: D.stress, notes: D.notes };
  S.e1 = e1; S.plan = buildPlan(S.profile); S.weights = [{ d: todayK(), kg: +D.bw }]; S.logs = {}; S.mods = {}; S.reports = [];
  S.hero.lastDay = addDays(todayK(), -1); S.ui = { tab: 'home' }; D = null; save();
}

// ---------- Home ----------
function bossBar(w) {
  const wk = S.plan.weeks[w - 1]; let tot = 0, dn = 0;
  wk.sessions.forEach((s, si) => s.items.forEach((it, ii) => { const n = itemSets(it, w).length; tot += n; const L = (S.logs[w] || {})[si]; if (L && L.done) dn += L.items[ii].sets.filter(x => x.done).length; }));
  const hp = Math.max(0, 100 - dn / Math.max(1, tot) * 100);
  return `<div class="boss"><div class="boss-t">⚔ WOCHEN-RAID · ${wk.label}</div><div class="hp"><i style="width:${hp}%"></i></div><small>${hp > 0 ? `Boss-HP ${Math.round(hp)} % – jeder Satz ist Schaden` : 'Boss besiegt!'}</small></div>`;
}
function home() {
  const w = curWeek(), si = nextSession(w), k = todayK(), qs = questsFor(k), done = qs.filter(q => q.done).length;
  const wk = S.plan.weeks[w - 1], r = S.reports[0];
  let next = '<div class="card">Plan abgeschlossen! Unter „Plan“ kannst du einen neuen Zyklus starten.</div>';
  if (si != null) { const s = wk.sessions[si]; next = `<div class="card glow"><small class="mut">Nächste Quest · Woche ${w}</small><h3>${sdl(w, si)} · ${s.name}: ${s.focus}</h3><p class="mut">${s.items.length} Übungen · ca. ${s.est} Min.</p><button class="btn" data-a="open" data-w="${w}" data-s="${si}">Quest starten</button></div>`; }
  const t = S.nut && targets(), f = dayTot(k);
  return `<main>${isRestDay(k) ? '<div class="sys"><div class="sys-t">[SYSTEM]</div>Heute ist Ruhetag. Erholung ist Teil des Trainings.</div>' : ''}${next}${bossBar(w)}
  <div class="card"><h3>Tägliche Quests <small>${done}/${qs.length} · ${done >= 3 ? '✔ Streak-Tag gesichert' : 'min. 3 für Streak'}</small></h3>${qs.map(q => `<div class="q ${q.done ? 'ok' : ''}" ${q.manual ? `data-a="qtog" data-id="${q.id}"` : ''}><span>${q.done ? '✔' : '○'}</span>${q.label}${q.manual ? ' <small>(tippen)</small>' : ''}</div>`).join('')}<small class="mut">Streak: ${curStreak()} Tage · Bester: ${Math.max(S.hero.best, curStreak())} · Freeze-Tokens: ${S.hero.freeze}</small></div>
  ${t ? `<div class="card"><h3>Heute gegessen</h3>${macroBars(f, t)}<button class="btn ghost" data-a="tab" data-v="nutri">Zum Tracker</button></div>` : ''}
  ${r ? `<div class="card"><h3>Letzte Wochenanalyse (Woche ${r.week})</h3>${r.lines.map(l => `<p>${l}</p>`).join('')}${r.changes.map(l => `<p class="chg">➜ ${l}</p>`).join('')}</div>` : ''}</main>`;
}
function macroBars(f, t) {
  const b = (l, v, m, c) => `<div class="mb"><span>${l}</span><div class="bar ${v > m * 1.05 ? 'over' : ''}"><i style="width:${Math.min(100, v / m * 100)}%;background:${c}"></i></div><b>${fmt(v)}/${fmt(m)}</b></div>`;
  return b('kcal', f.k, t.kcal, 'var(--c1)') + b('Protein', f.p, t.p, '#f43f5e') + b('Carbs', f.c, t.c, '#f59e0b') + b('Fett', f.f, t.f, '#a78bfa');
}

// ---------- Training ----------
function train() {
  if (S.ui.sess) return sessionV();
  const w = S.ui.viewW || curWeek(), wk = S.plan.weeks[w - 1];
  return `<main><div class="rowc"><button class="btn sm ghost" data-a="vw" data-d="-1">‹</button><h2>Woche ${w}/${S.plan.weeks.length} <small>${wk.label}</small></h2><button class="btn sm ghost" data-a="vw" data-d="1">›</button></div>${bossBar(w)}
  ${wk.sessions.map((s, i) => { const L = (S.logs[w] || {})[i]; return `<div class="card sess ${L && L.done ? 'done' : ''}"><div><h3>${sdl(w, i)} · ${s.name}: ${s.focus}</h3><small class="mut">${L && L.done ? '✔ erledigt ' + L.date : L && L.skipped ? 'übersprungen' : s.items.length + ' Übungen · ca. ' + s.est + ' Min.'}${s.over ? ' · ⚠ knapp im Zeitbudget' : ''}</small></div><button class="btn sm" data-a="open" data-w="${w}" data-s="${i}">${L && L.done ? 'Ansehen' : 'Öffnen'}</button></div>`; }).join('')}</main>`;
}
function sessionV() {
  const { w, s } = S.ui.sess, ses = S.plan.weeks[w - 1].sessions[s], L = initLog(w, s), ro = L.done;
  return `<main><button class="btn sm ghost" data-a="close">‹ Zurück</button><h2>${sdl(w, s)} · ${ses.name}: ${ses.focus}</h2>
  ${ses.items.map((it, ii) => {
    const ps = itemSets(it, w), li = L.items[ii], e = EX[it.ex];
    const desc = it.role === 'main' ? `${it.top ? 'Top-Set + Back-off' : 'Gerade Sätze'} · Ziel ${it.reps} Wdh @ RPE ${it.rpe}` : `${it.sets} × ${it.rep ? it.rep[0] + '–' + it.rep[1] : it.reps} Wdh @ RPE ${it.rpe}`;
    return `<div class="card ex ${it.role}"><h4>${e.n} <small class="mut">${desc}</small></h4>
    <div class="setrow head"><span>#</span><span>Plan</span><span>kg</span><span>Wdh</span><span>RPE</span><span></span></div>
    ${li.sets.map((x, k) => { const p = ps[k]; const pl = p ? `${p.reps}×${plannedLoad(it, p) || '?'}@${p.rpe}` : 'Extra'; return `<div class="setrow ${x.done ? 'ok' : ''}"><span>${k + 1}</span><span class="pl">${pl}</span>
      <input type="number" step="0.5" data-l="${ii},${k},w" value="${x.w || ''}" ${ro ? 'disabled' : ''} inputmode="decimal"><input type="number" data-l="${ii},${k},r" value="${x.r}" ${ro ? 'disabled' : ''} inputmode="numeric"><input type="number" step="0.5" data-l="${ii},${k},rpe" value="${x.rpe}" ${ro ? 'disabled' : ''} inputmode="decimal">
      <button class="ck" data-a="ck" data-i="${ii}" data-k="${k}" ${ro ? 'disabled' : ''}>${x.done ? '✔' : '○'}</button></div>`; }).join('')}
    ${ro ? '' : `<button class="btn sm ghost" data-a="addset" data-i="${ii}">+ Satz</button>`}</div>`;
  }).join('')}
  ${ro ? `<div class="card">Quest abgeschlossen. Erholung ${L.energy || '-'}/5 · Schlaf ${L.sleep || '-'}/5</div>` : `<div class="nav"><button class="btn ghost" data-a="skip">Überspringen</button><button class="btn" data-a="finish">Quest abschließen</button></div>`}</main>`;
}

// ---------- Plan ----------
function planV() {
  const w0 = curWeek(), p = S.plan;
  return `<main><h2>Dein Plan</h2>${p.notes.map(n => `<div class="sys warn">⚠ ${n}</div>`).join('')}
  <div class="card"><h4>Geschätzte Maxima (e1RM)</h4><div class="grid3">${['S', 'B', 'D'].map(l => `<div class="stat"><b>${r1(S.e1[l])}</b><small>${LIFTS[l]}</small></div>`).join('')}</div><small class="mut">Σ ${r1(S.e1.S + S.e1.B + S.e1.D)} kg · wird nach jeder Woche anhand deiner Ist-Leistung neu kalibriert.</small></div>
  <div class="card"><h4>Wochenanalysen</h4>${S.reports.length ? S.reports.map(r => `<details><summary>Woche ${r.week} · Umsetzung ${r.compliance}%</summary>${r.lines.map(l => `<p>${l}</p>`).join('')}${r.changes.map(l => `<p class="chg">➜ ${l}</p>`).join('')}</details>`).join('') : '<p class="mut">Nach der ersten vollständig eingetragenen Woche erscheint hier die Auswertung samt Anpassungen.</p>'}</div>
  ${p.weeks.map(wk => `<details ${wk.n === w0 ? 'open' : ''}><summary class="wsum"><b>W${wk.n}</b> ${wk.label} ${wk.n < w0 ? '✔' : ''}${(S.mods[wk.n] || {}).deload ? ' · Auto-Deload' : ''}</summary>${wk.sessions.map((s, si) => `<div class="card slim"><b>${sdl(wk.n, si)}</b> · ${s.name}: ${s.focus} <small class="mut">~${s.est} Min.</small>${s.items.map(it => { const ps = itemSets(it, wk.n), p0 = ps[0], ld = plannedLoad(it, p0); return `<div class="pi"><span>${EX[it.ex].n}</span><span>${ps.length}×${it.role === 'main' ? it.reps : it.rep ? it.rep.join('–') : it.reps} @${it.rpe}${ld ? ' · ' + ld + ' kg' : ''}</span></div>`; }).join('')}</div>`).join('')}</details>`).join('')}
  <div class="card"><button class="btn ghost" data-a="newplan">Plan neu erstellen (Fragebogen)</button></div></main>`;
}

// ---------- Ernährung ----------
const DIETS = [[0, 'Alles'], [1, 'Pescetarisch'], [2, 'Vegetarisch'], [3, 'Vegan']];
function nutri() {
  if (!S.nut) {
    if (!N) N = S.ui.nutDraft || { goal: 'lean', job: 'light', diet: 0, allerg: [], dislikes: '', meals: 4, cook: 30, budget: 2, supps: 1, classKg: '', weighDate: '' };
    S.ui.nutDraft = N;
    return `<main><h2>Ernährungs-Check</h2><div class="sys"><div class="sys-t">[SYSTEM]</div>Ein paar Fragen für deinen Ernährungsplan.</div>
    ${sel('goal', 'Ziel', [['cut', 'Fett verlieren (aggressiv, ~0,6 %/Wo.)'], ['mod', 'Fett verlieren (moderat, ~0,3 %/Wo.)'], ['maint', 'Gewicht halten / Rekomposition'], ['lean', 'Lean Bulk (~0,25 %/Wo.)'], ['bulk', 'Aufbauen (~0,5 %/Wo.)'], ['class', 'Gewichtsklasse erreichen']], N)}
    ${N.goal === 'class' ? `<div class="grid2">${inp('classKg', 'Zielgewicht (kg)', 'number', 'step="0.1"', N)}${inp('weighDate', 'Wiegedatum', 'date', '', N)}</div>` : ''}
    ${sel('job', 'Alltag außerhalb des Trainings', [['sed', 'Überwiegend sitzend'], ['light', 'Leicht aktiv (Gehen, Stehen)'], ['active', 'Aktiv (viel auf den Beinen)'], ['heavy', 'Körperlich hart']], N)}
    ${sel('diet', 'Ernährungsform', DIETS, N, true)}
    <h4>Unverträglichkeiten / Allergien</h4><div class="chips">${[['lac', 'Laktose'], ['glu', 'Gluten'], ['nut', 'Nüsse'], ['egg', 'Ei'], ['fish', 'Fisch'], ['soy', 'Soja']].map(([v, l]) => chk('allerg', v, l, N)).join('')}</div>
    ${inp('dislikes', 'Mag ich nicht (kommagetrennt, z. B. brokkoli, tofu)', 'text', '', N)}
    <div class="grid2">${sel('meals', 'Mahlzeiten/Tag', [[3, '3'], [4, '4'], [5, '5'], [6, '6']], N, true)}${sel('cook', 'Kochzeit pro Tag', [[15, '≤15 Min.'], [30, '~30 Min.'], [60, '≥60 Min.']], N, true)}</div>
    <button class="btn" data-a="nutsave">Ernährungsplan erstellen</button></main>`;
  }
  const sub = S.ui.nsub || 'track', t = targets();
  return `<main><div class="seg">${[['track', 'Tracker'], ['plan', 'Plan'], ['set', 'Ziele']].map(([k, l]) => `<button data-a="nsub" data-v="${k}" class="${sub === k ? 'on' : ''}">${l}</button>`).join('')}</div>${sub === 'track' ? tracker(t) : sub === 'plan' ? nutPlan(t) : nutSet(t)}</main>`;
}
function tracker(t) {
  const k = S.ui.nday || todayK(), d = dayFood(k), f = dayTot(k), names = { b: 'Frühstück', m: 'Mittagessen', d: 'Abendessen', s: 'Snacks' };
  const wk = S.weights.find(x => x.d === k);
  return `<div class="rowc"><button class="btn sm ghost" data-a="nd" data-d="-1">‹</button><h3>${k === todayK() ? 'Heute' : k}</h3><button class="btn sm ghost" data-a="nd" data-d="1">›</button></div>
  <div class="card"><div class="ring" style="--p:${Math.min(100, f.k / t.kcal * 100)}"><div><b>${fmt(f.k)}</b><small>von ${t.kcal} kcal</small></div></div>${macroBars(f, t)}</div>
  ${Object.entries(names).map(([s, l]) => `<div class="card"><div class="rowc"><h4>${l} <small class="mut">${fmt(d.e[s].reduce((a, e) => a + e.k, 0))} kcal</small></h4><button class="btn sm" data-a="addfood" data-s="${s}">+ Hinzufügen</button></div>${d.e[s].map((e, i) => `<div class="fe"><span>${esc(e.n)}${e.g ? ` <small>${fmt(e.g)} g</small>` : ''}</span><span>${fmt(e.k)} kcal <button class="x" data-a="delfood" data-s="${s}" data-i="${i}">✕</button></span></div>`).join('')}</div>`).join('')}
  <div class="card rowc"><span>💧 ${(d.water / 1000).toFixed(2)} / ${t.water} L</span><span><button class="btn sm ghost" data-a="water" data-v="-250">−</button> <button class="btn sm" data-a="water" data-v="250">+250 ml</button></span></div>
  <div class="card rowc"><span>⚖ Körpergewicht</span><span><input id="bwin" type="number" step="0.1" class="sm" value="${wk ? wk.kg : ''}" placeholder="kg"> <button class="btn sm" data-a="bw">Speichern</button></span></div>`;
}
function nutPlan(t) {
  const mp = mealPlan(); S.ui.mp = null;
  return `<div class="card"><h3>Tagesziel</h3><div class="grid3"><div class="stat"><b>${t.kcal}</b><small>kcal</small></div><div class="stat"><b>${t.p}g</b><small>Protein</small></div><div class="stat"><b>${t.c}g</b><small>Carbs</small></div></div><small class="mut">Fett ${t.f} g · Ballaststoffe ${t.fiber} g · Wasser ${t.water} L</small></div>
  ${mp.days.map((d, i) => `<details ${i === 0 ? 'open' : ''}><summary class="wsum"><b>Tag ${i + 1}</b> · ${fmt(d.tot.k)} kcal · P ${fmt(d.tot.p)}</summary>${d.meals.map(m => `<div class="card slim"><b>${{ b: 'Frühstück', m: 'Hauptmahlzeit', s: 'Snack' }[m.slot]}</b> · ${fmt(m.k)} kcal<br><small>${m.items.map(i => `${i.g} g ${i.n}`).join(', ')}</small><br><small class="mut">P ${fmt(m.p)} · C ${fmt(m.c)} · F ${fmt(m.f)}</small></div>`).join('')}</details>`).join('')}
  <div class="card"><h4>Einkaufsliste (7 Tage)</h4>${mp.shop.map(([n, g]) => `<div class="fe"><span>${n}</span><span>${g >= 1000 ? (g / 1000).toFixed(1) + ' kg' : g + ' g'}</span></div>`).join('')}</div>`;
}
function nutSet(t) {
  return `<div class="card"><h3>Berechnung</h3><p>Grundumsatz ${t.bmr} kcal · Gesamtumsatz ca. ${t.tdee} kcal · Zielrate ${t.rate >= 0 ? '+' : ''}${t.rate} %/Woche${S.nut.adj ? ` · Auto-Anpassung ${S.nut.adj} kcal` : ''}</p>${t.warn.map(w => `<div class="sys warn">⚠ ${w}</div>`).join('')}
  <h4>Evidenzbasis</h4><ul class="mut"><li>Protein 1,6–2,2 g/kg (höher in Diät); Meta-Analysen & ISSN-Positionspapier.</li><li>Gewichtszunahme 0,25–0,5 %/Woche; Abnahme 0,5–1 %/Woche für Kraftsportler.</li><li>Kreatin-Monohydrat 3–5 g/Tag ist gut belegt (ISSN).</li><li>Koffein 3–6 mg/kg ca. 60 Min. vor dem Training kann die Leistung steigern.</li></ul>
  <small class="mut">Die Kalorien werden wöchentlich anhand deines Gewichtstrends angepasst. Das ist keine medizinische Beratung.</small></div><div class="card"><button class="btn ghost" data-a="nutreset">Ernährungs-Fragebogen wiederholen</button></div>`;
}

// ---------- Hunter ----------
function heroV() {
  const h = S.hero, l = lvlOf(h.xp), rk = rankOf(l), st = curStreak(), total = S.e1.S + S.e1.B + S.e1.D, bw = lastWeight();
  const stats = [['STR', Math.min(100, total / bw * 12)], ['END', Math.min(100, h.sets / 6)], ['VIT', Math.min(100, Object.keys(S.food.days).filter(k => dayTot(k).n >= 3).length * 3)], ['AGI', Math.min(100, Math.max(h.best, st) * 2)], ['SENSE', Math.min(100, S.reports.length * 8)]];
  return `<main><div class="card glow center"><div class="rank big r${rk[1]}">${rk[1]}</div><h2>${esc(S.profile.name || 'Hunter')}</h2><p>${rk[2]} · Level ${l} · ${h.xp} XP</p><p>🔥 Streak <b>${st}</b> · Best ${Math.max(h.best, st)} · ❄ ${h.freeze}</p></div>
  <div class="card"><h4>Stats</h4>${stats.map(([n, v]) => `<div class="mb"><span>${n}</span><div class="bar"><i style="width:${v}%"></i></div><b>${fmt(v)}</b></div>`).join('')}</div>
  <div class="card"><h4>Schatten-Armee <small class="mut">${Object.keys(h.unlocked).length}/${CHARS.length}</small></h4><div class="army">${CHARS.map(c => { const u = h.unlocked[c.id]; return `<div class="ch ${u ? '' : 'locked'}" data-a="chinfo" data-id="${c.id}">${figure(c, !u)}<b>${u ? c.n : '???'}</b><small>${u ? c.rar : c.need ? `Streak ${c.need}` : 'Spezial'}</small></div>`; }).join('')}</div></div>
  <div class="card"><h4>Abzeichen</h4><div class="chips">${Object.entries(BADGES).map(([k, [n, d]]) => `<span class="chip ${h.badges[k] ? 'sel' : 'off'}" title="${d}">${h.badges[k] ? '🏅' : '🔒'} ${n}</span>`).join('')}</div></div>
  <div class="card"><h4>☁ Geräte-Sync (Handy ↔ PC)</h4>${S.sync.gistId ? `<p>✔ Verbunden${S.sync.last ? ' · zuletzt ' + new Date(S.sync.last).toLocaleString('de-DE') : ''}</p><div class="nav"><button class="btn sm" data-a="syncnow">Jetzt synchronisieren</button><button class="btn sm ghost danger" data-a="syncoff">Trennen</button></div>` : `<ol class="mut"><li>Auf github.com einen Token erzeugen: <a href="https://github.com/settings/tokens/new?scopes=gist&description=Iron%20Ascent" target="_blank" rel="noopener">Token-Seite öffnen</a> (nur Haken bei „gist“, Laufzeit nach Wunsch).</li><li>Token unten einfügen und verbinden.</li><li>Auf dem zweiten Gerät dasselbe mit <b>demselben GitHub-Konto</b>.</li></ol><label class="f"><span>GitHub-Token</span><input id="stoken" type="password" placeholder="ghp_…" autocomplete="off"></label><button class="btn sm" data-a="syncon">Verbinden</button>`}${S.ui.syncMsg ? `<p class="chg">${esc(S.ui.syncMsg)}</p>` : ''}<small class="mut">Daten liegen in einem privaten Gist deines Kontos. Token und API-Key bleiben nur auf dem jeweiligen Gerät.</small></div>
  <div class="card"><h4>KI-Scan & Daten</h4><label class="f"><span>Anthropic-API-Key (nur lokal gespeichert, für Foto-Scan)</span><input id="apikey" type="password" value="${esc(S.set.key)}" placeholder="sk-ant-…"></label><div class="nav"><button class="btn sm" data-a="savekey">Key speichern</button><button class="btn sm ghost" data-a="export">Export</button><label class="btn sm ghost">Import<input type="file" id="imp" accept=".json" hidden></label></div><button class="btn sm ghost danger" data-a="reset">Alles zurücksetzen</button></div></main>`;
}

// ---------- Modal ----------
function modal(html) { $('#modal').innerHTML = html ? `<div class="ov"><div class="mod">${html}</div></div>` : ''; }
function foodRow(f, i) { return `<div class="fe pick" data-a="pickfood" data-i="${i}"><span>${esc(f.n)}</span><small>${f.k} kcal/100g</small></div>`; }
let FLIST = [];
function foodModal(slot) {
  S.ui.fslot = slot;
  modal(`<div class="rowc"><h3>Hinzufügen</h3><button class="x" data-a="mclose">✕</button></div><div class="seg"><button class="on" data-a="mtab" data-v="s">Suche</button><button data-a="mtab" data-v="ai">📷 KI-Scan</button><button data-a="mtab" data-v="bc">Barcode</button><button data-a="mtab" data-v="man">Manuell</button></div><div id="mbody"></div>`);
  mtab('s');
}
function mtab(v) {
  document.querySelectorAll('.mod .seg button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  const b = $('#mbody');
  if (v === 's') { b.innerHTML = `<input id="fq" placeholder="Lebensmittel suchen…" autofocus><div id="fl"></div>`; fsearch(''); }
  if (v === 'ai') b.innerHTML = `<p class="mut">Foto deiner Mahlzeit aufnehmen – die KI schätzt Zutaten, Mengen und Makros. Abweichung ±20 % möglich, du kannst alles korrigieren.${S.set.key ? '' : '<br><b>Zuerst API-Key unter Hunter eintragen.</b>'}</p><label class="btn">📷 Foto wählen / aufnehmen<input type="file" id="aiimg" accept="image/*" capture="environment" hidden></label><div id="aires"></div>`;
  if (v === 'bc') b.innerHTML = `<p class="mut">Barcode-Nummer eingeben (Open Food Facts).</p><input id="bcn" inputmode="numeric" placeholder="z. B. 4008400402222"><button class="btn" data-a="bclookup">Suchen</button><div id="bcres"></div>`;
  if (v === 'man') b.innerHTML = `<input id="mn" placeholder="Name"><div class="grid2"><input id="mk" type="number" placeholder="kcal"><input id="mp" type="number" placeholder="Protein g"><input id="mc" type="number" placeholder="Carbs g"><input id="mf" type="number" placeholder="Fett g"></div><button class="btn" data-a="manadd">Hinzufügen</button>`;
}
function fsearch(q) {
  q = q.toLowerCase(); const recent = S.food.recent || [];
  FLIST = [...S.food.custom, ...recent, ...FOODS].filter((f, i, a) => a.findIndex(x => x.n === f.n) === i).filter(f => f.n.toLowerCase().includes(q)).slice(0, 40);
  $('#fl').innerHTML = FLIST.map(foodRow).join('') || '<p class="mut">Nichts gefunden – nutze „Manuell“ oder den KI-Scan.</p>';
}
function addEntry(slot, e) {
  dayFood(S.ui.nday || todayK()).e[slot].push(e); save();
}
function amountModal(f) {
  modal(`<h3>${esc(f.n)}</h3><p class="mut">${f.k} kcal · P ${f.p} · C ${f.c} · F ${f.f} (pro 100 g)</p><label class="f"><span>Menge (g)</span><input id="amt" type="number" value="100"></label><button class="btn" data-a="amtok">Hinzufügen</button>`);
  S.ui.pf = f;
}
async function shrink(file, max) {
  const bmp = await createImageBitmap(file), sc = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = bmp.width * sc; c.height = bmp.height * sc; c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .85).split(',')[1];
}
const AI_PROMPT = 'Analysiere das Foto einer Mahlzeit. Identifiziere jedes Lebensmittel, schätze die Portion in Gramm und die Nährwerte dieser Portion. Antworte AUSSCHLIESSLICH mit JSON: {"items":[{"name":"","grams":0,"kcal":0,"protein":0,"carbs":0,"fat":0}],"confidence":"low|mid|high","note":""}. Namen auf Deutsch. Sei realistisch und nenne bei Unsicherheit mittlere Werte.';
async function aiScan(file) {
  const out = $('#aires'); out.innerHTML = '<p class="mut">⏳ Das System analysiert dein Essen…</p>';
  try {
    const data = await shrink(file, 1024);
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': S.set.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 1200, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }, { type: 'text', text: AI_PROMPT }] }] }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error && j.error.message || r.status);
    const res = JSON.parse(j.content.map(c => c.text || '').join('').match(/\{[\s\S]*\}/)[0]);
    S.ui.ai = res.items.map(i => ({ n: i.name, g: +i.grams, k: +i.kcal, p: +i.protein, c: +i.carbs, f: +i.fat }));
    giveBadge('ai1');
    out.innerHTML = `<p class="mut">Sicherheit: ${esc(res.confidence)} ${esc(res.note || '')}</p>${S.ui.ai.map((i, n) => `<div class="fe"><span>${esc(i.n)}</span><span><input class="sm" type="number" data-ai="${n}" value="${fmt(i.g)}"> g · <b>${fmt(i.k)}</b> kcal</span></div>`).join('')}<button class="btn" data-a="aiadd">Alles hinzufügen</button>`;
  } catch (e) { out.innerHTML = `<p class="chg">Fehler: ${esc(e.message)}. Prüfe API-Key und Internet.</p>`; }
}

// ---------- KI-Coach ----------
const COACH_SYS = `Du bist "Coach", ein erfahrener, evidenzbasierter Powerlifting-Coach in der App Iron Ascent. Antworte auf Deutsch, knapp, konkret und motivierend (leicht im Stil eines Solo-Leveling-Systems, aber nie albern). Nutze den Kontext (Profil, Plan, Logs, Analysen). Du stellst keine medizinischen Diagnosen; bei starken oder anhaltenden Schmerzen verweist du auf Arzt/Physio. Bei Videos siehst du nur einzelne Standbilder: sag klar, was du erkennen kannst und was nicht (z. B. Geschwindigkeit, Tempo), und gib 2-3 priorisierte Korrekturen mit passenden Cues und Übungen.
Wenn eine Planänderung sinnvoll ist, erkläre sie kurz und hänge am ENDE genau EINEN Codeblock an:
\`\`\`action
[{"type":"mods","week":<Woche>,"S":-1,"B":0,"D":0,"all":0,"deload":false},{"type":"injury","area":"shoulder|elbow|wrist|back|hip|knee","sev":1-3},{"type":"e1","lift":"S|B|D","value":<kg>},{"type":"kcal","delta":<-300..300>}]
\`\`\`
Nutze nur die benötigten Einträge. mods = Satz-Anpassung (−2..+1) für die genannte Woche. Der Nutzer muss jede Änderung selbst bestätigen.`;
function coachCtx() {
  const w = curWeek(), wk = S.plan.weeks[w - 1], si = nextSession(w), t = S.nut ? targets() : null;
  return JSON.stringify({
    heute: todayK(), profil: { geschlecht: S.profile.sex, alter: S.profile.age, gewicht: lastWeight(), stufe: S.profile.exp, ziel: S.profile.goal, wettkampf: S.profile.compDate || null, tage: S.profile.days.length, minuten: S.profile.minutes, schwach: S.profile.weak, verletzungen: S.profile.injuries },
    e1rm: S.e1, woche: w, phase: wk.label, naechste_einheit: si == null ? null : wk.sessions[si].items.map(it => `${EX[it.ex].n} ${it.sets}x${it.reps}@${it.rpe}`),
    letzte_analysen: S.reports.slice(0, 2).map(r => ({ w: r.week, umsetzung: r.compliance, aenderungen: r.changes })), mods: S.mods[w + 1] || null,
    ernaehrung: t ? { kcal: t.kcal, p: t.p, c: t.c, f: t.f } : null, gewicht_verlauf: S.weights.slice(-6).map(x => x.kg)
  });
}
async function callClaude(msgs, sys) {
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': S.set.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 1600, system: sys, messages: msgs }) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error && j.error.message || r.status);
  return j.content.map(c => c.text || '').join('');
}
const mdLite = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
function coachV() {
  const m = S.coach.msgs, busy = S.ui.cbusy;
  return `<main class="coach"><h2>🤖 Coach</h2>${S.set.key ? '' : '<div class="sys warn">Zuerst unter „Hunter“ deinen Anthropic-API-Key eintragen.</div>'}
  <div class="chat">${m.length ? m.map((x, i) => `<div class="msg ${x.r}">${mdLite(x.t)}${x.act && !x.done ? `<div class="act"><b>Vorschlag:</b><br>${x.act.map(a => '• ' + actText(a)).join('<br>')}<br><button class="btn sm" data-a="capply" data-i="${i}">Übernehmen</button></div>` : ''}${x.done ? '<div class="act ok">✔ übernommen</div>' : ''}</div>`).join('') : '<p class="mut">Frag mich alles zu Training, Technik, Plan oder Ernährung. Ich kenne deinen Plan und deine Logs. Für eine Technik-Analyse lade ein Video hoch.</p>'}${busy ? '<div class="msg assistant">⏳ Das System denkt nach…</div>' : ''}</div>
  <div class="card"><div class="grid2">${sel('cl', 'Video: Übung', [['Kniebeuge', 'Kniebeuge'], ['Bankdrücken', 'Bankdrücken'], ['Kreuzheben', 'Kreuzheben'], ['andere Übung', 'Andere']], S.ui, false).replace('data-b="cl"', 'id="cl"')}<label class="f"><span>Video analysieren</span><span class="btn sm">🎥 Video wählen<input type="file" id="cvid" accept="video/*" hidden></span></label></div><small class="mut">Aufnahme von der Seite (oder 45°), ganzer Körper und Stange im Bild, ein Satz. Es werden 8 Standbilder ausgewertet, die Auswertung ist also eine Einschätzung und kein Ersatz für einen Live-Coach.</small></div>
  <div class="chatin"><textarea id="cin" rows="2" placeholder="Nachricht an den Coach…"></textarea><button class="btn" data-a="csend">Senden</button></div>${m.length ? '<button class="btn sm ghost" data-a="cclear">Chat leeren</button>' : ''}</main>`;
}
function actText(a) {
  if (a.type === 'mods') return `Woche ${a.week}: ${['S', 'B', 'D'].filter(l => a[l]).map(l => `${LIFTS[l]} ${a[l] > 0 ? '+' : ''}${a[l]} Satz`).join(', ')}${a.all ? ` · alle ${a.all > 0 ? '+' : ''}${a.all}` : ''}${a.deload ? ' · Deload' : ''}`;
  if (a.type === 'injury') return `Beschwerden: ${AREAS[a.area] || a.area} (Stufe ${a.sev}) – Plan wird angepasst`;
  if (a.type === 'e1') return `${LIFTS[a.lift]}: geschätztes Max auf ${a.value} kg`;
  if (a.type === 'kcal') return `Kalorien ${a.delta > 0 ? '+' : ''}${a.delta} kcal`;
  return 'Unbekannte Aktion';
}
function applyAct(a) {
  const num = (v, lo, hi) => Math.min(hi, Math.max(lo, +v || 0));
  if (a.type === 'mods') { const wn = num(a.week, curWeek(), S.plan.weeks.length), m = S.mods[wn] = S.mods[wn] || {}; ['S', 'B', 'D'].forEach(l => { if (a[l] != null) m[l] = num(a[l], -2, 1); }); if (a.all != null) m.all = num(a.all, -2, 1); if (a.deload) m.deload = true; }
  if (a.type === 'injury' && AREAS[a.area]) { const sev = num(a.sev, 1, 3), ex = S.profile.injuries.find(i => i.area === a.area); if (ex) ex.sev = sev; else S.profile.injuries.push({ area: a.area, sev }); const w = curWeek(); rebuildFuture(S.logs[w] && Object.keys(S.logs[w]).length ? w + 1 : w); }
  if (a.type === 'e1' && S.e1[a.lift]) S.e1[a.lift] = r1(num(a.value, S.e1[a.lift] * .9, S.e1[a.lift] * 1.1));
  if (a.type === 'kcal' && S.nut) S.nut.adj = (S.nut.adj || 0) + num(a.delta, -300, 300);
}
async function coachSend(text, imgs, note) {
  if (!S.set.key) return alert('Bitte zuerst den API-Key unter „Hunter“ eintragen.');
  const c = S.coach; c.msgs.push({ r: 'user', t: (note ? `🎥 ${note}\n` : '') + text }); S.ui.cbusy = true; save(); render(); scrollTo(0, 99999);
  try {
    let hist = c.msgs.slice(-14).map(m => ({ role: m.r, content: m.t })); while (hist.length && hist[0].role !== 'user') hist.shift();
    if (imgs) { const last = hist[hist.length - 1]; last.content = [...imgs.map(data => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } })), { type: 'text', text: last.content }]; }
    const raw = await callClaude(hist, COACH_SYS + '\n\nKONTEXT: ' + coachCtx());
    const mt = raw.match(/```action\s*([\s\S]*?)```/); let act = null;
    if (mt) { try { act = JSON.parse(mt[1]); if (!Array.isArray(act)) act = [act]; act = act.filter(a => ['mods', 'injury', 'e1', 'kcal'].includes(a.type)); } catch (e) { } }
    c.msgs.push({ r: 'assistant', t: raw.replace(/```action[\s\S]*?```/, '').trim(), act: act && act.length ? act : null });
  } catch (e) { c.msgs.push({ r: 'assistant', t: 'Fehler: ' + e.message + '. Prüfe API-Key und Internetverbindung.' }); }
  S.ui.cbusy = false; c.msgs = c.msgs.slice(-40); save(); render(); scrollTo(0, 99999);
}
async function videoFrames(file, n = 8, max = 768) {
  const url = URL.createObjectURL(file), v = document.createElement('video'); v.muted = true; v.playsInline = true; v.src = url;
  await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('Video konnte nicht gelesen werden')); });
  const dur = v.duration; if (!isFinite(dur) || dur <= 0) throw new Error('Videolänge unbekannt');
  const c = document.createElement('canvas'), out = [];
  for (let i = 0; i < n; i++) {
    v.currentTime = dur * (i + .5) / n; await new Promise(r => { v.onseeked = r; });
    const sc = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight)); c.width = v.videoWidth * sc; c.height = v.videoHeight * sc;
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); out.push(c.toDataURL('image/jpeg', .8).split(',')[1]);
  }
  URL.revokeObjectURL(url); return out;
}

// ---------- Timer ----------
let restEnd = 0;
setInterval(() => { const t = $('#timer'); if (!t) return; const s = Math.round((restEnd - Date.now()) / 1000); if (s > 0) { t.hidden = false; t.textContent = `⏱ Pause ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; } else t.hidden = true; }, 500);

// ---------- Aktionen ----------
const ACT = {
  tab: el => { S.ui.tab = el.dataset.v; S.ui.sess = null; save(); render(); },
  wnext: () => { const e = wizardValid(); if (e) return alert(e); if (S.ui.step === 7) { createProfile(); return render(); } S.ui.step = (S.ui.step || 0) + 1; S.ui.draft = D; render(); scrollTo(0, 0); },
  wback: () => { S.ui.step--; render(); },
  vw: el => { S.ui.viewW = Math.min(S.plan.weeks.length, Math.max(1, (S.ui.viewW || curWeek()) + +el.dataset.d)); render(); },
  open: el => { S.ui.tab = 'train'; S.ui.sess = { w: +el.dataset.w, s: +el.dataset.s }; initLog(+el.dataset.w, +el.dataset.s); render(); scrollTo(0, 0); },
  close: () => { S.ui.sess = null; save(); render(); },
  ck: el => {
    const { w, s } = S.ui.sess, x = S.logs[w][s].items[+el.dataset.i].sets[+el.dataset.k]; x.done = !x.done; save();
    if (x.done) { const it = S.plan.weeks[w - 1].sessions[s].items[+el.dataset.i]; restEnd = Date.now() + (it.role === 'main' ? (it.type === 'L' ? 120 : 180) : 90) * 1000; }
    const y = scrollY; render(); scrollTo(0, y);
  },
  addset: el => { const { w, s } = S.ui.sess, sets = S.logs[w][s].items[+el.dataset.i].sets, l = sets[sets.length - 1]; sets.push({ ...l, done: false }); save(); const y = scrollY; render(); scrollTo(0, y); },
  skip: () => { const { w, s } = S.ui.sess; if (!confirm('Einheit überspringen?')) return; S.logs[w][s].skipped = true; if (weekDone(w)) { analyzeWeek(w); } S.ui.sess = null; save(); render(); },
  finish: () => modal(`<h3>Quest abschließen</h3><label class="f"><span>Energie / Erholung heute (1–5)</span><input id="en" type="range" min="1" max="5" value="3"></label><label class="f"><span>Schlaf letzte Nacht (1–5)</span><input id="sl" type="range" min="1" max="5" value="3"></label><h4>Schmerzen?</h4><div class="grid2">${Object.entries(AREAS).map(([k, v]) => `<label class="f"><span>${v}</span><select data-pain="${k}"><option value="0">–</option><option value="1">leicht</option><option value="2">mäßig</option><option value="3">stark</option></select></label>`).join('')}</div><button class="btn" data-a="finok">Abschließen</button>`),
  finok: () => {
    const pain = {}; document.querySelectorAll('[data-pain]').forEach(e => { if (+e.value) pain[e.dataset.pain] = +e.value; });
    const { w, s } = S.ui.sess, r = finishSession(w, s, { energy: +$('#en').value, sleep: +$('#sl').value, pain });
    modal(`<div class="center"><div class="sys-t">[SYSTEM]</div><h2>${r.boss ? 'Boss besiegt!' : 'Quest abgeschlossen!'}</h2><p>+${r.xp} XP · ${r.sets} Sätze</p>${r.prs.map(p => `<p class="chg">🏆 Neuer PR: ${p}</p>`).join('')}${r.report ? `<div class="card left"><h4>Wochenanalyse</h4>${r.report.lines.map(l => `<p>${l}</p>`).join('')}${r.report.changes.map(l => `<p class="chg">➜ ${l}</p>`).join('')}</div>` : ''}<button class="btn" data-a="mclose">Weiter</button></div>`);
    S.ui.sess = null; render();
  },
  mclose: () => { modal(''); render(); },
  syncon: () => { const t = $('#stoken').value.trim(); if (!t) return; S.sync.token = t; S.sync.gistId = ''; save(true); syncNow(true); },
  syncnow: () => syncNow(true),
  syncoff: () => { if (confirm('Sync trennen? Die Daten bleiben auf diesem Gerät und in der Cloud.')) { S.sync = { token: '', gistId: '', base: 0 }; S.ui.syncMsg = ''; save(true); render(); } },
  csend: () => { const t = $('#cin').value.trim(); if (t && !S.ui.cbusy) coachSend(t); },
  cclear: () => { if (confirm('Chat leeren?')) { S.coach.msgs = []; save(); render(); } },
  capply: el => { const m = S.coach.msgs[+el.dataset.i]; if (!m || !m.act || m.done) return; m.act.forEach(applyAct); m.done = true; save(); render(); },
  qtog: el => { const k = todayK(), q = S.hero.quests[k] = S.hero.quests[k] || {}; q[el.dataset.id] = !q[el.dataset.id]; if (q[el.dataset.id]) addXP(30); checkUnlocks(); save(); render(); },
  newplan: () => { if (!confirm('Neuen Plan erstellen? Aktueller Plan und Logs gehen verloren (Hunter-Fortschritt bleibt).')) return; S.profile = null; S.plan = null; S.ui = { tab: 'home' }; D = null; save(); render(); },
  nutsave: () => { S.nut = { ...N, adj: 0 }; S.ui.nutDraft = null; N = null; save(); render(); },
  nutreset: () => { S.nut = null; S.ui.nsub = 'track'; save(); render(); },
  nsub: el => { S.ui.nsub = el.dataset.v; render(); },
  nd: el => { S.ui.nday = addDays(S.ui.nday || todayK(), +el.dataset.d); render(); },
  addfood: el => foodModal(el.dataset.s),
  delfood: el => { dayFood(S.ui.nday || todayK()).e[el.dataset.s].splice(+el.dataset.i, 1); save(); render(); },
  water: el => { const d = dayFood(S.ui.nday || todayK()); d.water = Math.max(0, d.water + +el.dataset.v); save(); render(); },
  bw: () => { const v = +$('#bwin').value; if (!(v > 30)) return; const k = S.ui.nday || todayK(); const e = S.weights.find(x => x.d === k); if (e) e.kg = v; else { S.weights.push({ d: k, kg: v }); S.weights.sort((a, b) => a.d < b.d ? -1 : 1); } save(); render(); },
  mtab: el => mtab(el.dataset.v),
  pickfood: el => amountModal(FLIST[+el.dataset.i]),
  amtok: () => {
    const f = S.ui.pf, g = +$('#amt').value, x = g / 100; if (!(g > 0)) return;
    addEntry(S.ui.fslot, { n: f.n, g, k: f.k * x, p: f.p * x, c: f.c * x, f: f.f * x });
    S.food.recent = [f, ...(S.food.recent || []).filter(r => r.n !== f.n)].slice(0, 8); addXP(5); checkUnlocks(); save(); modal(''); render();
  },
  manadd: () => { const n = $('#mn').value || 'Eintrag', k = +$('#mk').value; if (!(k >= 0)) return; addEntry(S.ui.fslot, { n, g: 0, k, p: +$('#mp').value || 0, c: +$('#mc').value || 0, f: +$('#mf').value || 0 }); addXP(5); save(); modal(''); render(); },
  aiadd: () => { S.ui.ai.forEach(i => addEntry(S.ui.fslot, i)); addXP(15); checkUnlocks(); save(); modal(''); render(); },
  bclookup: async () => {
    const out = $('#bcres'), n = $('#bcn').value.trim(); out.innerHTML = '⏳';
    try {
      const j = await (await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(n)}.json`)).json(); if (j.status !== 1) throw 0;
      const p = j.product, m = p.nutriments, f = { n: p.product_name || 'Produkt', k: +m['energy-kcal_100g'] || 0, p: +m.proteins_100g || 0, c: +m.carbohydrates_100g || 0, f: +m.fat_100g || 0 };
      S.food.custom.push(f); amountModal(f);
    } catch (e) { out.innerHTML = '<p class="chg">Produkt nicht gefunden.</p>'; }
  },
  chinfo: el => { const c = CHARS.find(x => x.id === el.dataset.id), u = S.hero.unlocked[c.id]; modal(`<div class="center">${figure(c, !u)}<h3>${u ? c.n : '???'}</h3><p class="mut">${c.rar}</p><p>${u ? '„' + c.q + '“' : c.need ? `Erreiche einen Streak von ${c.need} Tagen.` : 'Spezial-Abzeichen erforderlich: ' + BADGES[c.badge][1]}</p><button class="btn" data-a="mclose">OK</button></div>`); },
  savekey: () => { S.set.key = $('#apikey').value.trim(); save(); alert('Gespeichert (nur auf diesem Gerät).'); },
  export: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' })); a.download = 'iron-ascent-backup.json'; a.click(); },
  reset: () => { if (confirm('WIRKLICH alles löschen?')) { localStorage.removeItem(KEY); location.reload(); } },
};
document.addEventListener('click', e => { const el = e.target.closest('[data-a]'); if (el && ACT[el.dataset.a]) ACT[el.dataset.a](el, e); });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.b) {
    const o = S.ui.nutDraft && !S.nut ? N : D; let v;
    if (t.dataset.t === 'a') { const arr = getP(o, t.dataset.b) || [], val = isNaN(+t.dataset.v) ? t.dataset.v : +t.dataset.v; v = t.checked ? [...new Set([...arr, val])] : arr.filter(x => x !== val); }
    else v = t.dataset.t === 'n' ? +t.value : t.value;
    setP(o, t.dataset.b, v); if (o === N && t.dataset.b === 'goal') render();
  } else if (t.dataset.l) {
    const [ii, k, f] = t.dataset.l.split(','), { w, s } = S.ui.sess; S.logs[w][s].items[+ii].sets[+k][f] = +t.value; save();
  } else if (t.dataset.ai) { const i = S.ui.ai[+t.dataset.ai], g = +t.value, x = g / i.g; ['k', 'p', 'c', 'f'].forEach(m => i[m] *= x); i.g = g; }
  else if (t.id === 'aiimg' && t.files[0]) aiScan(t.files[0]);
  else if (t.id === 'cl') S.ui.cl = t.value;
  else if (t.id === 'cvid' && t.files[0]) {
    const f = t.files[0], lift = S.ui.cl || 'Kniebeuge', q = ($('#cin').value || '').trim();
    videoFrames(f).then(fr => coachSend(q || `Bitte analysiere meine Technik bei dieser ${lift}. Was läuft gut, was sollte ich zuerst korrigieren?`, fr, `Video: ${lift} (${fr.length} Standbilder)`)).catch(e => alert('Video-Fehler: ' + e.message));
  }
  else if (t.id === 'imp' && t.files[0]) t.files[0].text().then(tx => { try { localStorage.setItem(KEY, JSON.stringify(JSON.parse(tx))); location.reload(); } catch (e) { alert('Ungültige Datei'); } });
});
document.addEventListener('input', e => { if (e.target.id === 'fq') fsearch(e.target.value); });
render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });

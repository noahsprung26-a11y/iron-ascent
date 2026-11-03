'use strict';
// ---------- Progress-Tracker: Fortschritt der 3 Grundübungen (Woche / Monat / Jahr / Gesamt) ----------
const PL = { S: ['Kniebeuge', '#22d3ee'], B: ['Bankdrücken', '#a78bfa'], D: ['Kreuzheben', '#fbbf24'] };
const PP = [['w', 'Woche', 7], ['m', 'Monat', 30], ['y', 'Jahr', 365], ['a', 'Gesamt', 0]];
const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'], WDY = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const dn = k => { const [y, m, d] = k.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 864e5); };
const dnD = n => new Date(n * 864e5);
const dnL = n => { const d = dnD(n); return String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0') + '.'; };
const tons = v => v >= 1000 ? (Math.round(v / 100) / 10).toLocaleString('de-DE') + ' t' : Math.round(v) + ' kg';
const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(r1(v)).toLocaleString('de-DE');

// Pro Trainingstag und Grundübung: bestes geschätztes Max (e1RM, normiert über den Lastfaktor der Variante) und Volumen
function progData() {
  const m = { S: new Map(), B: new Map(), D: new Map() };
  Object.values(S.logs).forEach(ws => Object.values(ws).forEach(L => {
    if (!L || !L.done || !L.date) return; const n = dn(L.date);
    L.items.forEach(li => {
      const ex = EX[li.ex]; if (!ex || ex.acc || !m[ex.l] || !ex.f) return;
      li.sets.forEach(x => {
        if (!x.done || !(x.w > 0) || !(x.r > 0)) return;
        let p = m[ex.l].get(n); if (!p) m[ex.l].set(n, p = { n, e: 0, vol: 0 });
        p.vol += x.w * x.r;
        if (x.r <= 10) p.e = Math.max(p.e, e1of(x.w, x.r, x.rpe || 9) / ex.f);
      });
    });
  }));
  const out = {};
  for (const l of 'SBD') {
    const a = [...m[l].values()].sort((x, y) => x.n - y.n); let top = 0;
    a.forEach(p => { if (p.e > 0) { p.pr = top > 0 && p.e > top + .01; top = Math.max(top, p.e); } });
    out[l] = a;
  }
  return out;
}

function progBuckets(per, start, t) {
  const b = [];
  if (per === 'w') for (let n = start; n <= t; n++) b.push({ f: n, t: n, l: WDY[dnD(n).getUTCDay()] });
  else if (per === 'm') for (let n = start; n <= t; n += 5) b.push({ f: n, t: Math.min(n + 4, t), l: dnL(n).slice(0, 5) });
  else {
    const s = dnD(start), e = dnD(t), months = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + e.getUTCMonth() - s.getUTCMonth() + 1;
    if (months > 24) for (let y = s.getUTCFullYear(); y <= e.getUTCFullYear(); y++) b.push({ f: Date.UTC(y, 0, 1) / 864e5, t: Date.UTC(y, 11, 31) / 864e5, l: String(y) });
    else for (let i = 0; i < months; i++) { const y = s.getUTCFullYear(), mo = s.getUTCMonth() + i; b.push({ f: Date.UTC(y, mo, 1) / 864e5, t: Date.UTC(y, mo + 1, 0) / 864e5, l: MON[((mo % 12) + 12) % 12] }); }
  }
  return b;
}

function lineChart(l, pts, start, end) {
  const col = PL[l][1], W = 320, H = 150, pl = 36, pr = 10, pt = 10, pb = 22;
  if (!pts.length) return '<div class="empty">Noch keine Einheiten in diesem Zeitraum.</div>';
  const ys = pts.map(p => p.e), lo0 = Math.min(...ys), hi0 = Math.max(...ys), pad = Math.max((hi0 - lo0) * .3, hi0 * .03), lo = lo0 - pad, hi = hi0 + pad;
  const x = n => pl + (end > start ? (n - start) / (end - start) : .5) * (W - pl - pr), y = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + r1(x(p.n)) + ' ' + r1(y(p.e))).join(' ');
  const area = pts.length > 1 ? `<path d="${d} L${r1(x(pts[pts.length - 1].n))} ${H - pb} L${r1(x(pts[0].n))} ${H - pb} Z" fill="url(#g${l})"/>` : '';
  const grid = [0, 1, 2].map(k => { const v = lo + (hi - lo) * k / 2; return `<line x1="${pl}" x2="${W - pr}" y1="${r1(y(v))}" y2="${r1(y(v))}" stroke="#1e3a8a" stroke-opacity=".5" stroke-dasharray="3 4"/><text x="${pl - 5}" y="${r1(y(v)) + 3}" text-anchor="end" fill="#8aa0c8" font-size="9">${Math.round(v)}</text>`; }).join('');
  const dots = pts.map(p => `<circle cx="${r1(x(p.n))}" cy="${r1(y(p.e))}" r="${p.pr ? 5 : 3}" fill="${p.pr ? '#fbbf24' : col}" stroke="#050816" stroke-width="1.5"><title>${dnL(p.n)} · ${r1(p.e)} kg${p.pr ? ' · PR' : ''}</title></circle>`).join('');
  return `<svg class="pchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Verlauf ${PL[l][0]}"><defs><linearGradient id="g${l}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".35"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>${grid}${area}<path d="${d}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" style="filter:drop-shadow(0 0 4px ${col})"/>${dots}<text x="${pl}" y="${H - 6}" fill="#8aa0c8" font-size="9">${dnL(start)}</text><text x="${W - pr}" y="${H - 6}" text-anchor="end" fill="#8aa0c8" font-size="9">${dnL(end)}</text></svg>`;
}

function volChart(data, bks) {
  const W = 320, H = 140, pl = 6, pr = 6, pt = 8, pb = 20, tot = bks.map(b => 'SBD'.split('').map(l => data[l].filter(p => p.n >= b.f && p.n <= b.t).reduce((s, p) => s + p.vol, 0)));
  const mx = Math.max(1, ...tot.map(a => a[0] + a[1] + a[2])), bw = (W - pl - pr) / bks.length, gap = Math.min(6, bw * .25);
  const showL = bks.length <= 14 || (i => i % Math.ceil(bks.length / 12) === 0);
  const bars = bks.map((b, i) => {
    let yy = H - pb; const x0 = pl + i * bw + gap / 2, w = bw - gap;
    const segs = tot[i].map((v, k) => { const h = v / mx * (H - pt - pb); yy -= h; return h > .4 ? `<rect x="${r1(x0)}" y="${r1(yy)}" width="${r1(w)}" height="${r1(h)}" rx="2" fill="${PL['SBD'[k]][1]}" fill-opacity=".85"><title>${b.l} · ${PL['SBD'[k]][0]} ${tons(v)}</title></rect>` : ''; }).join('');
    const lab = typeof showL === 'function' ? showL(i) : showL;
    return segs + (lab ? `<text x="${r1(x0 + w / 2)}" y="${H - 6}" text-anchor="middle" fill="#8aa0c8" font-size="9">${b.l}</text>` : '');
  }).join('');
  return `<svg class="pchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trainingsvolumen"><line x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}" stroke="#1e3a8a"/>${bars}</svg>`;
}

function progV() {
  const data = progData(), per = S.ui.pp || 'm', def = PP.find(p => p[0] === per) || PP[1], t = dn(todayK());
  const all = [].concat(...'SBD'.split('').map(l => data[l])), seg = `<div class="seg">${PP.map(p => `<button class="${p[0] === def[0] ? 'on' : ''}" data-a="pper" data-v="${p[0]}">${p[1]}</button>`).join('')}</div>`;
  if (!all.length) return `<main><h2>📈 Progress</h2>${seg}<div class="card center"><p class="mut">Sobald du die erste Einheit abgeschlossen hast, erscheinen hier deine Fortschritte bei Kniebeuge, Bankdrücken und Kreuzheben.</p></div></main>`;
  const first = Math.min(...all.map(p => p.n)), start = def[2] ? t - def[2] + 1 : Math.min(first, t), bks = progBuckets(def[0], start, t);
  const info = {}; let sum = 0, sumBase = 0, haveAll = true, ses = new Set(), volT = 0, prT = 0;
  for (const l of 'SBD') {
    const inW = data[l].filter(p => p.n >= start && p.n <= t && p.e > 0), before = data[l].filter(p => p.n < start && p.e > 0), anchor = before[before.length - 1];
    const cur = inW.length ? inW[inW.length - 1].e : null, base = anchor ? anchor.e : inW.length ? inW[0].e : null;
    const vol = data[l].filter(p => p.n >= start && p.n <= t).reduce((s, p) => s + p.vol, 0), prs = inW.filter(p => p.pr).length;
    data[l].filter(p => p.n >= start && p.n <= t).forEach(p => ses.add(p.n));
    info[l] = { inW, cur, base, vol, prs, best: inW.length ? Math.max(...inW.map(p => p.e)) : null, n: inW.length };
    if (cur == null) haveAll = false; else { sum += cur; sumBase += base; }
    volT += vol; prT += prs;
  }
  const dChip = (c, b) => c == null ? '' : `<span class="dchip ${c - b > .04 ? 'up' : c - b < -.04 ? 'dn' : ''}">${c - b > .04 ? '▲' : c - b < -.04 ? '▼' : '●'} ${sgn(c - b)} kg</span>`;
  const head = `<div class="card glow center"><small class="mut">GESCHÄTZTES TOTAL (e1RM) · ${def[1].toUpperCase()}</small><div class="pbig">${sum ? Math.round(sum).toLocaleString('de-DE') : '–'}<small> kg</small></div>${sum ? dChip(sum, sumBase) : ''}${haveAll ? '' : '<div><small class="mut">Total nur aus Lifts mit Daten in diesem Zeitraum.</small></div>'}<div class="grid3" style="margin-top:10px"><div class="stat"><b>${ses.size}</b><small>Trainingstage</small></div><div class="stat"><b>${tons(volT)}</b><small>Volumen</small></div><div class="stat"><b>${prT}</b><small>🏆 PRs</small></div></div></div>`;
  const cards = 'SBD'.split('').map(l => {
    const i = info[l];
    return `<div class="card"><div class="rowc"><h4 style="color:${PL[l][1]}">${PL[l][0]}</h4>${i.cur != null ? dChip(i.cur, i.base) : ''}</div><div class="rowc"><div><span class="pnum">${i.cur != null ? r1(i.cur).toLocaleString('de-DE') : '–'}</span> <small class="mut">kg e1RM zuletzt</small></div><small class="mut">${i.best != null ? 'Bestwert ' + r1(i.best).toLocaleString('de-DE') + ' kg' : ''}</small></div>${lineChart(l, i.inW, start, t)}<div class="chips pst"><span class="chip off">${i.n} Einheiten</span><span class="chip off">Volumen ${tons(i.vol)}</span>${i.prs ? `<span class="chip sel">🏆 ${i.prs} PR${i.prs > 1 ? 's' : ''}</span>` : ''}</div></div>`;
  }).join('');
  const vol = `<div class="card"><div class="rowc"><h4>Trainingsvolumen</h4><small class="mut">${def[0] === 'w' ? 'pro Tag' : def[0] === 'm' ? 'je 5 Tage' : 'pro ' + (bks.length && bks[0].l.length === 4 ? 'Jahr' : 'Monat')}</small></div>${volChart(data, bks)}<div class="legend">${'SBD'.split('').map(l => `<span><i style="background:${PL[l][1]}"></i>${PL[l][0]}</span>`).join('')}</div></div>`;
  return `<main><h2>📈 Progress</h2>${seg}${head}${cards}${vol}<small class="mut">e1RM = aus deinen Sätzen geschätztes Einwiederholungsmaximum (Gewicht, Wiederholungen, RPE; Varianten auf die Wettkampfübung umgerechnet). Gelbe Punkte = neuer Bestwert.</small></main>`;
}

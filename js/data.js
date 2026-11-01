'use strict';
// ---------- Stammdaten: Übungen, Lebensmittel, Charaktere ----------
const AREAS = { shoulder: 'Schulter', elbow: 'Ellbogen', wrist: 'Handgelenk', back: 'Unterer Rücken', hip: 'Hüfte', knee: 'Knie' };
const LIFTS = { S: 'Kniebeuge', B: 'Bankdrücken', D: 'Kreuzheben' };
const COMP = { S: 'squat', B: 'bench', D: 'deadlift' };

// Hauptübungen/Variationen: f = Lastfaktor relativ zum Wettkampf-e1RM, st = Gelenkbelastung (1 niedrig, 2 hoch, 3 sehr hoch)
const EX = {
  squat: { n: 'Kniebeuge (Wettkampf)', l: 'S', f: 1, st: { knee: 1, back: 2, hip: 1 } },
  pause_squat: { n: 'Pause-Kniebeuge (2 Sek.)', l: 'S', f: .88, st: { knee: 1, back: 2, hip: 1 } },
  tempo_squat: { n: 'Tempo-Kniebeuge (3-0-0)', l: 'S', f: .82, st: { knee: 1, back: 2, hip: 1 } },
  front_squat: { n: 'Frontkniebeuge', l: 'S', f: .78, st: { knee: 2, back: 1, wrist: 2 } },
  box_squat: { n: 'Kasten-Kniebeuge', l: 'S', f: .88, st: { back: 1, hip: 1 } },
  bench: { n: 'Bankdrücken (Wettkampf)', l: 'B', f: 1, st: { shoulder: 1, elbow: 1 } },
  pause_bench: { n: 'Pause-Bankdrücken (2 Sek.)', l: 'B', f: .93, st: { shoulder: 1, elbow: 1 } },
  spoto: { n: 'Spoto Press', l: 'B', f: .9, st: { shoulder: 1, elbow: 1 } },
  cg_bench: { n: 'Enges Bankdrücken', l: 'B', f: .88, st: { shoulder: 1, elbow: 2, wrist: 1 } },
  floor_press: { n: 'Floor Press', l: 'B', f: .88, st: { elbow: 1 } },
  board_press: { n: 'Board Press', l: 'B', f: .95, st: { elbow: 1 } },
  deadlift: { n: 'Kreuzheben (Wettkampf)', l: 'D', f: 1, st: { back: 2, hip: 1 } },
  pause_dl: { n: 'Pause-Kreuzheben', l: 'D', f: .88, st: { back: 2, hip: 1 } },
  deficit_dl: { n: 'Defizit-Kreuzheben', l: 'D', f: .85, st: { back: 2, hip: 2, knee: 1 } },
  block_pull: { n: 'Block Pull / Rack Pull', l: 'D', f: .95, st: { back: 1, hip: 1 } },
  trapbar_dl: { n: 'Trap-Bar-Kreuzheben', l: 'D', f: .95, st: { back: 1, knee: 1 } },
};
const A = (n, l, cat, st, rep, tag = []) => ({ n, l, cat, st, rep, tag, acc: 1 });
Object.assign(EX, {
  leg_press: A('Beinpresse', ['S'], 'quad', {}, [8, 12], ['hole']),
  bulgarian: A('Bulgarian Split Squat', ['S'], 'quad', { knee: 2, hip: 1 }, [8, 12]),
  leg_ext: A('Beinstrecker', ['S'], 'quad', { knee: 1 }, [10, 15]),
  rdl: A('Rumänisches Kreuzheben', ['S', 'D'], 'ham', { back: 2, hip: 1 }, [6, 10]),
  leg_curl: A('Beinbeuger liegend', ['S', 'D'], 'ham', {}, [10, 15]),
  hip_thrust: A('Hip Thrust', ['S', 'D'], 'glute', { back: 1 }, [8, 12], ['lockout']),
  back_ext: A('Rückenstrecker (45°)', ['S', 'D'], 'erector', { back: 1 }, [10, 15], ['forward']),
  cable_crunch: A('Cable Crunch', ['S', 'D'], 'core', {}, [10, 15]),
  leg_raise: A('Hängendes Beinheben', ['S', 'D'], 'core', { shoulder: 1 }, [8, 15]),
  incline_db: A('Schrägbank Kurzhantel', ['B'], 'chest', { shoulder: 2, elbow: 1 }, [8, 12], ['chest']),
  db_bench: A('Kurzhantel-Bankdrücken', ['B'], 'chest', { shoulder: 1, elbow: 1 }, [8, 12], ['mid']),
  dips: A('Dips', ['B'], 'tri', { shoulder: 3, elbow: 2 }, [6, 12], ['lockout']),
  ohp: A('Schulterdrücken stehend', ['B'], 'delt', { shoulder: 2, wrist: 1, back: 1 }, [6, 10]),
  pushdown: A('Trizeps-Pushdown', ['B'], 'tri', { elbow: 1 }, [10, 15], ['lockout']),
  oh_tri: A('Überkopf-Trizepsstrecken', ['B'], 'tri', { elbow: 2, shoulder: 1 }, [10, 15]),
  cs_row: A('Brustgestütztes Rudern', ['B', 'D'], 'back', {}, [8, 12], ['forward']),
  lat_pull: A('Latzug', ['B', 'D'], 'lats', { shoulder: 1 }, [8, 12]),
  pullup: A('Klimmzüge', ['B', 'D'], 'lats', { elbow: 1, shoulder: 1 }, [5, 10]),
  face_pull: A('Face Pulls', ['B'], 'reardelt', {}, [12, 20]),
  lat_raise: A('Seitheben', ['B'], 'delt', { shoulder: 1 }, [12, 20]),
  curl: A('Bizeps-Curls', ['B', 'D'], 'bicep', { elbow: 1 }, [10, 15]),
  db_row: A('Einarm-Kurzhantelrudern', ['D', 'B'], 'back', { back: 1 }, [8, 12]),
  farmer: A('Farmer’s Walk (Meter)', ['D'], 'grip', { wrist: 1 }, [20, 40]),
});
const SLOTS = {
  S: ['quad', 'ham', 'core', 'glute', 'erector'],
  B: ['back', 'tri', 'lats', 'reardelt', 'chest', 'delt'],
  D: ['back', 'ham', 'core', 'erector', 'lats', 'glute'],
};
const FALL = { S: ['box_squat', 'leg_press'], B: ['floor_press', 'board_press', 'db_bench'], D: ['trapbar_dl', 'block_pull', 'rdl', 'hip_thrust'] };
const WVAR = {
  S: { hole: 'pause_squat', forward: 'front_squat', lockout: 'box_squat' },
  B: { chest: 'pause_bench', mid: 'spoto', lockout: 'cg_bench' },
  D: { floor: 'deficit_dl', knee: 'pause_dl', lockout: 'block_pull' },
};
const DEFVAR = { S: 'tempo_squat', B: 'pause_bench', D: 'pause_dl' };
const WEAK = {
  S: [['', 'keine / weiß nicht'], ['hole', 'Aus dem Loch (unten)'], ['forward', 'Vorneigen / Oberkörper'], ['lockout', 'Hüftstreckung oben']],
  B: [['', 'keine / weiß nicht'], ['chest', 'Weg von der Brust'], ['mid', 'Mittelpunkt'], ['lockout', 'Lockout / Trizeps']],
  D: [['', 'keine / weiß nicht'], ['floor', 'Vom Boden lösen'], ['knee', 'Knie-Höhe'], ['lockout', 'Lockout']],
};
// Wochenstruktur: Lift (S/B/D) + Typ (H=schwer, V=Volumen/Variation, L=leicht/Technik)
const TPL = {
  2: ['SH BH', 'DH BV'],
  3: ['SH BV', 'BH DH', 'SV BL DL'],
  4: ['SH BV', 'DH BL', 'BH SV', 'DV BL'],
  5: ['SH BV', 'BH DL', 'DH SL', 'SV BL', 'DV BV'],
  6: ['SH BV', 'BH DL', 'DH SL', 'SV BL', 'DV BV', 'SL BL DL'],
};
const PHASES = { acc: 'Akkumulation', int: 'Intensivierung', peak: 'Peaking', taper: 'Wettkampfwoche' };

// ---------- Lebensmittel (pro 100 g) ----------
// kat: 0 Fleisch, 1 Fisch, 2 vegetarisch, 3 vegan | r: P Protein, C Carbs, F Fett, V Gemüse, X Obst/Sonstiges | s: b/m/s (Slots)
const FOODS = [];
((...rows) => rows.forEach(r => FOODS.push({ n: r[0], k: r[1], p: r[2], c: r[3], f: r[4], kat: r[5], r: r[6], s: r[7], al: r[8] || '' })))(
  ['Hähnchenbrust', 165, 31, 0, 3.6, 0, 'P', 'm'], ['Putenbrust', 105, 24, 0, 1, 0, 'P', 'm'], ['Rinderhack (mager)', 150, 21, 0, 7, 0, 'P', 'm'],
  ['Lachs', 200, 20, 0, 13, 1, 'P', 'm', 'fish'], ['Thunfisch (Dose, natur)', 110, 25, 0, 1, 1, 'P', 'm', 'fish'], ['Seelachs', 82, 18, 0, 0.8, 1, 'P', 'm', 'fish'],
  ['Eier', 143, 12.6, 0.7, 9.5, 2, 'P', 'bm', 'egg'], ['Magerquark', 67, 12, 4, 0.3, 2, 'P', 'bs', 'lac'], ['Skyr', 63, 11, 4, 0.2, 2, 'P', 'bs', 'lac'],
  ['Griechischer Joghurt 0,2%', 55, 10, 4, 0.2, 2, 'P', 'bs', 'lac'], ['Hüttenkäse', 98, 12, 3, 4, 2, 'P', 'bms', 'lac'], ['Whey-Protein', 380, 80, 6, 6, 2, 'P', 'bs', 'lac'],
  ['Tofu', 120, 13, 2, 7, 3, 'P', 'bm', 'soy'], ['Tempeh', 190, 19, 9, 11, 3, 'P', 'm', 'soy'], ['Seitan', 140, 25, 6, 2, 3, 'P', 'm', 'glu'],
  ['Linsen (gekocht)', 116, 9, 20, 0.4, 3, 'P', 'm'], ['Kichererbsen (gekocht)', 139, 8, 23, 2.6, 3, 'P', 'm'], ['Erbsenprotein', 375, 80, 5, 6, 3, 'P', 'bs'],
  ['Sojajoghurt (ungesüßt)', 45, 4, 2, 2.2, 3, 'P', 'bs', 'soy'],
  ['Reis (gekocht)', 130, 2.7, 28, 0.3, 3, 'C', 'm'], ['Nudeln (gekocht)', 158, 5.8, 31, 0.9, 3, 'C', 'm', 'glu'], ['Kartoffeln', 77, 2, 17, 0.1, 3, 'C', 'm'],
  ['Süßkartoffel', 86, 1.6, 20, 0.1, 3, 'C', 'm'], ['Quinoa (gekocht)', 120, 4.4, 21, 1.9, 3, 'C', 'm'], ['Couscous (gekocht)', 112, 3.8, 23, 0.2, 3, 'C', 'm', 'glu'],
  ['Haferflocken', 370, 13, 59, 7, 3, 'C', 'b', 'glu'], ['Vollkornbrot', 240, 9, 42, 2.5, 3, 'C', 'b', 'glu'], ['Reiswaffeln', 385, 8, 80, 3, 3, 'C', 'bs'],
  ['Hirseflocken', 360, 11, 69, 3.5, 3, 'C', 'b'], ['Banane', 89, 1, 23, 0.3, 3, 'C', 's'], ['Datteln', 282, 2.5, 75, 0.4, 3, 'C', 's'],
  ['Olivenöl', 884, 0, 0, 100, 3, 'F', 'm'], ['Erdnussmus', 590, 25, 16, 50, 3, 'F', 'bs', 'nut'], ['Mandeln', 579, 21, 22, 50, 3, 'F', 'bs', 'nut'],
  ['Avocado', 160, 2, 9, 15, 3, 'F', 'bm'], ['Sonnenblumenkerne', 584, 21, 20, 51, 3, 'F', 'bs'], ['Gouda', 356, 25, 0, 28, 2, 'F', 'bm', 'lac'],
  ['Brokkoli', 34, 2.8, 7, 0.4, 3, 'V', 'm'], ['Paprika', 31, 1, 6, 0.3, 3, 'V', 'm'], ['Spinat', 23, 2.9, 3.6, 0.4, 3, 'V', 'm'],
  ['Zucchini', 17, 1.2, 3, 0.3, 3, 'V', 'm'], ['Tomaten', 18, 0.9, 3.9, 0.2, 3, 'V', 'm'], ['Karotten', 41, 0.9, 10, 0.2, 3, 'V', 'm'],
  ['Beeren (gemischt)', 50, 0.8, 11, 0.4, 3, 'X', 'bs'], ['Apfel', 52, 0.3, 14, 0.2, 3, 'X', 'bs'], ['Orange', 47, 0.9, 12, 0.1, 3, 'X', 'bs'],
  // Nur fürs Tracking (nicht im Plan-Generator)
  ['Milch 1,5%', 47, 3.4, 4.8, 1.5, 2, '-', '', 'lac'], ['Hafermilch', 45, 1, 6.5, 1.5, 3, '-', '', 'glu'], ['Pizza Margherita', 250, 11, 33, 8, 2, '-', '', 'glu lac'],
  ['Döner (Fleisch+Brot)', 215, 12, 20, 9, 0, '-', '', 'glu'], ['Schokolade (Vollmilch)', 535, 7.5, 58, 30, 2, '-', '', 'lac'], ['Müsliriegel', 400, 6, 65, 13, 2, '-', '', 'glu nut'],
  ['Cola', 42, 0, 10.6, 0, 3, '-', ''], ['Bier', 43, 0.5, 3.6, 0, 3, '-', ''], ['Salami', 430, 22, 1, 38, 0, '-', ''], ['Butter', 741, 0.7, 0.6, 82, 2, '-', '', 'lac'],
  ['Proteinriegel', 360, 33, 35, 10, 2, '-', '', 'lac'], ['Pommes', 312, 3.4, 41, 15, 3, '-', ''],
);

// ---------- Charaktere / Ränge ----------
const RANKS = [[1, 'E', 'Neuling'], [10, 'D', 'Eisenträger'], [20, 'C', 'Plattenbrecher'], [35, 'B', 'Hallen-Veteran'], [50, 'A', 'Titan'], [75, 'S', 'Eisen-Monarch']];
const CHARS = [
  { id: 'gremlin', n: 'Chalk Gremlin', need: 3, rar: 'Gewöhnlich', skin: '#c7e9a0', col: '#94a3b8', aura: '#a3e635', acc: 'headband', plate: '#64748b', q: 'Magnesia überall. Disziplin auch.' },
  { id: 'pup', n: 'Plate Pup', need: 7, rar: 'Gewöhnlich', skin: '#f2c9a0', col: '#38bdf8', aura: '#38bdf8', acc: 'ears', plate: '#0ea5e9', q: 'Folgt dir bis zur nächsten Einheit.' },
  { id: 'bender', n: 'Bar Bender', need: 14, rar: 'Selten', skin: '#e0a878', col: '#22c55e', aura: '#22c55e', acc: 'headband', plate: '#16a34a', q: 'Die Stange biegt sich. Du nicht.' },
  { id: 'squire', n: 'Iron Squire', need: 21, rar: 'Selten', skin: '#f2c9a0', col: '#64748b', aura: '#94a3b8', acc: 'helm', plate: '#475569', q: 'Drei Wochen. Gewohnheit entsteht.' },
  { id: 'demon', n: 'Deadlift Demon', need: 30, rar: 'Episch', skin: '#fca5a5', col: '#dc2626', aura: '#ef4444', acc: 'horns', plate: '#991b1b', q: '30 Tage. Der Boden hat Angst vor dir.' },
  { id: 'baron', n: 'Bench Baron', need: 50, rar: 'Episch', skin: '#e0a878', col: '#7c3aed', aura: '#a78bfa', acc: 'crown', plate: '#6d28d9', q: 'Brust raus, Krone auf.' },
  { id: 'shogun', n: 'Squat Shogun', need: 75, rar: 'Legendär', skin: '#f2c9a0', col: '#b45309', aura: '#f59e0b', acc: 'cape', cape: '#92400e', plate: '#d97706', q: 'Tiefe ist Ehre.' },
  { id: 'titan', n: 'Titan Tribune', need: 100, rar: 'Legendär', skin: '#d6a77a', col: '#0891b2', aura: '#22d3ee', acc: 'crown', cape: '#155e75', plate: '#06b6d4', q: '100 Tage. Du bist das System.' },
  { id: 'sovereign', n: 'Shadow Sovereign', need: 200, rar: 'Mythisch', skin: '#a5b4fc', col: '#1e1b4b', aura: '#818cf8', acc: 'horns', cape: '#312e81', plate: '#4338ca', q: 'Deine Schatten-Armee wächst.' },
  { id: 'monarch', n: 'Eternal Monarch', need: 365, rar: 'Mythisch', skin: '#fde68a', col: '#0f172a', aura: '#fbbf24', acc: 'crown', cape: '#7c2d12', plate: '#f59e0b', q: 'Ein Jahr. Unaufhaltsam.' },
  { id: 'phoenix', n: 'PR Phoenix', badge: 'pr1', rar: 'Selten', skin: '#fed7aa', col: '#ea580c', aura: '#fb923c', acc: 'cape', cape: '#c2410c', plate: '#f97316', q: 'Aus der Asche zum neuen PR.' },
  { id: 'warlord', n: 'Week Warlord', badge: 'weeks4', rar: 'Episch', skin: '#e0a878', col: '#0d9488', aura: '#2dd4bf', acc: 'helm', plate: '#0f766e', q: '4 perfekte Trainingswochen.' },
];
const BADGES = {
  first: ['Erste Quest', 'Erste Einheit abgeschlossen'], pr1: ['Erster Rekord', 'Erster PR'], sets100: ['100 Sätze', '100 Arbeitssätze'], sets500: ['500 Sätze', '500 Arbeitssätze'],
  weeks4: ['Raid-Meister', '4 Wochen komplett'], boss1: ['Bossbezwinger', 'Ersten Wochen-Boss besiegt'], food7: ['Kalorien-Kenner', '7 Tage Ernährung getrackt'], ai1: ['Auge des Systems', 'Erster KI-Scan'],
};

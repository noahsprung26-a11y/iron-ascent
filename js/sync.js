'use strict';
// Geräte-Sync über einen privaten GitHub-Gist des Nutzers (kein eigener Server nötig).
// Token und API-Key bleiben lokal auf dem Gerät und werden nicht synchronisiert.
const GHAPI = 'https://api.github.com', GFILE = 'iron-ascent.json', GDESC = 'Iron Ascent Sync';
let syncBusy = false, syncTimer = null;
const gh = (p, o = {}) => fetch(GHAPI + p, { ...o, headers: { Authorization: 'Bearer ' + S.sync.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' } })
  .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(r.status === 401 ? 'Token ungültig' : (j.message || r.status)); return j; });
const syncPayload = () => { const { set, sync, ui, ...rest } = S; return JSON.stringify(rest); };
function syncMsg(m) { S.ui.syncMsg = m; if (S.ui.tab === 'hero' && S.profile && !document.querySelector('.mod')) render(); }
function scheduleSync() { if (!S.sync || !S.sync.token || !S.sync.gistId) return; clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(false), 4000); }
async function syncNow(manual) {
  if (!S.sync.token || syncBusy) return; syncBusy = true; if (manual) syncMsg('⏳ Synchronisiere…');
  try {
    if (!S.sync.gistId) {
      const list = await gh('/gists?per_page=100'), g = list.find(x => x.files && x.files[GFILE]);
      if (g) S.sync.gistId = g.id;
    }
    if (!S.sync.gistId) {
      const g = await gh('/gists', { method: 'POST', body: JSON.stringify({ description: GDESC, public: false, files: { [GFILE]: { content: syncPayload() } } }) });
      S.sync.gistId = g.id; S.sync.base = S.mod || 0; save(true); syncMsg('✔ Verbunden – Cloud-Speicher angelegt.');
    } else {
      const g = await gh('/gists/' + S.sync.gistId), f = g.files[GFILE];
      if (!f) throw new Error('Sync-Datei im Gist nicht gefunden');
      const rem = JSON.parse(f.truncated ? await (await fetch(f.raw_url)).text() : f.content), rm = rem.mod || 0, lm = S.mod || 0, base = S.sync.base || 0;
      let pull = rm > lm, push = lm > rm;
      if (rm > base && lm > base && rm !== lm) {
        pull = confirm('Auf beiden Geräten gibt es neue Änderungen.\n\nOK = Stand aus der Cloud übernehmen (lokale Änderungen gehen verloren)\nAbbrechen = diesen Stand behalten und die Cloud überschreiben');
        push = !pull;
      }
      if (pull) {
        const keep = { set: S.set, sync: S.sync, ui: { tab: S.ui.tab || 'home' } };
        S = Object.assign(fresh(), rem, keep); S.mod = rm; S.sync.base = rm; _lp = syncJson(); save(true); render(); syncMsg('✔ Daten vom anderen Gerät geladen.');
      } else if (push) {
        await gh('/gists/' + S.sync.gistId, { method: 'PATCH', body: JSON.stringify({ files: { [GFILE]: { content: syncPayload() } } }) });
        S.sync.base = S.mod; save(true); syncMsg('✔ Hochgeladen ' + new Date().toLocaleTimeString('de-DE'));
      } else syncMsg('✔ Bereits aktuell.');
    }
    S.sync.last = Date.now(); save(true);
  } catch (e) { syncMsg('⚠ Sync-Fehler: ' + e.message); }
  syncBusy = false;
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.sync && S.sync.token) syncNow(false); });
window.addEventListener('load', () => { if (S.sync && S.sync.token) syncNow(false); });

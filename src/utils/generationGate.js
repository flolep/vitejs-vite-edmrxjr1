/**
 * Logique PURE de la gate de timing (Option A) — extraite de StepReadyToStart
 * pour être testable hors React.
 *
 * Décide si TOUS les joueurs présents (players_session) ont une préférence
 * prête (players_preferences avec ready:true).
 *
 * ⚠️ RISQUE RÉSIDUEL CONNU (hors périmètre PR #218) : le rapprochement
 * present↔pref se fait par id (pr.id === player.id) AVEC FALLBACK sur le prénom
 * (pr.name === player.name). Le playerId de players_preferences
 * (selectedPlayer?.id || `temp_${prénom}`) diffère de la clé de players_session
 * (`player_${Date.now()}`), d'où le fallback. Ce fallback est FRAGILE : deux
 * joueurs de même prénom peuvent être considérés à tort comme « prêts ».
 * Non corrigé ici (refonte d'identité = autre chantier).
 */

/**
 * Un joueur présent a-t-il une préférence ready:true qui lui correspond ?
 * @param {{ id?: string, name?: string }} player  joueur présent (players_session)
 * @param {Object} readyPrefs  map players_preferences (clé → pref)
 * @returns {boolean}
 */
export function playerHasReadyPref(player, readyPrefs) {
  if (!player) return false;
  return Object.values(readyPrefs || {}).some(
    (pr) => pr && pr.ready === true && (pr.id === player.id || pr.name === player.name)
  );
}

/**
 * Gate Option A : tous les joueurs présents ont-ils une préférence ready ?
 * @param {Array<{ id?: string, name?: string }>} players  joueurs présents
 * @param {Object} readyPrefs  map players_preferences
 * @returns {boolean}  false si aucun joueur présent
 */
export function allPlayersHavePrefs(players, readyPrefs) {
  const list = Array.isArray(players) ? players : [];
  return list.length > 0 && list.every((p) => playerHasReadyPref(p, readyPrefs));
}

/**
 * Compte des joueurs présents ayant une préférence ready (pour logs/debug).
 * @returns {{ ready: number, total: number }}
 */
export function readyPrefsCount(players, readyPrefs) {
  const list = Array.isArray(players) ? players : [];
  const ready = list.filter((p) => playerHasReadyPref(p, readyPrefs)).length;
  return { ready, total: list.length };
}

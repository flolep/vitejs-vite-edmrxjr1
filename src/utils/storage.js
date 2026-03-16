/**
 * Accès centralisé au storage navigateur.
 *
 * Règles :
 *   - spotify_access_token / spotify_token_expiry → sessionStorage (court terme)
 *   - spotify_refresh_token                       → localStorage  (persiste entre sessions)
 *   - lastSessionId, quizTestMode, pendingSessionId, wizardInProgress → localStorage
 *   - buzzer_* (reconnexion joueur)               → localStorage
 */

// ─── Spotify tokens ──────────────────────────────────────────
export const spotifyStorage = {
  getAccessToken:    () => sessionStorage.getItem('spotify_access_token'),
  setAccessToken:    (t) => sessionStorage.setItem('spotify_access_token', t),
  removeAccessToken: () => sessionStorage.removeItem('spotify_access_token'),

  getTokenExpiry:    () => sessionStorage.getItem('spotify_token_expiry'),
  setTokenExpiry:    (t) => sessionStorage.setItem('spotify_token_expiry', t.toString()),
  removeTokenExpiry: () => sessionStorage.removeItem('spotify_token_expiry'),

  getRefreshToken:    () => localStorage.getItem('spotify_refresh_token'),
  setRefreshToken:    (t) => localStorage.setItem('spotify_refresh_token', t),
  removeRefreshToken: () => localStorage.removeItem('spotify_refresh_token'),

  clearAll: () => {
    sessionStorage.removeItem('spotify_access_token');
    sessionStorage.removeItem('spotify_token_expiry');
    localStorage.removeItem('spotify_refresh_token');
  },
};

// ─── Session ─────────────────────────────────────────────────
export const sessionStorage_ = {
  getLastSessionId:    () => localStorage.getItem('lastSessionId'),
  setLastSessionId:    (id) => localStorage.setItem('lastSessionId', id),

  getPendingSessionId:    () => localStorage.getItem('pendingSessionId'),
  setPendingSessionId:    (id) => localStorage.setItem('pendingSessionId', id),
  removePendingSessionId: () => localStorage.removeItem('pendingSessionId'),

  getWizardInProgress:    () => localStorage.getItem('wizardInProgress'),
  setWizardInProgress:    (v) => localStorage.setItem('wizardInProgress', v),
  removeWizardInProgress: () => localStorage.removeItem('wizardInProgress'),
};

// ─── Préférences ─────────────────────────────────────────────
export const prefsStorage = {
  getTestMode: () => localStorage.getItem('quizTestMode') === 'true',
  setTestMode: (val) => localStorage.setItem('quizTestMode', val.toString()),
};

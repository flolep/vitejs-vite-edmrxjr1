/**
 * Hook pour gérer le localStorage du mode Buzzer
 * Sauvegarde et restaure l'état de la session, du joueur, et des préférences
 */

const STORAGE_KEY = 'buzzer_session_data';
const MAX_AGE = 3 * 60 * 60 * 1000; // 3 heures

export function useBuzzerLocalStorage() {
  const saveToLocalStorage = (data) => {
    try {
      // Récupérer les données existantes pour préserver certains flags
      const existing = localStorage.getItem(STORAGE_KEY);
      const existingData = existing ? JSON.parse(existing) : {};

      // Merger les nouvelles données avec les existantes
      const toSave = {
        ...existingData,
        ...data,
        timestamp: Date.now()
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      console.log('✅ Session sauvegardée dans localStorage');
    } catch (err) {
      console.error('❌ Erreur sauvegarde localStorage:', err);
    }
  };

  const loadFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);

        // Vérifier que les données ne sont pas trop anciennes (3h max)
        const age = Date.now() - (data.timestamp || 0);
        if (age > MAX_AGE) {
          console.log('⚠️ Données localStorage trop anciennes, suppression');
          localStorage.removeItem(STORAGE_KEY);
          return null;
        }

        console.log('✅ Données trouvées dans localStorage:', data);
        return data;
      }
    } catch (err) {
      console.error('❌ Erreur lecture localStorage:', err);
    }
    return null;
  };

  const clearLocalStorage = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('✅ localStorage nettoyé');
    } catch (err) {
      console.error('❌ Erreur nettoyage localStorage:', err);
    }
  };

  return {
    save: saveToLocalStorage,
    load: loadFromLocalStorage,
    clear: clearLocalStorage
  };
}

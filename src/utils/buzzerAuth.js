import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

/**
 * Authentification anonyme du Buzzer.
 *
 * POURQUOI — le Buzzer ne s'authentifiait pas du tout : seul le Master se
 * connecte (email/mot de passe, cf. components/Login.jsx). Or la regle de
 * securite de `final_reveal_request` exige `auth != null`, volontairement plus
 * stricte que celle de `quiz_next_song_request` qui n'en demande aucune : ce
 * noeud peut TERMINER LA PARTIE, il ne doit pas etre ecrivable par n'importe
 * quel client connaissant l'ID de session.
 *
 * Sans cette connexion anonyme, le bouton du vainqueur echouerait en
 * PERMISSION_DENIED et la fonctionnalite serait morte a la livraison.
 *
 * ⚠️ PREREQUIS DE DEPLOIEMENT — le fournisseur « Anonyme » doit etre active
 * dans la console Firebase (Authentication > Sign-in method). S'il ne l'est
 * pas, signInAnonymously echoue : le bouton du vainqueur reste inoperant, mais
 * la partie ne se bloque pas pour autant (bouton animateur + timeout 45 s).
 *
 * Idempotent : si une session d'authentification existe deja, on la reutilise.
 */

let authPromise = null;

export function ensureAnonymousAuth() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (authPromise) return authPromise;

  authPromise = new Promise((resolve) => {
    // onAuthStateChanged couvre le cas ou une session est restauree depuis le
    // stockage local pendant qu'on demarre : inutile d'en creer une seconde.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsubscribe();
        resolve(user);
      }
    });

    signInAnonymously(auth)
      .then(({ user }) => {
        console.log('🔑 [Buzzer] Authentification anonyme OK');
        resolve(user);
      })
      .catch((err) => {
        console.warn(
          '⚠️ [Buzzer] Authentification anonyme impossible:', err.code,
          '— le fournisseur « Anonyme » est-il active dans la console Firebase ?'
        );
        // On resout a null plutot que de rejeter : le reste du buzzer
        // fonctionne sans authentification, seul le bouton du vainqueur en
        // depend, et il a deja deux filets (bouton animateur, timeout 45 s).
        authPromise = null;
        resolve(null);
      });
  });

  return authPromise;
}

/** L'utilisateur courant est-il authentifie ? */
export function isAuthenticated() {
  return auth.currentUser !== null;
}

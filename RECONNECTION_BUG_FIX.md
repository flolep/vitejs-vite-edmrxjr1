# 🐛 Bug : Reconnexion permanente - Le joueur ne se déconnecte jamais

## Problème actuel

Le joueur reste connecté **indéfiniment** (jusqu'à 24h) et ne peut pas se déconnecter manuellement.

**Cause :**
- localStorage garde la session pendant 24h
- Aucun bouton de déconnexion
- Le localStorage n'est pas nettoyé quand la partie se termine

---

## ✅ Solutions à implémenter

### Solution 1 : Ajouter un bouton "Se déconnecter"

**Dans l'écran de jeu (step === 'game')**, ajouter un bouton en haut à droite :

```jsx
// En haut de l'écran game, ajouter :
<button
  onClick={() => {
    if (confirm('Voulez-vous vraiment vous déconnecter de la partie ?')) {
      clearLocalStorage();
      setSessionId('');
      setStep('session');
      setPlayerName('');
      setSelectedPlayer(null);
      setTeam(null);
      // Réinitialiser tous les états
    }
  }}
  style={{
    position: 'absolute',
    top: '1rem',
    right: '1rem',
    padding: '0.5rem 1rem',
    background: 'rgba(255, 255, 255, 0.2)',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '12px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '0.9rem',
    zIndex: 1000
  }}
>
  🚪 Quitter
</button>
```

---

### Solution 2 : Réduire l'expiration à 3h au lieu de 24h

**Dans `loadFromLocalStorage()` (ligne 95) :**

```javascript
// ❌ AVANT
if (age > 24 * 60 * 60 * 1000) {

// ✅ APRÈS (3 heures)
if (age > 3 * 60 * 60 * 1000) {
```

**Justification :** Une partie de blind test dure rarement plus de 2-3h.

---

### Solution 3 : Ne pas reconnecter si la session est inactive

**Dans `attemptAutoReconnect()` (ligne ~131), c'est déjà implémenté ✅**

```javascript
if (!snapshot.exists() || !snapshot.val().active) {
  console.log('❌ Session expirée ou inactive');
  clearLocalStorage();  // ✅ Déjà présent
  setIsReconnecting(false);
  resolve(false);
  return;
}
```

---

### Solution 4 (Optionnelle) : Nettoyer à la fermeture du navigateur

**Ajouter un useEffect pour nettoyer au `beforeunload` :**

```javascript
useEffect(() => {
  const handleBeforeUnload = () => {
    // Option A : Toujours nettoyer (pas de reconnexion)
    clearLocalStorage();

    // Option B : Garder seulement si partie active (reconnexion possible)
    // Ne rien faire ici, laisser le système actuel
  };

  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}, []);
```

**Note :** Si vous voulez que les joueurs puissent revenir après avoir fermé l'onglet, NE PAS implémenter cette solution.

---

## 🎯 Recommandation

**Minimum requis :**
- ✅ Solution 1 : Bouton "Quitter" (obligatoire)
- ✅ Solution 2 : Réduire à 3h (recommandé)

**Comportement optimal :**
1. Le joueur peut se déconnecter manuellement
2. Si le joueur rafraîchit la page pendant la partie → reconnexion automatique ✅
3. Si le joueur revient 4h après → doit rescanner le QR code
4. Si la session est terminée côté Master → pas de reconnexion

---

## 🛠️ Modifications à faire dans Buzzer.jsx

**Fichier :** `src/Buzzer.jsx`

**Ligne 95 :** Changer `24 * 60 * 60 * 1000` en `3 * 60 * 60 * 1000`

**Ligne ~1050+ :** Ajouter le bouton "Quitter" dans l'écran de jeu

---

**Voulez-vous que je crée ces modifications ?**

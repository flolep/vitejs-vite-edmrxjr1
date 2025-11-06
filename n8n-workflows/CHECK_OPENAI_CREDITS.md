# 🔍 Vérifier vos crédits OpenAI - Guide complet

## 1️⃣ Vérifier le solde de crédits

### Méthode officielle OpenAI Platform

1. **Aller sur le dashboard de facturation**
   ```
   https://platform.openai.com/account/billing/overview
   ```

2. **Connexion**
   - Connectez-vous avec le compte utilisé dans n8n
   - ⚠️ Important : Vérifiez que c'est le MÊME compte que dans n8n

3. **Vérifier 3 informations clés**

   **A. Solde actuel (Credit Balance)**
   - Section "Credit balance" en haut
   - Si > $0.00 → Vous avez des crédits ✅
   - Si = $0.00 → Plus de crédits ❌

   **B. Utilisation du mois (Usage)**
   - Section "Usage" ou "Current usage"
   - Montre combien vous avez dépensé ce mois
   - Cliquez sur "View usage" pour les détails

   **C. Limite de dépense (Hard limit)**
   - Section "Limits" ou "Usage limits"
   - Si usage >= limite → Bloqué même avec crédits
   - Par défaut : $120/mois

---

## 2️⃣ Diagnostic de l'erreur

### Cas A : Vous avez des crédits MAIS erreur quand même

**Causes possibles :**

#### 1. **Limite de dépense atteinte**
- Vous avez des crédits
- MAIS vous avez atteint votre limite mensuelle
- Solution : Augmenter la limite

**Comment vérifier :**
```
Platform → Billing → Limits → Hard limit
```

Si `Usage actuel >= Hard limit` → C'est ça le problème !

**Comment corriger :**
```
Billing → Limits → Set monthly limit → Augmenter (ex: $150)
```

---

#### 2. **Mauvaise clé API utilisée**
- Vous avez des crédits sur un compte
- Mais n8n utilise une clé API d'un AUTRE compte

**Comment vérifier :**

1. **Récupérer la clé utilisée dans n8n**
   - n8n → Settings → Credentials
   - Chercher "OpenAi account"
   - Copier les 8 premiers caractères de la clé (ex: `sk-proj-abc123...`)

2. **Vérifier sur OpenAI**
   ```
   https://platform.openai.com/api-keys
   ```
   - Voir la liste de vos clés
   - Vérifier que votre clé n8n est dans la liste
   - Si absente → Vous utilisez la clé d'un autre compte !

**Comment corriger :**
- Créer une nouvelle clé API sur le bon compte
- Mettre à jour dans n8n (Credentials → OpenAi account)

---

#### 3. **Organisation différente**
- Vous avez plusieurs organisations OpenAI
- Les crédits sont dans org A
- La clé API est liée à org B (sans crédits)

**Comment vérifier :**

1. **Voir vos organisations**
   ```
   https://platform.openai.com/account/organization
   ```

2. **Pour chaque organisation, vérifier les crédits**
   - Changer d'organisation (menu en haut)
   - Billing → Overview
   - Noter le solde

3. **Vérifier quelle org est liée à votre clé API**
   - API keys → Voir quelle org possède votre clé

**Comment corriger :**
- Créer une clé API dans la bonne organisation
- OU transférer des crédits entre organisations

---

#### 4. **Type de compte (Free tier vs Pay-as-you-go)**

OpenAI a 2 types de comptes :

**Free tier (gratuit)**
- $5 de crédits gratuits (à l'inscription)
- Expire après 3 mois
- Limité à certains modèles
- GPT-4 peut être bloqué

**Pay-as-you-go (payant)**
- Nécessite une carte bancaire
- Accès à tous les modèles
- Pas d'expiration

**Comment vérifier votre type :**
```
Platform → Billing → Overview
```

Si vous voyez :
- "Free trial credits" → Compte gratuit (peut expirer)
- "Prepaid credits" ou carte bancaire → Compte payant ✅

**Si free tier expiré :**
- Ajouter une carte bancaire
- Billing → Payment methods → Add payment method
- Acheter des crédits ($5 minimum)

---

## 3️⃣ Vérification détaillée avec l'API

### Test avec cURL (avancé)

```bash
# Remplacez YOUR_API_KEY par votre vraie clé
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Test"}]
  }'
```

**Résultats possibles :**

✅ **Succès** (200 OK)
```json
{
  "choices": [{"message": {"content": "..."}}]
}
```
→ Votre clé fonctionne ! Le problème est ailleurs.

❌ **Erreur quota** (429)
```json
{
  "error": {
    "message": "You exceeded your current quota",
    "type": "insufficient_quota"
  }
}
```
→ Confirmé : plus de crédits ou limite atteinte.

❌ **Clé invalide** (401)
```json
{
  "error": {
    "message": "Incorrect API key provided"
  }
}
```
→ La clé est incorrecte ou révoquée.

---

## 4️⃣ Checklist de diagnostic complète

Cochez au fur et à mesure :

### Étape 1 : Compte OpenAI
- [ ] Je me connecte sur https://platform.openai.com
- [ ] Je vois mon dashboard
- [ ] Je suis sur le bon compte (vérifier l'email en haut à droite)

### Étape 2 : Solde
- [ ] Billing → Overview
- [ ] Credit balance : ______ $ (noter le montant)
- [ ] Si $0.00 → **Ajouter des crédits** (Solution évidente)

### Étape 3 : Limites
- [ ] Billing → Limits
- [ ] Hard limit : ______ $/mois
- [ ] Usage actuel : ______ $/mois
- [ ] Si usage >= limit → **Augmenter la limite**

### Étape 4 : Type de compte
- [ ] Billing → Overview
- [ ] Type : Free trial / Pay-as-you-go
- [ ] Si Free trial : Date d'expiration ? __________
- [ ] Carte bancaire ajoutée ? Oui / Non

### Étape 5 : Clé API
- [ ] API keys → Voir mes clés
- [ ] Ma clé n8n est dans la liste : Oui / Non
- [ ] Organisation de la clé : __________
- [ ] Organisation avec crédits : __________
- [ ] C'est la même ? Oui / Non

### Étape 6 : Test API
- [ ] Tester avec cURL (voir ci-dessus)
- [ ] Résultat : Succès / Erreur quota / Clé invalide

---

## 5️⃣ Solutions selon le diagnostic

### Si Credit balance = $0.00
→ **Ajouter des crédits**
```
Billing → Payment methods → Add credit
Montant recommandé : $10 (avec GPT-3.5 = 200 générations)
```

### Si Usage >= Hard limit
→ **Augmenter la limite**
```
Billing → Limits → Hard limit → Modifier
Nouvelle limite recommandée : $150/mois
```

### Si Free trial expiré
→ **Passer en Pay-as-you-go**
```
Billing → Payment methods → Add payment method
Ajouter une carte bancaire
Acheter $5 minimum de crédits
```

### Si mauvaise clé API
→ **Créer une nouvelle clé**
```
API keys → Create new secret key
Copier la clé (commence par sk-...)
n8n → Credentials → OpenAi account → Coller la nouvelle clé
```

### Si mauvaise organisation
→ **Changer d'organisation OU créer nouvelle clé**
```
Option 1 : Créer la clé dans la bonne org
Option 2 : Transférer des crédits
```

---

## 6️⃣ Vérifier dans n8n

### Après avoir résolu le problème OpenAI :

1. **Tester directement dans n8n**
   - Workflows → Votre workflow
   - Cliquer sur "Test workflow"
   - Exécuter manuellement

2. **Voir les logs**
   - Executions (menu gauche)
   - Cliquer sur la dernière exécution
   - Voir quel node a échoué

3. **Vérifier les credentials**
   - Settings → Credentials
   - OpenAi account → Edit
   - Tester la connexion

---

## 7️⃣ Astuce : Voir l'utilisation détaillée

### Pour comprendre où part votre argent :

```
Platform → Billing → Usage
```

Vous verrez :
- Utilisation par jour
- Utilisation par modèle (GPT-4, GPT-3.5, etc.)
- Coût par requête
- Nombre de tokens consommés

**Exemple :**
```
2025-11-06
- gpt-4o : 50 requêtes → $25.00
- gpt-3.5-turbo : 10 requêtes → $0.50
```

Si vous voyez beaucoup de GPT-4 → Normal que les crédits partent vite !

---

## 📊 Récapitulatif des URLs importantes

| Action | URL |
|--------|-----|
| **Voir le solde** | https://platform.openai.com/account/billing/overview |
| **Voir l'utilisation** | https://platform.openai.com/account/usage |
| **Gérer les limites** | https://platform.openai.com/account/limits |
| **Gérer les clés API** | https://platform.openai.com/api-keys |
| **Ajouter paiement** | https://platform.openai.com/account/billing/payment-methods |
| **Organisations** | https://platform.openai.com/account/organization |

---

## 🆘 Cas spécial : Crédits gratuits expirés

Si vous voyez :
```
Free trial credits: $0.00 (Expired)
```

**C'est normal !** Les $5 gratuits expirent après 3 mois.

**Solution :**
1. Ajouter une carte bancaire
2. Acheter au moins $5 de crédits
3. Passer en "Pay-as-you-go"

**Après ça :**
- Accès à tous les modèles
- Pas d'expiration
- Paiement à l'usage

---

## ✅ Après vérification

Une fois que vous savez où vous en êtes, dites-moi :

1. **Solde actuel** : ___ $
2. **Type de compte** : Free trial / Pay-as-you-go
3. **Usage ce mois** : ___ $
4. **Limite mensuelle** : ___ $
5. **Résultat du test cURL** : Succès / Erreur

Et je vous dirai exactement quoi faire ! 🚀

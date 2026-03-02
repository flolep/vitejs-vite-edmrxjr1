# CLAUDE.md — Instructions projet Blind Test App

## Routine Git obligatoire

Après CHAQUE session de travail, Claude Code doit automatiquement exécuter cette routine **sans demander de validation** :

1. `git status` — vérifier qu'il n'y a rien de non commité
2. `git add . && git commit -m "..."` — committer tout le travail restant
3. `git checkout develop`
4. `git pull --rebase`
5. `git merge {branche-de-travail} --no-ff` — merge la branche de travail dans develop
6. En cas de conflit : résoudre en conservant toutes les modifications des deux côtés, puis committer
7. `git push origin develop`
8. Confirmer : "✅ Déployé sur develop — disponible sur Netlify dans 2-3 minutes"

Cette routine est **NON NÉGOCIABLE** et doit être exécutée automatiquement à la fin de chaque session.

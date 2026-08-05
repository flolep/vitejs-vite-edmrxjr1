#!/usr/bin/env bash
# scripts/wt.sh — gestion des worktrees pour agents Claude Code parallèles
#
#   ./scripts/wt.sh new fix/tv-scaling      crée le worktree + env + deps
#   ./scripts/wt.sh ls                      liste les worktrees actifs
#   ./scripts/wt.sh rm fix/tv-scaling       supprime worktree + branche locale
#   ./scripts/wt.sh clean                   purge tous les worktreees mergés
#
# Les worktrees sont créés dans ../blindtest-<slug> à côté du repo principal.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PARENT="$(dirname "$ROOT")"
BASE="${BASE_BRANCH:-develop}"

slug() { echo "$1" | sed 's|.*/||' | tr -cd '[:alnum:]-'; }

new() {
  local branch="$1"
  local dir="$PARENT/blindtest-$(slug "$branch")"

  [ -d "$dir" ] && { echo "❌ $dir existe déjà"; exit 1; }

  git -C "$ROOT" fetch origin "$BASE" --quiet
  git -C "$ROOT" worktree add "$dir" -b "$branch" "origin/$BASE"

  # .env n'est pas tracké : sans lui, Vite ne démarre pas
  for f in .env .env.local; do
    [ -f "$ROOT/$f" ] && cp "$ROOT/$f" "$dir/$f" && echo "📋 $f copié"
  done

  # symlink node_modules : instantané, et suffisant tant que package.json
  # ne change pas d'une branche à l'autre
  if [ -d "$ROOT/node_modules" ]; then
    ln -s "$ROOT/node_modules" "$dir/node_modules"
    echo "🔗 node_modules lié"
  else
    echo "⚠️  pas de node_modules à la racine, lance npm install"
  fi

  echo ""
  echo "✅ $branch prêt"
  echo "   cd $dir && claude"
}

rm_wt() {
  local branch="$1"
  local dir="$PARENT/blindtest-$(slug "$branch")"
  # retire le symlink avant, sinon git worktree remove râle
  [ -L "$dir/node_modules" ] && unlink "$dir/node_modules"
  git -C "$ROOT" worktree remove "$dir" --force
  git -C "$ROOT" branch -D "$branch" 2>/dev/null || true
  echo "🗑️  $branch supprimé"
}

clean() {
  git -C "$ROOT" fetch origin "$BASE" --quiet
  git -C "$ROOT" worktree list --porcelain | grep '^branch' | sed 's|branch refs/heads/||' | while read -r b; do
    [ "$b" = "$BASE" ] && continue
    if git -C "$ROOT" merge-base --is-ancestor "$b" "origin/$BASE" 2>/dev/null; then
      echo "→ $b est mergé dans $BASE"
      rm_wt "$b"
    fi
  done
  git -C "$ROOT" worktree prune
}

case "${1:-}" in
  new)   new "$2" ;;
  rm)    rm_wt "$2" ;;
  ls)    git -C "$ROOT" worktree list ;;
  clean) clean ;;
  *)     sed -n '2,12p' "$0" ; exit 1 ;;
esac

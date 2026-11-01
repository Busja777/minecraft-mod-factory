#!/usr/bin/env bash
# Überträgt die ausgefüllten Werte aus secrets.env als GitHub-Actions-Secrets.
# Werte gehen per stdin an gh, nie als Argument, und werden nie ausgegeben.
#   npm run secrets:push              → nur setzen
#   npm run secrets:push -- --cleanup → zusätzlich veraltetes CF_PROJECT_IDS löschen
set -euo pipefail
cd "$(dirname "$0")/.."

FILE="secrets.env"
ALLOWED=(ANTHROPIC_API_KEY CF_API_TOKEN OPENAI_API_KEY FAL_API_KEY MODRINTH_API_TOKEN)
OBSOLETE=(CF_PROJECT_IDS)

[[ -f "$FILE" ]] || { echo "✗ $FILE fehlt. Erst: cp secrets.env.example secrets.env"; exit 1; }
command -v gh >/dev/null || { echo "✗ GitHub CLI (gh) nicht installiert"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "✗ gh ist nicht eingeloggt: gh auth login"; exit 1; }
git check-ignore -q "$FILE" || { echo "✗ $FILE ist nicht gitignored – Abbruch"; exit 1; }
chmod 600 "$FILE"

is_allowed() { local k; for k in "${ALLOWED[@]}"; do [[ "$k" == "$1" ]] && return 0; done; return 1; }

set_count=0
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
  [[ "$line" =~ ^([A-Z0-9_]+)=(.*)$ ]] || { echo "⚠ Zeile übersprungen (Format KEY=WERT erwartet)"; continue; }
  key="${BASH_REMATCH[1]}"; val="${BASH_REMATCH[2]}"
  val="${val%$'\r'}"; val="${val#\"}"; val="${val%\"}"; val="${val#\'}"; val="${val%\'}"
  val="$(printf '%s' "$val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  [[ -z "$val" ]] && continue
  if ! is_allowed "$key"; then echo "· $key ist eine Info, wird nicht hochgeladen"; continue; fi

  case "$key" in
    CF_API_TOKEN)
      [[ "$val" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]] \
        || { echo "✗ CF_API_TOKEN ist keine UUID (Studios-Key erwischt?) – übersprungen"; continue; } ;;
    ANTHROPIC_API_KEY)
      [[ "$val" == sk-ant-* ]] || { echo "✗ ANTHROPIC_API_KEY beginnt nicht mit sk-ant- – übersprungen"; continue; } ;;
    OPENAI_API_KEY)
      [[ "$val" == sk-* ]] || { echo "✗ OPENAI_API_KEY beginnt nicht mit sk- – übersprungen"; continue; } ;;
  esac

  printf '%s' "$val" | gh secret set "$key" >/dev/null
  echo "✓ $key gesetzt (${#val} Zeichen)"
  set_count=$((set_count + 1))
done < "$FILE"

if [[ "${1:-}" == "--cleanup" ]]; then
  for k in "${OBSOLETE[@]}"; do
    if gh secret list | grep -q "^$k[[:space:]]"; then gh secret delete "$k" && echo "✓ $k gelöscht"; fi
  done
fi

echo "Fertig: $set_count Secret(s) übertragen. Kontrolle: gh secret list"

#!/bin/zsh
# Doppelklick-Start für das Minecraft Studio: holt die neuesten Daten und öffnet das Dashboard im Browser.
# Liegt in minecraft-mod-factory/Macros/ und findet das Projekt selbst (eine Ebene höher).
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
cd "${0:A:h}/.." || { echo "Projektordner nicht gefunden."; read; exit 1; }
# Nur bei sauberem Arbeitsstand pullen, damit ein Doppelklick nie laufende Arbeit (z. B. von Claude) stört.
if git diff --quiet && git diff --cached --quiet; then
  echo "Hole neueste Daten (git pull) ..."
  git pull --ff-only || echo "⚠ git pull hat nicht geklappt, ich arbeite mit dem lokalen Stand weiter."
else
  echo "ℹ Es gibt lokale Änderungen im Projekt. Ich überspringe git pull und arbeite mit dem lokalen Stand."
fi
npm run -s studio
echo
read "?Studio beendet. Enter schließt dieses Fenster."

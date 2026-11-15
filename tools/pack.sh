#!/usr/bin/env bash
# Genera el zip instalable de Bahía Dock en dist/, listo para
# "gnome-extensions install" o para subir a extensions.gnome.org.
#
# Uso: tools/pack.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$REPO_DIR/dist"

gnome-extensions pack "$REPO_DIR" \
    --force \
    --out-dir="$REPO_DIR/dist" \
    --schema="schemas/org.gnome.shell.extensions.bahia-dock.gschema.xml" \
    --extra-source=core \
    --extra-source=features \
    --extra-source=LICENSE

ls -l "$REPO_DIR/dist"

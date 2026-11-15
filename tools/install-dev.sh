#!/usr/bin/env bash
# Instala Bahía Dock en modo desarrollo:
#   1. Compila el esquema de GSettings en schemas/gschemas.compiled.
#   2. Crea un enlace simbólico desde la carpeta de extensiones de GNOME
#      hacia este repositorio, para editar en un solo sitio.
#
# Uso: tools/install-dev.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UUID="$(grep -oP '"uuid":\s*"\K[^"]+' "$REPO_DIR/metadata.json")"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions"
LINK="$EXT_DIR/$UUID"

glib-compile-schemas --strict "$REPO_DIR/schemas"
echo "Esquema compilado en $REPO_DIR/schemas/gschemas.compiled"

mkdir -p "$EXT_DIR"
if [[ -L "$LINK" ]]; then
    echo "El enlace ya existe: $LINK -> $(readlink "$LINK")"
elif [[ -e "$LINK" ]]; then
    echo "Error: $LINK existe y no es un enlace simbólico. Revísalo a mano." >&2
    exit 1
else
    ln -s "$REPO_DIR" "$LINK"
    echo "Enlace creado: $LINK -> $REPO_DIR"
fi

echo
echo "GNOME Shell en Wayland solo detecta extensiones nuevas al iniciar sesión."
echo "Prueba primero en la sesión anidada: tools/nested-session.sh"

#!/usr/bin/env bash
# Abre una sesión de GNOME Shell anidada en una ventana, con Bahía Dock
# activada, para probar sin arriesgar la sesión real.
#
# Requisito (versión igual a la de mutter instalada):
#   sudo dnf install mutter-devkit-$(rpm -q --qf '%{VERSION}-%{RELEASE}' mutter)
#
# Uso: tools/nested-session.sh [ANCHOxALTO]   (por defecto 1600x900)
#
# Los mensajes de la sesión anidada se ven en esta misma terminal.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UUID="$(grep -oP '"uuid":\s*"\K[^"]+' "$REPO_DIR/metadata.json")"
SIZE="${1:-1600x900}"

if ! rpm -q mutter-devkit >/dev/null 2>&1; then
    echo "Falta mutter-devkit. Instálalo con:" >&2
    echo "  sudo dnf install mutter-devkit-$(rpm -q --qf '%{VERSION}-%{RELEASE}' mutter)" >&2
    exit 1
fi

glib-compile-schemas --strict "$REPO_DIR/schemas"

# La sesión anidada comparte dconf con la sesión real: añadir la
# extensión a enabled-extensions aquí también la deja activada en la
# sesión real a partir del próximo inicio de sesión.
ENABLED="$(gsettings get org.gnome.shell enabled-extensions)"
if [[ "$ENABLED" != *"'$UUID'"* ]]; then
    NEW="$(python3 -I -c 'import ast,sys; l=ast.literal_eval(sys.argv[1].replace("@as ","")); l.append(sys.argv[2]); print(l)' "$ENABLED" "$UUID")"
    gsettings set org.gnome.shell enabled-extensions "$NEW"
    echo "Añadida $UUID a las extensiones activadas."
fi

export MUTTER_DEBUG_DUMMY_MODE_SPECS="$SIZE"
export SHELL_DEBUG=backtrace-warnings

dbus-run-session -- gnome-shell --devkit --wayland

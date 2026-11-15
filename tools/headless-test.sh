#!/usr/bin/env bash
# Prueba automática de Bahía Dock en un GNOME Shell sin pantalla.
#
# Arranca gnome-shell --headless en un entorno aislado (ajustes,
# extensiones, caché y bus D-Bus propios), activa la extensión, hace
# varios ciclos de desactivar y activar, y revisa el registro.
# No toca la sesión real ni sus ajustes y no necesita mutter-devkit.
#
# Uso: tools/headless-test.sh [CICLOS]   (por defecto 5)
# Sale con código 0 si no hay errores de la extensión.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UUID="$(grep -oP '"uuid":\s*"\K[^"]+' "$REPO_DIR/metadata.json")"
NAME="$(grep -oP '"name":\s*"\K[^"]+' "$REPO_DIR/metadata.json")"
CYCLES="${1:-5}"

# Ruta corta: el socket de Wayland no admite rutas de más de 108 bytes.
WORK="$(mktemp -d /tmp/bahia-test.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK"/{config,cache,run,data/gnome-shell/extensions}
chmod 700 "$WORK/run"
ln -s "$REPO_DIR" "$WORK/data/gnome-shell/extensions/$UUID"
glib-compile-schemas --strict "$REPO_DIR/schemas"

cat > "$WORK/inner.sh" <<EOF
set -u
gsettings set org.gnome.shell enabled-extensions "['$UUID']"
gsettings set org.gnome.shell welcome-dialog-last-shown-version '999'
gsettings --schemadir '$REPO_DIR/schemas' set org.gnome.shell.extensions.bahia-dock debug-logging true

gnome-shell --headless --wayland --no-x11 --virtual-monitor 1280x800 &
SHELL_PID=\$!

for _ in \$(seq 1 30); do
    gnome-extensions info '$UUID' 2>/dev/null | grep -q 'ACTIVE' && break
    sleep 1
done

for _ in \$(seq 1 $CYCLES); do
    gnome-extensions disable '$UUID'; sleep 1
    gnome-extensions enable '$UUID'; sleep 1
done

echo "== ESTADO"
gnome-extensions info '$UUID'
kill \$SHELL_PID
wait \$SHELL_PID 2>/dev/null
EOF

env -u DISPLAY -u WAYLAND_DISPLAY \
    XDG_CONFIG_HOME="$WORK/config" \
    XDG_DATA_HOME="$WORK/data" \
    XDG_CACHE_HOME="$WORK/cache" \
    XDG_RUNTIME_DIR="$WORK/run" \
    dbus-run-session -- bash "$WORK/inner.sh" > "$WORK/log.txt" 2>&1 || true

echo "== Mensajes de $NAME"
grep -F "[$NAME]" "$WORK/log.txt" || echo "(ninguno)"
echo
sed -n '/== ESTADO/,$p' "$WORK/log.txt" | grep -E 'Activado|Estado|Enabled|State' || true
echo

FAIL=0
grep -q 'Estado: ACTIVE\|State: ACTIVE' "$WORK/log.txt" || { echo "FALLO: la extensión no quedó activa"; FAIL=1; }
if grep -F "[$NAME]" "$WORK/log.txt" | grep -qiE 'error|warn|No se pudo'; then
    echo "FALLO: hay errores o avisos de la extensión"; FAIL=1
fi
if grep -E 'JS ERROR|Extension .*(had error|error)' "$WORK/log.txt" | grep -q "$UUID"; then
    echo "FALLO: GNOME Shell informó de un error de la extensión"; FAIL=1
fi

[[ $FAIL -eq 0 ]] && echo "OK: $CYCLES ciclos sin errores"
exit $FAIL

#!/usr/bin/env bash
# Prueba automática de Bahía Dock en un GNOME Shell sin pantalla.
#
# Arranca gnome-shell --headless en un entorno aislado (ajustes,
# extensiones, caché y bus D-Bus propios), activa la extensión y:
#
#   1. Hace varios ciclos de desactivar y activar.
#   2. Abre una ventana (Editor de texto) y activa la extensión auxiliar
#      tools/test-probe, que maximiza la ventana, mide el dock y el área
#      de trabajo, y hace capturas de pantalla.
#   3. Revisa el registro y comprueba que la ventana maximizada empieza
#      a la derecha del dock.
#
# No toca la sesión real ni sus ajustes y no necesita mutter-devkit.
#
# Uso: tools/headless-test.sh [CICLOS] [CARPETA_CAPTURAS]
#      CICLOS por defecto 5. Si se indica CARPETA_CAPTURAS, se copian
#      allí las capturas probe-*.png y el registro completo.
# Sale con código 0 si todo es correcto.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UUID="$(grep -oP '"uuid":\s*"\K[^"]+' "$REPO_DIR/metadata.json")"
NAME="$(grep -oP '"name":\s*"\K[^"]+' "$REPO_DIR/metadata.json")"
PROBE_UUID="bahia-dock-probe@test"
CYCLES="${1:-5}"
SHOTS_DIR="${2:-}"

# Las favoritas de la sesión real (solo lectura) para que el dock de la
# prueba muestre lo mismo que verías tú.
FAVORITES="$(gsettings get org.gnome.shell favorite-apps)"

# Ruta corta: el socket de Wayland no admite rutas de más de 108 bytes.
WORK="$(mktemp -d /tmp/bahia-test.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK"/{config,cache,run,data/gnome-shell/extensions}
chmod 700 "$WORK/run"
ln -s "$REPO_DIR" "$WORK/data/gnome-shell/extensions/$UUID"
ln -s "$REPO_DIR/tools/test-probe" "$WORK/data/gnome-shell/extensions/$PROBE_UUID"
glib-compile-schemas --strict "$REPO_DIR/schemas"
LOG="$WORK/log.txt"

cat > "$WORK/inner.sh" <<EOF
set -u
gsettings set org.gnome.shell enabled-extensions "['$UUID']"
gsettings set org.gnome.shell favorite-apps "$FAVORITES"
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

# Una ventana real para comprobar el maximizado.
if command -v gnome-text-editor >/dev/null; then
    WAYLAND_DISPLAY=wayland-0 GDK_BACKEND=wayland gnome-text-editor >/dev/null 2>&1 &
    sleep 4
fi

gnome-extensions enable '$PROBE_UUID'
for _ in \$(seq 1 40); do
    grep -q 'PROBE fin\|PROBE ERROR' '$LOG' && break
    sleep 1
done
gnome-extensions disable '$PROBE_UUID'

echo "== ESTADO"
gnome-extensions info '$UUID'

# Desactivar al final comprueba que el dash nativo se restaura.
gnome-extensions disable '$UUID'
sleep 1
echo "== DESACTIVADA"
kill \$SHELL_PID
wait \$SHELL_PID 2>/dev/null
EOF

env -u DISPLAY -u WAYLAND_DISPLAY \
    XDG_CONFIG_HOME="$WORK/config" \
    XDG_DATA_HOME="$WORK/data" \
    XDG_CACHE_HOME="$WORK/cache" \
    XDG_RUNTIME_DIR="$WORK/run" \
    dbus-run-session -- bash "$WORK/inner.sh" > "$LOG" 2>&1 || true

echo "== Mensajes de $NAME"
grep -F "[$NAME]" "$LOG" | sed 's/^.*\[/[/' || echo "(ninguno)"
echo
echo "== Medidas"
grep -F 'PROBE' "$LOG" | sed 's/^.*PROBE /  /' || echo "(la sonda no se ejecutó)"
echo
sed -n '/== ESTADO/,/== DESACTIVADA/p' "$LOG" | grep -E 'Activado|Estado|Enabled|State' || true
echo

FAIL=0
fail() { echo "FALLO: $*"; FAIL=1; }

grep -q 'Estado: ACTIVE\|State: ACTIVE' "$LOG" || fail "la extensión no quedó activa"
if grep -F "[$NAME]" "$LOG" | grep -qiE 'error|warn|No se pudo'; then
    fail "hay errores o avisos de la extensión"
fi
if grep -E 'JS ERROR|JS WARNING' "$LOG" | grep -q "$UUID"; then
    fail "GNOME Shell informó de un error en el código de la extensión"
fi
grep -q 'PROBE ERROR' "$LOG" && fail "la sonda falló"

# Comprobaciones de la Fase 1
DOCK_W="$(grep -oP 'PROBE \[inicio\] dock-area x=\S+ y=\S+ w=\K[0-9.]+' "$LOG" || true)"
WA_X="$(grep -oP 'PROBE \[inicio\] workarea x=\K[0-9]+' "$LOG" || true)"
if [[ -z "$DOCK_W" ]]; then
    fail "no se encontró el dock en pantalla"
elif [[ "$WA_X" != "${DOCK_W%.*}" ]]; then
    fail "el área de trabajo empieza en x=$WA_X, se esperaba x=${DOCK_W%.*} (ancho del dock)"
fi
while read -r WIN_X; do
    [[ "$WIN_X" -ge "${DOCK_W%.*}" ]] || fail "una ventana maximizada empieza en x=$WIN_X, debajo del dock"
done < <(grep -oP 'PROBE window .* maximized=true frame x=\K-?[0-9]+' "$LOG" || true)
grep -q 'PROBE \[inicio\] dash-nativo visible=false' "$LOG" || fail "el dash nativo no se ocultó"
grep -q 'Dash nativo restaurado' "$LOG" || fail "el dash nativo no se restauró al desactivar"
if grep -q 'PROBE click .* windows=0' "$LOG"; then
    fail "el clic en un icono no abrió la aplicación"
fi

if [[ -n "$SHOTS_DIR" ]]; then
    mkdir -p "$SHOTS_DIR"
    cp "$WORK"/run/probe-*.png "$SHOTS_DIR"/ 2>/dev/null || true
    cp "$LOG" "$SHOTS_DIR/headless.log"
    echo "Capturas y registro en $SHOTS_DIR"
fi

[[ $FAIL -eq 0 ]] && echo "OK: $CYCLES ciclos sin errores, espacio reservado correcto"
exit $FAIL

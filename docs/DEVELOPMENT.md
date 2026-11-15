# Desarrollo y pruebas

## Requisitos

- GNOME Shell 50 en Wayland.
- `glib-compile-schemas` y `gnome-extensions` (vienen con GNOME).
- `mutter-devkit` **de la misma versión que `mutter`**, para la sesión anidada:

```bash
rpm -q mutter                                    # p. ej. mutter-50.0-1.fc44
sudo dnf install mutter-devkit-50.0-1.fc44       # misma versión y release
```

Si `mutter` se actualiza, actualiza también `mutter-devkit` a la misma versión.

## Instalación en modo desarrollo

```bash
tools/install-dev.sh
```

Compila el esquema y crea el enlace:

```text
~/.local/share/gnome-shell/extensions/bahia-dock@bahia-dock.github.io -> ~/Proyectos/bahia-dock
```

## Prueba automática (sin pantalla)

```bash
tools/headless-test.sh        # 5 ciclos de activar y desactivar
tools/headless-test.sh 20     # 20 ciclos
```

Arranca un GNOME Shell sin pantalla en un entorno aislado, con sus propios ajustes y bus D-Bus, así que no toca la sesión real. No necesita `mutter-devkit`. Termina con `OK` y código 0 si la extensión queda activa y no registra errores. Pásala antes de cada commit.

No sustituye a la sesión anidada: no se puede ver el dock ni interactuar con él.

## Sesión anidada

En Wayland no se puede reiniciar GNOME Shell sin cerrar la sesión. Para probar cambios se abre un GNOME Shell completo dentro de una ventana:

```bash
tools/nested-session.sh            # 1600x900
tools/nested-session.sh 1280x800   # otro tamaño
```

- Los mensajes de la extensión aparecen en la misma terminal.
- Cerrar la ventana termina la sesión anidada. Para probar un cambio, se cierra y se vuelve a abrir.
- La sesión anidada comparte los ajustes (dconf) con la real: si activas o configuras algo dentro, también queda así fuera.

## Comandos útiles

```bash
# Activar, desactivar y ver estado
gnome-extensions enable  bahia-dock@bahia-dock.github.io
gnome-extensions disable bahia-dock@bahia-dock.github.io
gnome-extensions info    bahia-dock@bahia-dock.github.io

# Preferencias
gnome-extensions prefs bahia-dock@bahia-dock.github.io

# Registro de la sesión real
journalctl -f -o cat /usr/bin/gnome-shell | grep -i 'bahía dock'

# Registro de depuración
gsettings --schemadir schemas set org.gnome.shell.extensions.bahia-dock debug-logging true

# Inspector de Shell (Looking Glass): Alt+F2 y escribir lg
```

## Lista de comprobación por fase

Antes de dar una fase por terminada, en la sesión anidada:

1. Activar y desactivar la extensión al menos cinco veces seguidas.
2. Bloquear y desbloquear la pantalla.
3. Abrir y cerrar la vista general.
4. Poner una ventana en pantalla completa y salir.
5. Maximizar una ventana y comprobar que no queda debajo del dock (desde la Fase 1).
6. Revisar que no haya errores ni avisos con `[Bahía Dock]` en el registro.

## Empaquetado

```bash
tools/pack.sh
```

Genera `dist/bahia-dock@bahia-dock.github.io.shell-extension.zip`, instalable con:

```bash
gnome-extensions install --force dist/bahia-dock@bahia-dock.github.io.shell-extension.zip
```

## Estilo de código

- ES Modules, 4 espacios de sangría, comillas simples.
- Comentarios y documentación en español.
- Cabecera con `SPDX-License-Identifier: GPL-2.0-or-later` en cada archivo.
- Métodos privados con prefijo `_`.

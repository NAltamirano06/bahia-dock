# Bahía Dock

Dock vertical para GNOME Shell, situado en el borde izquierdo del escritorio. Muestra las aplicaciones favoritas y las abiertas, y reserva su propio espacio para que las ventanas maximizadas no queden debajo.

> **Estado:** en desarrollo, Fase 5. El dock muestra las favoritas y las apps abiertas, con indicadores de ventanas y de foco. Tiene menú contextual, etiqueta con el nombre de cada app, arrastre para ordenar y fijar favoritas, y minimiza la app con el foco al hacer clic. Sigue el modo claro u oscuro del sistema, agranda los iconos al pasar el puntero y puede estar siempre visible (reservando su espacio), ocultarse automáticamente u ocultarse solo cuando una ventana lo tapa. Estas opciones se cambian con clic derecho en el botón de la cuadrícula o en una zona vacía del dock, o en la ventana de preferencias. Las preferencias (Apariencia, Comportamiento y Monitores) permiten ajustar el tamaño de los iconos, el fondo, el ocultado y el monitor, y se aplican al momento.

## Compatibilidad

| Componente | Versión |
|---|---|
| GNOME Shell | 50 |
| Sesión | Wayland |
| Probado en | Fedora 44 |

## Instalación para desarrollo

```bash
git clone <url-del-repositorio> ~/Proyectos/bahia-dock
cd ~/Proyectos/bahia-dock
tools/install-dev.sh
```

En Wayland, GNOME Shell solo detecta extensiones nuevas al iniciar sesión. Para probar sin cerrar la sesión, usa la sesión anidada descrita en [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

Después de iniciar sesión de nuevo:

```bash
gnome-extensions enable bahia-dock@bahia-dock.github.io
```

## Estructura

```text
bahia-dock/
├── metadata.json      Identidad de la extensión
├── extension.js       Punto de entrada: activa y desactiva módulos
├── prefs.js           Ventana de preferencias
├── prefs/             Páginas de preferencias
├── stylesheet.css     Estilos (clases con prefijo bahia-)
├── schemas/           Ajustes de GSettings
├── core/              Infraestructura común a todos los módulos
├── features/          Un subdirectorio por funcionalidad
├── tools/             Scripts de desarrollo
└── docs/              Arquitectura, desarrollo y compatibilidad
```

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md)
- [Desarrollo y pruebas](docs/DEVELOPMENT.md)
- [Compatibilidad y APIs internas](docs/COMPATIBILITY.md)
- [Cambios](CHANGELOG.md)

## Licencia

GPL-2.0-or-later. Ver [LICENSE](LICENSE).

/* features/dock/dockVisibility.js
 *
 * Cuándo se ve el dock, según la clave dock-visibility:
 *
 *   always       siempre visible y reserva su espacio (comportamiento de
 *                las fases anteriores).
 *   autohide     no reserva espacio; se esconde hacia la izquierda y
 *                aparece encima de las ventanas al llevar el puntero al
 *                borde izquierdo.
 *   intellihide  no reserva espacio; se esconde solo cuando una ventana
 *                del escritorio actual ocupa su sitio. El borde también
 *                lo hace aparecer.
 *
 * Con autohide e intellihide nunca se esconde mientras el puntero está
 * encima, hay un menú abierto, se arrastra un icono o se ve la vista
 * general.
 *
 * El borde es una franja reactiva de EDGE_WIDTH píxeles lógicos pegada
 * al borde izquierdo, solo presente en esos dos modos.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const EDGE_WIDTH = 1;
const SHOW_TIME = 200;
const HIDE_TIME = 250;
// Espera antes de esconder, para que no desaparezca al rozar el borde
// de la píldora.
const HIDE_DELAY = 500;

// Ventanas que cuentan para intellihide.
const OVERLAP_TYPES = [
    Meta.WindowType.NORMAL,
    Meta.WindowType.DIALOG,
    Meta.WindowType.MODAL_DIALOG,
    Meta.WindowType.UTILITY,
    Meta.WindowType.TOOLBAR,
];

export const VISIBILITY_MODES = ['always', 'autohide', 'intellihide'];

export class DockVisibility {
    /**
     * @param {DockLayout} layout - área y monitor del dock
     * @param {DockView} view - la píldora
     * @param {Gio.Settings} settings - ajustes de la extensión
     * @param {Lifecycle} lifecycle - registro de señales del módulo
     */
    constructor(layout, view, settings, lifecycle) {
        this._layout = layout;
        this._view = view;
        this._settings = settings;
        this._mode = 'always';
        this._shown = true;
        this._overlap = false;
        this._hideId = 0;
        this._checkId = 0;
        this._edge = null;
        this._windowSignals = new Map();

        lifecycle.connect(settings, 'changed::dock-visibility', () => this._syncMode());
        lifecycle.connect(view, 'notify::hover', () => this._sync());
        lifecycle.connect(view, 'interaction-changed', () => this._sync());
        lifecycle.connect(Main.overview, 'showing', () => this._sync());
        lifecycle.connect(Main.overview, 'hidden', () => this._sync());
        lifecycle.connect(Main.layoutManager, 'monitors-changed', () => {
            this._placeEdge();
            this._queueOverlapCheck();
        });

        // Ventanas, para intellihide.
        lifecycle.connect(global.display, 'window-created',
            (_display, win) => this._trackWindow(win));
        lifecycle.connect(global.display, 'restacked', () => this._queueOverlapCheck());
        lifecycle.connect(global.workspace_manager, 'active-workspace-changed',
            () => this._queueOverlapCheck());
        for (const actor of global.get_window_actors())
            this._trackWindow(actor.meta_window);

        this._syncMode();
    }

    /** Modo actual: always, autohide o intellihide. */
    get mode() {
        return this._mode;
    }

    /** Si la píldora está a la vista (o apareciendo). */
    get shown() {
        return this._shown;
    }

    /** Si una ventana ocupa el sitio del dock (solo se calcula en intellihide). */
    get overlap() {
        return this._overlap;
    }

    /** La franja del borde, o null (para la prueba automática). */
    get edge() {
        return this._edge;
    }

    _syncMode() {
        let mode = this._settings.get_string('dock-visibility');
        if (!VISIBILITY_MODES.includes(mode))
            mode = 'always';
        this._mode = mode;

        this._layout.setAffectsStruts(mode === 'always');
        if (mode === 'always')
            this._destroyEdge();
        else
            this._createEdge();

        this._overlap = false;
        this._queueOverlapCheck();
        this._sync();
    }

    // ── Borde ──────────────────────────────────────────────────────

    _createEdge() {
        if (this._edge)
            return;

        this._edge = new St.Widget({
            name: 'bahiaDockEdge',
            reactive: true,
            track_hover: true,
        });
        this._edge.connect('notify::hover', () => this._sync());
        Main.layoutManager.addChrome(this._edge, {trackFullscreen: true});
        this._placeEdge();
    }

    _placeEdge() {
        const monitor = this._layout.monitor;
        if (!this._edge || !monitor)
            return;

        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        this._edge.set_position(monitor.x, monitor.y);
        this._edge.set_size(EDGE_WIDTH * scale, monitor.height);
    }

    _destroyEdge() {
        // Destruir el actor también lo retira de layoutManager.
        this._edge?.destroy();
        this._edge = null;
    }

    // ── Mostrar y esconder ─────────────────────────────────────────

    /** Si algo obliga a mantener el dock a la vista. */
    _mustShow() {
        return this._mode === 'always' ||
            this._view.hover ||
            this._edge?.hover ||
            this._view.menuOpen ||
            this._view.dragging ||
            Main.overview.visible ||
            (this._mode === 'intellihide' && !this._overlap);
    }

    _sync() {
        if (this._mustShow()) {
            this._clearHide();
            this._show();
        } else if (this._shown && !this._hideId) {
            this._hideId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, HIDE_DELAY, () => {
                this._hideId = 0;
                if (!this._mustShow())
                    this._hide();
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _show() {
        if (this._shown)
            return;

        this._shown = true;
        this._view.ease({
            translation_x: 0,
            opacity: 255,
            duration: SHOW_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    _hide() {
        if (!this._shown)
            return;

        this._shown = false;
        // Fuera de la pantalla por la izquierda: el ancho de la píldora
        // más su margen con el borde. También se desvanece, para que su
        // sombra no asome por el borde.
        this._view.ease({
            translation_x: -(this._view.x + this._view.width),
            opacity: 0,
            duration: HIDE_TIME,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
        });
    }

    _clearHide() {
        if (this._hideId) {
            GLib.source_remove(this._hideId);
            this._hideId = 0;
        }
    }

    // ── Ventanas encima del dock (intellihide) ─────────────────────

    /**
     * @param {Meta.Window} win - ventana que se vigila
     */
    _trackWindow(win) {
        if (!win || this._windowSignals.has(win))
            return;

        const ids = [
            win.connect('position-changed', () => this._queueOverlapCheck()),
            win.connect('size-changed', () => this._queueOverlapCheck()),
            win.connect('notify::minimized', () => this._queueOverlapCheck()),
            win.connect('workspace-changed', () => this._queueOverlapCheck()),
            win.connect('unmanaged', () => {
                this._untrackWindow(win);
                this._queueOverlapCheck();
            }),
        ];
        this._windowSignals.set(win, ids);
        this._queueOverlapCheck();
    }

    /**
     * @param {Meta.Window} win - ventana que se deja de vigilar
     */
    _untrackWindow(win) {
        const ids = this._windowSignals.get(win);
        if (!ids)
            return;

        for (const id of ids)
            win.disconnect(id);
        this._windowSignals.delete(win);
    }

    _queueOverlapCheck() {
        if (this._mode !== 'intellihide' || this._checkId)
            return;

        // Se agrupan las señales de un mismo instante (mover una
        // ventana emite muchas).
        this._checkId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._checkId = 0;
            this._checkOverlap();
            return GLib.SOURCE_REMOVE;
        });
    }

    /** Rectángulo de la píldora a la vista, en coordenadas del escenario. */
    _dockRect() {
        const [areaX, areaY] = this._layout.area.get_transformed_position();
        return {
            x: areaX,
            y: areaY + this._view.y,
            width: this._layout.area.width,
            height: this._view.height,
        };
    }

    _checkOverlap() {
        if (this._mode !== 'intellihide')
            return;

        const dock = this._dockRect();
        const workspace = global.workspace_manager.get_active_workspace();
        const monitor = this._layout.monitor;

        const overlap = workspace.list_windows().some(win => {
            if (win.minimized || !win.showing_on_its_workspace() ||
                !OVERLAP_TYPES.includes(win.get_window_type()) ||
                (monitor && win.get_monitor() !== monitor.index))
                return false;

            const r = win.get_frame_rect();
            return r.x < dock.x + dock.width && r.x + r.width > dock.x &&
                r.y < dock.y + dock.height && r.y + r.height > dock.y;
        });

        if (overlap === this._overlap)
            return;

        this._overlap = overlap;
        this._sync();
    }

    destroy() {
        this._clearHide();
        if (this._checkId) {
            GLib.source_remove(this._checkId);
            this._checkId = 0;
        }
        for (const win of [...this._windowSignals.keys()])
            this._untrackWindow(win);

        this._destroyEdge();
        this._view.remove_all_transitions();
        this._view.translation_x = 0;
        this._view.opacity = 255;
        this._layout = null;
        this._view = null;
        this._settings = null;
    }
}

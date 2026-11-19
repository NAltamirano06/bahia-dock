/* features/dock/dockItem.js
 *
 * Un icono del dock: el icono de la aplicación, los indicadores de
 * ventanas abiertas, los clics, el menú contextual y el arrastre.
 *
 * Indicadores: un punto por ventana (máximo MAX_DOTS) en el lado
 * izquierdo del icono, el que mira al borde de la pantalla. Se dibujan
 * superpuestos y desplazados hacia el padding, así no cambian el tamaño
 * del botón ni el ancho del dock (y por tanto tampoco el espacio
 * reservado).
 *
 * Clic (botón izquierdo):
 *   - app cerrada: la abre;
 *   - app abierta sin el foco: trae al frente su ventana más reciente;
 *     si todas sus ventanas de este escritorio están minimizadas, las
 *     restaura todas;
 *   - app con el foco: minimiza sus ventanas de este escritorio (si la
 *     clave dock-minimize-on-click está activada).
 * Ctrl+clic o clic central: ventana nueva, como en el dash nativo.
 * Clic derecho, pulsación larga o tecla Menú: menú contextual.
 *
 * Arrastre: el icono es arrastrable con DND de GNOME Shell. DockView
 * hace de destino y decide dónde se suelta.
 *
 * Magnificación (Fase 4): setMagnification() agranda el icono desde su
 * centro con una transformación. El hueco del icono ya es tan ancho
 * como el icono a tamaño máximo (setMagnificationRoom), así que crece
 * dentro de la píldora sin cambiar su ancho ni el espacio reservado. En
 * vertical el botón gana la altura extra para que los vecinos se
 * aparten.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {DockMenu} from './dockMenu.js';

export const MAX_DOTS = 3;

// Mismo umbral que los iconos de la cuadrícula: un clic rápido no
// inicia un arrastre.
const DRAG_TIMEOUT_THRESHOLD = 200;

// Opacidad del icono en su sitio mientras se arrastra su copia (St no
// admite opacity en CSS).
const DRAGGING_OPACITY = 100;

export const DockItem = GObject.registerClass({
    Signals: {
        'menu-state-changed': {param_types: [GObject.TYPE_BOOLEAN]},
        'drag-state-changed': {param_types: [GObject.TYPE_BOOLEAN]},
    },
}, class BahiaDockItem extends St.Button {
    /**
     * @param {Shell.App} app - aplicación que representa
     * @param {number} iconSize - tamaño lógico del icono en píxeles
     * @param {Gio.Settings} settings - ajustes de la extensión
     */
    _init(app, iconSize, settings) {
        super._init({
            style_class: 'bahia-dock-item',
            reactive: true,
            can_focus: true,
            track_hover: true,
            button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO,
            accessible_name: app.get_name(),
        });

        this.app = app;
        this._settings = settings;
        this._iconSize = 0;
        this._focused = false;
        this._dragging = false;
        this._magnification = 1;
        this._room = 1;

        // DND busca el origen y los destinos a través de _delegate.
        this._delegate = this;

        // Icono e indicadores comparten una caja con BinLayout para
        // superponerse.
        this._content = new St.Widget({layout_manager: new Clutter.BinLayout()});
        this.set_child(this._content);

        // Centrado en su hueco; la magnificación crece desde el centro.
        this._iconBin = new St.Bin({
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
            pivot_point: new Graphene.Point({x: 0.5, y: 0.5}),
        });
        this._content.add_child(this._iconBin);

        this._dots = new St.BoxLayout({
            style_class: 'bahia-dock-indicators',
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._dots.connect('style-changed', () => this._updateDotsOffset());
        this._content.add_child(this._dots);

        this.setIconSize(iconSize);

        // connectObject desconecta solo al destruir el botón.
        this.app.connectObject(
            'windows-changed', () => this._updateIndicators(),
            'notify::state', () => this._updateIndicators(),
            this);
        this._updateIndicators();

        this._menu = new DockMenu(this, isOpen => this._onMenuStateChanged(isOpen));
        this._setupGestures();
        this._setupDrag();

        this.connect('destroy', () => this._onDestroy());
    }

    /** Número de puntos visibles (0 si la app está cerrada). */
    get dotCount() {
        return this._dots.get_n_children();
    }

    /** Si la app tiene la ventana con el foco. */
    get focused() {
        return this._focused;
    }

    /** Si el menú contextual está abierto. */
    get menuOpen() {
        return this._menu?.isOpen ?? false;
    }

    /** Si el icono se está arrastrando. */
    get dragging() {
        return this._dragging;
    }

    /**
     * @param {number} iconSize - tamaño lógico del icono en píxeles
     */
    setIconSize(iconSize) {
        if (iconSize === this._iconSize)
            return;

        this._iconSize = iconSize;
        this._iconBin.set_child(this.app.create_icon_texture(iconSize));
        this._updateContentSize();
    }

    /**
     * @param {boolean} focused - si la app tiene el foco
     */
    setFocused(focused) {
        if (focused === this._focused)
            return;

        this._focused = focused;
        if (focused)
            this.add_style_class_name('bahia-dock-item-focused');
        else
            this.remove_style_class_name('bahia-dock-item-focused');
    }

    /** Escala actual del icono (1 = sin magnificar). */
    get magnification() {
        return this._magnification;
    }

    /** Borde derecho del icono en el escenario, con la magnificación. */
    get iconRightEdge() {
        const [x] = this._iconBin.get_transformed_position();
        const [width] = this._iconBin.get_transformed_size();
        return x + width;
    }

    /**
     * Agranda el icono desde su centro. El botón gana la altura extra
     * para que los vecinos se aparten; el ancho no cambia.
     *
     * @param {number} scale - 1 = tamaño normal
     */
    setMagnification(scale) {
        if (scale === this._magnification)
            return;

        this._magnification = scale;
        this._iconBin.set_scale(scale, scale);
        this._updateContentSize();
    }

    /**
     * Reserva el ancho del icono a tamaño máximo, para que al
     * magnificarse no se salga de la píldora.
     *
     * @param {number} room - escala máxima (1 = sin magnificación)
     */
    setMagnificationRoom(room) {
        if (room === this._room)
            return;

        this._room = room;
        this._updateContentSize();
    }

    _updateContentSize() {
        const themeScale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const iconPx = this._iconSize * themeScale;
        this._content.width = this._room > 1 ? Math.ceil(iconPx * this._room) : -1;
        this._content.height = this._magnification !== 1
            ? Math.round(iconPx * this._magnification) : -1;
    }

    /** Abre el menú contextual. */
    popupMenu() {
        if (this._dragging)
            return;

        this._menu.open();
    }

    // ── Indicadores ────────────────────────────────────────────────

    /** Ventanas que cuentan para los indicadores. */
    _windowCount() {
        return this.app.get_windows().filter(w => !w.skip_taskbar).length;
    }

    _updateIndicators() {
        let count = 0;
        if (this.app.state !== Shell.AppState.STOPPED)
            count = Math.max(1, Math.min(MAX_DOTS, this._windowCount()));

        const current = this._dots.get_n_children();
        for (let i = current; i < count; i++)
            this._dots.add_child(new St.Widget({style_class: 'bahia-dock-dot'}));
        for (let i = current; i > count; i--)
            this._dots.get_last_child().destroy();

        if (count > 0)
            this.add_style_class_name('bahia-dock-item-running');
        else
            this.remove_style_class_name('bahia-dock-item-running');
    }

    _updateDotsOffset() {
        // offset-x (stylesheet.css) ya viene escalado por el factor de
        // escala; translation_x no altera el tamaño del botón.
        this._dots.translation_x = this._dots.get_theme_node().get_length('offset-x');
    }

    // ── Clics ──────────────────────────────────────────────────────

    vfunc_clicked(button) {
        // Igual que el dash nativo: Ctrl+clic o clic central abre una
        // ventana nueva si la aplicación ya está abierta.
        const event = Clutter.get_current_event();
        const modifiers = event ? event.get_state() : 0;
        const ctrl = (modifiers & Clutter.ModifierType.CONTROL_MASK) !== 0;
        const middle = button === Clutter.BUTTON_MIDDLE;
        const running = this.app.state === Shell.AppState.RUNNING;
        const newWindow = this.app.can_open_new_window() && running && (ctrl || middle);

        if (newWindow) {
            this.app.open_new_window(-1);
            Main.overview.hide();
            return;
        }

        // En la vista general un clic solo sale de ella hacia la app.
        const windows = running ? this._windowsOnWorkspace() : [];
        if (Main.overview.visible || windows.length === 0) {
            this.app.activate();
            Main.overview.hide();
            return;
        }

        // Restaurar va primero: al minimizar la última ventana, GNOME
        // puede dejar la app como focus_app aunque no se vea nada.
        if (windows.every(w => w.minimized))
            this._restoreWindows(windows);
        else if (this._shouldMinimize())
            this._minimizeWindows(windows);
        else
            this.app.activate();
    }

    /** Ventanas normales de la app en el escritorio activo, de la más reciente a la más antigua. */
    _windowsOnWorkspace() {
        const workspace = global.workspace_manager.get_active_workspace();
        return this.app.get_windows().filter(w =>
            !w.skip_taskbar && w.located_on_workspace(workspace));
    }

    _shouldMinimize() {
        return this._settings.get_boolean('dock-minimize-on-click') &&
            Shell.WindowTracker.get_default().focus_app === this.app;
    }

    /**
     * @param {Meta.Window[]} windows - ventanas que se minimizan
     */
    _minimizeWindows(windows) {
        for (const win of windows) {
            if (win.can_minimize())
                win.minimize();
        }
    }

    /**
     * Restaura las ventanas en orden inverso para que la más reciente
     * quede encima, y le da el foco.
     *
     * @param {Meta.Window[]} windows - ventanas minimizadas, la más reciente primero
     */
    _restoreWindows(windows) {
        for (const win of [...windows].reverse())
            win.unminimize();
        Main.activateWindow(windows[0]);
    }

    // ── Menú contextual ────────────────────────────────────────────

    _setupGestures() {
        // Igual que los iconos de la cuadrícula (appDisplay.js).
        const longPress = new Clutter.LongPressGesture();
        longPress.connect('recognize', () => this.popupMenu());
        this.add_action(longPress);

        const rightClick = new Clutter.ClickGesture({
            required_button: Clutter.BUTTON_SECONDARY,
            recognize_on_press: true,
        });
        rightClick.connect('recognize', () => this.popupMenu());
        this.add_action(rightClick);

        // Tecla Menú o Mayús+F10 con el icono enfocado.
        this.connect('popup-menu', () => {
            this.popupMenu();
            this._menu.focusFirstItem();
        });
    }

    /**
     * @param {boolean} isOpen - si el menú acaba de abrirse
     */
    _onMenuStateChanged(isOpen) {
        if (isOpen)
            this.add_style_class_name('bahia-dock-item-menu-open');
        else
            this.remove_style_class_name('bahia-dock-item-menu-open');
        this.emit('menu-state-changed', isOpen);
    }

    // ── Arrastre ───────────────────────────────────────────────────

    _setupDrag() {
        this._draggable = DND.makeDraggable(this, {
            timeoutThreshold: DRAG_TIMEOUT_THRESHOLD,
        });
        this._draggable.connectObject(
            'drag-begin', () => this._setDragging(true),
            'drag-cancelled', () => this._setDragging(false),
            'drag-end', () => this._setDragging(false),
            this);
    }

    /**
     * @param {boolean} dragging - si empieza o termina el arrastre
     */
    _setDragging(dragging) {
        if (dragging === this._dragging)
            return;

        this._dragging = dragging;
        if (dragging)
            this._menu.close();
        this.opacity = dragging ? DRAGGING_OPACITY : 255;
        this.emit('drag-state-changed', dragging);
    }

    /** Lo que se ve bajo el puntero al arrastrar: una copia del icono. */
    getDragActor() {
        return this.app.create_icon_texture(this._iconSize);
    }

    /** Actor al que vuelve la copia si se cancela el arrastre. */
    getDragActorSource() {
        return this._iconBin;
    }

    _onDestroy() {
        if (this._dragging)
            this._setDragging(false);
        this._menu.destroy();
        this._menu = null;
        this._draggable = null;
        this._settings = null;
    }
});

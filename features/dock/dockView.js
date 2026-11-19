/* features/dock/dockView.js
 *
 * Contenedor visual del dock: la "píldora" vertical con, de arriba
 * abajo:
 *
 *   favoritas
 *   separador + aplicaciones abiertas no favoritas (si hay alguna)
 *   separador + botón de la cuadrícula de aplicaciones (sustituye al
 *   que había en el dash nativo)
 *
 * Solo refleja el estado de AppModel; no decide qué aplicaciones hay.
 *
 * También es el destino de los arrastres (Fase 3). Acepta iconos del
 * propio dock y de la cuadrícula de aplicaciones:
 *
 *   - sobre la zona de favoritas aparece un hueco donde caerá el icono;
 *     al soltar, la app se mueve a esa posición o se fija como favorita;
 *   - fuera de esa zona no hay hueco y el icono vuelve a su sitio.
 *
 * Para quitar una favorita se usa el menú contextual.
 *
 * Menú de configuración (Fase 4): clic derecho o pulsación larga en el
 * botón de la cuadrícula, o clic derecho en una zona vacía de la
 * píldora (separadores, márgenes y huecos entre iconos). Ver
 * dockSettingsMenu.js.
 *
 * Tema (Fase 4): con el esquema claro del sistema se añade la clase
 * bahia-dock-light, que stylesheet.css usa para los colores claros.
 *
 * Señal "interaction-changed": se abrió o cerró un menú, o empezó o
 * terminó un arrastre. La usan la magnificación y el ocultado.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';
import * as Dash from 'resource:///org/gnome/shell/ui/dash.js';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {DockItem} from './dockItem.js';
import {DockLabel} from './dockLabel.js';
import {DockSettingsMenu} from './dockSettingsMenu.js';

export const MAX_ICON_SIZE = 48;
export const MIN_ICON_SIZE = 24;

const SHOW_APPS_LABEL = 'Mostrar aplicaciones';

/**
 * Aplicación que se arrastra, venga del dock o de la cuadrícula.
 *
 * @param {object} source - origen del arrastre (el _delegate del actor)
 * @returns {Shell.App|null}
 */
function appFromSource(source) {
    if (source instanceof DockItem)
        return source.app;
    return Dash.Dash.getAppFromSource(source);
}

export const DockView = GObject.registerClass({
    Signals: {'interaction-changed': {}},
}, class BahiaDockView extends St.BoxLayout {
    /**
     * @param {Gio.Settings} settings - ajustes de la extensión
     * @param {Function} openPreferences - abre la ventana de preferencias
     */
    _init(settings, openPreferences) {
        super._init({
            style_class: 'bahia-dock',
            orientation: Clutter.Orientation.VERTICAL,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            reactive: true,
            track_hover: true,
        });

        this._settings = settings;
        this._iconSize = MAX_ICON_SIZE;
        this._room = 1;
        this._items = new Map();
        this._focusApp = null;

        // Arrastre: DND busca los destinos a través de _delegate.
        this._delegate = this;
        this._dragMonitor = null;
        this._placeholder = null;
        this._placeholderPos = -1;

        this._favoritesBox = new St.BoxLayout({
            name: 'bahiaDockFavorites',
            style_class: 'bahia-dock-apps',
            orientation: Clutter.Orientation.VERTICAL,
        });
        this.add_child(this._favoritesBox);

        this._runningSeparator = new St.Widget({style_class: 'bahia-dock-separator'});
        this.add_child(this._runningSeparator);

        this._runningBox = new St.BoxLayout({
            name: 'bahiaDockRunning',
            style_class: 'bahia-dock-apps',
            orientation: Clutter.Orientation.VERTICAL,
        });
        this.add_child(this._runningBox);

        this._separator = new St.Widget({style_class: 'bahia-dock-separator'});
        this.add_child(this._separator);

        this._showAppsButton = new St.Button({
            style_class: 'bahia-dock-item bahia-dock-show-apps',
            reactive: true,
            can_focus: true,
            track_hover: true,
            accessible_name: SHOW_APPS_LABEL,
        });
        this._showAppsIcon = new St.Icon({
            icon_name: 'view-app-grid-symbolic',
            style_class: 'bahia-dock-show-apps-icon',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        // Caja del mismo tamaño que un icono de app, para alinear el botón.
        this._showAppsBin = new St.Bin({child: this._showAppsIcon});
        this._showAppsButton.set_child(this._showAppsBin);
        this._showAppsButton.connect('clicked', () => {
            if (Main.overview.visible && Main.overview.dash?.showAppsButton?.checked)
                Main.overview.hide();
            else
                Main.overview.showApps();
        });
        this.add_child(this._showAppsButton);

        this._label = new DockLabel(this);
        const syncShowAppsLabel = () => this._label?.sync(this._showAppsButton,
            this._showAppsButton.hover && !this._dragMonitor && !this._settingsMenu?.isOpen,
            SHOW_APPS_LABEL);
        this._showAppsButton.connect('notify::hover', syncShowAppsLabel);

        this._settingsMenu = new DockSettingsMenu(this._showAppsButton, settings,
            openPreferences, isOpen => {
                if (isOpen)
                    this._showAppsButton.add_style_class_name('bahia-dock-item-menu-open');
                else
                    this._showAppsButton.remove_style_class_name('bahia-dock-item-menu-open');
                syncShowAppsLabel();
                this.emit('interaction-changed');
            });
        this._setupSettingsMenuTriggers();

        // Arrastres que empiezan en la cuadrícula de aplicaciones.
        Main.overview.connectObject(
            'item-drag-begin', () => this._onDragBegin(),
            'item-drag-cancelled', () => this._onDragEnd(),
            'item-drag-end', () => this._onDragEnd(),
            this);

        // Modo claro u oscuro, igual que el tema de GNOME Shell.
        St.Settings.get().connectObject('notify::color-scheme',
            () => this._syncColorScheme(), this);
        this._syncColorScheme();

        this.connect('destroy', () => this._onDestroy());

        this._applyIconSize();
    }

    _syncColorScheme() {
        if (Main.getStyleVariant() === 'light')
            this.add_style_class_name('bahia-dock-light');
        else
            this.remove_style_class_name('bahia-dock-light');
    }

    /** Iconos de apps en orden: favoritas y después abiertas. */
    get dockItems() {
        return [
            ...this._favoritesBox.get_children(),
            ...this._runningBox.get_children(),
        ].filter(child => child instanceof DockItem);
    }

    /** Si hay un arrastre en curso sobre el dock o desde él. */
    get dragging() {
        return this._dragMonitor !== null;
    }

    /** Si hay algún menú abierto (de una app o de configuración). */
    get menuOpen() {
        return this._settingsMenu?.isOpen ||
            [...this._items.values()].some(item => item.menuOpen);
    }

    /** El menú de configuración (para la prueba automática). */
    get settingsMenu() {
        return this._settingsMenu;
    }

    /** Abre el menú de configuración. */
    openSettingsMenu() {
        if (!this._dragMonitor)
            this._settingsMenu.open();
    }

    _setupSettingsMenuTriggers() {
        const rightClick = new Clutter.ClickGesture({
            required_button: Clutter.BUTTON_SECONDARY,
            recognize_on_press: true,
        });
        rightClick.connect('recognize', () => this.openSettingsMenu());
        this._showAppsButton.add_action(rightClick);

        const longPress = new Clutter.LongPressGesture();
        longPress.connect('recognize', () => this.openSettingsMenu());
        this._showAppsButton.add_action(longPress);

        // Zonas vacías de la píldora: los separadores y las cajas no son
        // reactivos, así que el clic llega a la propia píldora. Los
        // clics sobre un icono tienen su propio menú.
        this.connect('button-press-event', (_actor, event) => {
            if (event.get_button() !== Clutter.BUTTON_SECONDARY ||
                global.stage.get_event_actor(event) !== this)
                return Clutter.EVENT_PROPAGATE;

            this.openSettingsMenu();
            return Clutter.EVENT_STOP;
        });
    }

    /** Número de botones que ocupan una fila (apps + cuadrícula). */
    get itemCount() {
        return this._items.size + 1;
    }

    /** Separadores visibles (cada uno ocupa una franja fija de altura). */
    get separatorCount() {
        return [this._runningSeparator, this._separator]
            .filter(s => s.visible).length;
    }

    get iconSize() {
        return this._iconSize;
    }

    /** Texto de la etiqueta visible, o null (para la prueba automática). */
    get labelText() {
        return this._label.visibleText;
    }

    /**
     * Sincroniza los iconos con las listas de aplicaciones, reutilizando
     * los que ya existen para no recrear texturas sin necesidad. Un icono
     * puede pasar de una sección a otra (por ejemplo, al quitar de
     * favoritas una app abierta) sin recrearse.
     *
     * @param {Shell.App[]} favorites - favoritas, en orden
     * @param {Shell.App[]} running - abiertas no favoritas, en orden
     */
    setApps(favorites, running) {
        const wanted = new Set([...favorites, ...running].map(app => app.get_id()));

        for (const [id, item] of this._items) {
            if (!wanted.has(id)) {
                item.destroy();
                this._items.delete(id);
            }
        }

        // El hueco del arrastre alteraría los índices.
        this._clearPlaceholder();
        this._syncBox(this._favoritesBox, favorites);
        this._syncBox(this._runningBox, running);

        this._runningSeparator.visible = favorites.length > 0 && running.length > 0;
        this._runningBox.visible = running.length > 0;
        this._separator.visible = this._items.size > 0;
        this._updateFocus();
    }

    /**
     * @param {Shell.App|null} app - aplicación con el foco
     */
    setFocusApp(app) {
        this._focusApp = app;
        this._updateFocus();
    }

    _updateFocus() {
        for (const item of this._items.values())
            item.setFocused(item.app === this._focusApp);
    }

    /**
     * @param {St.BoxLayout} box - sección que se sincroniza
     * @param {Shell.App[]} apps - aplicaciones que debe contener, en orden
     */
    _syncBox(box, apps) {
        apps.forEach((app, index) => {
            const id = app.get_id();
            let item = this._items.get(id);
            if (!item) {
                item = this._createItem(app);
                this._items.set(id, item);
                box.insert_child_at_index(item, index);
            } else if (item.get_parent() !== box) {
                item.get_parent().remove_child(item);
                box.insert_child_at_index(item, index);
            } else if (box.get_child_at_index(index) !== item) {
                box.set_child_at_index(item, index);
            }
        });
    }

    /**
     * @param {Shell.App} app - aplicación del icono nuevo
     * @returns {DockItem}
     */
    _createItem(app) {
        const item = new DockItem(app, this._iconSize, this._settings);
        item.setMagnificationRoom(this._room);
        const syncLabel = () => this._label.sync(item,
            item.hover && !item.menuOpen && !this._dragMonitor, app.get_name());
        item.connect('notify::hover', syncLabel);
        item.connect('menu-state-changed', () => {
            syncLabel();
            this.emit('interaction-changed');
        });
        item.connect('drag-state-changed', (_item, dragging) => {
            if (dragging)
                this._onDragBegin();
            else
                this._onDragEnd();
        });
        item.connect('destroy', () => this._label?.sync(item, false, ''));
        return item;
    }

    /**
     * @param {number} size - tamaño lógico de icono
     */
    setIconSize(size) {
        size = Math.max(MIN_ICON_SIZE, Math.min(MAX_ICON_SIZE, Math.floor(size)));
        if (size === this._iconSize)
            return;

        this._iconSize = size;
        this._applyIconSize();
    }

    /**
     * Ancho reservado para la magnificación: escala máxima, o 1 si está
     * desactivada. Cambia el ancho de la píldora y el espacio reservado.
     *
     * @param {number} room - escala máxima
     */
    setMagnificationRoom(room) {
        if (room === this._room)
            return;

        this._room = room;
        for (const item of this._items.values())
            item.setMagnificationRoom(room);
        this._applyIconSize();
    }

    _applyIconSize() {
        for (const item of this._items.values())
            item.setIconSize(this._iconSize);
        // El icono simbólico se ve mejor algo más pequeño que los de color.
        this._showAppsIcon.icon_size = Math.round(this._iconSize * 0.6);
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        // Mismo ancho que el hueco de los iconos, para que quede alineado.
        this._showAppsBin.set_size(Math.ceil(this._iconSize * scale * this._room),
            this._iconSize * scale);
    }

    // ── Arrastre ───────────────────────────────────────────────────

    _onDragBegin() {
        if (this._dragMonitor)
            return;

        this._label.hide();
        this._dragMonitor = {dragMotion: event => this._onDragMotion(event)};
        DND.addDragMonitor(this._dragMonitor);
        this.emit('interaction-changed');
    }

    _onDragEnd() {
        if (!this._dragMonitor)
            return;

        DND.removeDragMonitor(this._dragMonitor);
        this._dragMonitor = null;
        this._clearPlaceholder();
        this.emit('interaction-changed');
    }

    _onDragMotion(dragEvent) {
        // Fuera del dock no hay hueco.
        if (!this.contains(dragEvent.targetActor))
            this._clearPlaceholder();
        return DND.DragMotionResult.CONTINUE;
    }

    /** Si las favoritas se pueden cambiar (puede bloquearlas el administrador). */
    _canEditFavorites(app) {
        return app && !app.is_window_backed() &&
            global.settings.is_writable('favorite-apps');
    }

    /** Iconos de favoritas, sin el hueco. */
    _favoriteItems() {
        return this._favoritesBox.get_children()
            .filter(child => child !== this._placeholder);
    }

    /**
     * Límite inferior de la zona de favoritas, en coordenadas de la
     * píldora: la mitad del separador que viene después.
     */
    _favoritesZoneEnd() {
        const next = [this._runningSeparator, this._separator]
            .find(s => s.visible);
        if (next)
            return next.y + next.height / 2;
        return this._showAppsButton.y;
    }

    /**
     * Posición de inserción entre las favoritas para una altura dada:
     * cuántos iconos tienen su centro por encima del puntero.
     *
     * @param {number} y - coordenada vertical en la píldora
     * @returns {number}
     */
    _insertPosition(y) {
        const boxY = y - this._favoritesBox.y;
        return this._favoriteItems()
            .filter(item => (item.y + item.height / 2) < boxY).length;
    }

    handleDragOver(source, _actor, _x, y) {
        const app = appFromSource(source);
        if (!this._canEditFavorites(app) || y > this._favoritesZoneEnd()) {
            this._clearPlaceholder();
            return DND.DragMotionResult.NO_DROP;
        }

        const pos = this._insertPosition(y);
        const favorites = AppFavorites.getAppFavorites().getFavorites();
        const current = favorites.indexOf(app);

        // Soltar justo antes o después de sí misma no cambia nada.
        if (current !== -1 && (pos === current || pos === current + 1)) {
            this._clearPlaceholder();
            return DND.DragMotionResult.CONTINUE;
        }

        this._showPlaceholder(pos);
        return current === -1
            ? DND.DragMotionResult.COPY_DROP
            : DND.DragMotionResult.MOVE_DROP;
    }

    acceptDrop(source) {
        const app = appFromSource(source);
        if (!this._placeholder || !this._canEditFavorites(app))
            return false;

        // Índice de destino entre las favoritas, sin contar la propia app.
        const id = app.get_id();
        const pos = this._favoriteItems()
            .slice(0, this._placeholderPos)
            .filter(item => item.app.get_id() !== id).length;

        this._clearPlaceholder();

        // Como el dash nativo: el cambio se aplica antes del siguiente
        // repintado, cuando DND ya terminó con el icono arrastrado.
        const favorites = AppFavorites.getAppFavorites();
        const isFavorite = favorites.isFavorite(id);
        global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
            if (isFavorite)
                favorites.moveFavoriteToPos(id, pos);
            else
                favorites.addFavoriteAtPos(id, pos);
            return GLib.SOURCE_REMOVE;
        });
        return true;
    }

    /**
     * @param {number} pos - posición del hueco entre las favoritas
     */
    _showPlaceholder(pos) {
        if (this._placeholder && pos === this._placeholderPos)
            return;

        if (!this._placeholder) {
            const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
            this._placeholder = new St.Widget({
                style_class: 'bahia-dock-placeholder',
                width: this._iconSize * scale,
                height: this._iconSize * scale / 2,
                x_align: Clutter.ActorAlign.CENTER,
            });
            this._favoritesBox.insert_child_at_index(this._placeholder, pos);
        } else {
            this._favoritesBox.set_child_at_index(this._placeholder, pos);
        }
        this._placeholderPos = pos;
    }

    _clearPlaceholder() {
        this._placeholder?.destroy();
        this._placeholder = null;
        this._placeholderPos = -1;
    }

    _onDestroy() {
        this._onDragEnd();
        this._settingsMenu.destroy();
        this._settingsMenu = null;
        this._label.destroy();
        this._label = null;
        this._settings = null;
    }
});

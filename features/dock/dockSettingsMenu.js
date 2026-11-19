/* features/dock/dockSettingsMenu.js
 *
 * Menú de configuración del dock, como el de la línea separadora del
 * Dock de macOS. Se abre con clic derecho (o pulsación larga) en el
 * botón de la cuadrícula, o con clic derecho en una zona vacía de la
 * píldora:
 *
 *   Visibilidad
 *     • Siempre visible
 *     • Ocultar automáticamente
 *     • Ocultar si una ventana lo tapa
 *   ─────
 *   Magnificación          [interruptor]
 *   Minimizar al hacer clic [interruptor]
 *   ─────
 *   Preferencias del dock…
 *
 * Si el botón de la cuadrícula está oculto (dock-show-apps-button),
 * DockView crea el menú anclado a la píldora.
 *
 * Cambia las mismas claves de GSettings que la ventana de preferencias,
 * así que ambas se mantienen sincronizadas.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import St from 'gi://St';

import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

// Mismo orden y textos que la ventana de preferencias (prefs.js).
const VISIBILITY = [
    ['always', 'Siempre visible'],
    ['autohide', 'Ocultar automáticamente'],
    ['intellihide', 'Ocultar si una ventana lo tapa'],
];

export class DockSettingsMenu {
    /**
     * @param {Clutter.Actor} source - actor al que apunta la flecha
     * @param {Gio.Settings} settings - ajustes de la extensión
     * @param {Function} openPreferences - abre la ventana de preferencias
     * @param {Function} onStateChanged - recibe true al abrir y false al cerrar
     */
    constructor(source, settings, openPreferences, onStateChanged) {
        this._settings = settings;

        // St.Side.LEFT: el menú queda a la derecha del dock.
        this._menu = new PopupMenu.PopupMenu(source, 0.5, St.Side.LEFT);
        this._menu.actor.add_style_class_name('bahia-dock-settings-menu');
        this._menu.connect('open-state-changed',
            (_menu, isOpen) => onStateChanged(isOpen));

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Visibilidad'));
        this._modeItems = new Map();
        for (const [id, label] of VISIBILITY) {
            const item = this._menu.addAction(label,
                () => settings.set_string('dock-visibility', id));
            this._modeItems.set(id, item);
        }

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._magnification = this._addSwitch('Magnificación', 'dock-magnification');
        this._minimize = this._addSwitch('Minimizar al hacer clic', 'dock-minimize-on-click');

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._menu.addAction('Preferencias del dock…', () => openPreferences());

        settings.connectObject(
            'changed::dock-visibility', () => this._sync(),
            'changed::dock-magnification', () => this._sync(),
            'changed::dock-minimize-on-click', () => this._sync(),
            this._menu.actor);
        Main.overview.connectObject('hiding', () => this.close(), this._menu.actor);

        Main.uiGroup.add_child(this._menu.actor);
        this._menu.actor.hide();
        this._manager = new PopupMenu.PopupMenuManager(source);
        this._manager.addMenu(this._menu);

        this._sync();
    }

    get isOpen() {
        return this._menu?.isOpen ?? false;
    }

    /** Modo marcado en el menú (para la prueba automática). */
    get selectedMode() {
        for (const [id, item] of this._modeItems) {
            if (item._ornament === PopupMenu.Ornament.DOT)
                return id;
        }
        return null;
    }

    /**
     * Elige un modo como si se pulsara su opción (para la prueba
     * automática).
     *
     * @param {string} mode - always, autohide o intellihide
     */
    activateMode(mode) {
        this._modeItems.get(mode)?.activate(null);
    }

    open() {
        this._menu.open(BoxPointer.PopupAnimation.FULL);
    }

    close() {
        this._menu?.close();
    }

    /**
     * @param {string} label - texto de la opción
     * @param {string} key - clave booleana de GSettings
     * @returns {PopupMenu.PopupSwitchMenuItem}
     */
    _addSwitch(label, key) {
        const item = new PopupMenu.PopupSwitchMenuItem(label, this._settings.get_boolean(key));
        item.connect('toggled', (_item, state) => this._settings.set_boolean(key, state));
        this._menu.addMenuItem(item);
        return item;
    }

    _sync() {
        const mode = this._settings.get_string('dock-visibility');
        for (const [id, item] of this._modeItems)
            item.setOrnament(id === mode ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NO_DOT);

        this._magnification.setToggleState(this._settings.get_boolean('dock-magnification'));
        this._minimize.setToggleState(this._settings.get_boolean('dock-minimize-on-click'));
    }

    destroy() {
        // PopupMenu.destroy() destruye su actor; las conexiones hechas
        // con connectObject(..., this._menu.actor) se van con él.
        this._menu?.destroy();
        this._menu = null;
        this._manager = null;
        this._settings = null;
    }
}

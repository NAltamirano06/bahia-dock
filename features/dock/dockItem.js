/* features/dock/dockItem.js
 *
 * Un icono del dock: el icono de la aplicación, los indicadores de
 * ventanas abiertas y el clic para abrir o enfocar.
 *
 * Indicadores: un punto por ventana (máximo MAX_DOTS) en el lado
 * izquierdo del icono, el que mira al borde de la pantalla. Se dibujan
 * superpuestos y desplazados hacia el padding, así no cambian el tamaño
 * del botón ni el ancho del dock (y por tanto tampoco el espacio
 * reservado).
 *
 * El menú, los tooltips y el arrastre llegan en la Fase 3.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export const MAX_DOTS = 3;

export const DockItem = GObject.registerClass(
class BahiaDockItem extends St.Button {
    /**
     * @param {Shell.App} app - aplicación que representa
     * @param {number} iconSize - tamaño lógico del icono en píxeles
     */
    _init(app, iconSize) {
        super._init({
            style_class: 'bahia-dock-item',
            reactive: true,
            can_focus: true,
            track_hover: true,
            button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO,
            accessible_name: app.get_name(),
        });

        this.app = app;
        this._iconSize = 0;
        this._focused = false;

        // Icono e indicadores comparten una caja con BinLayout para
        // superponerse.
        this._content = new St.Widget({layout_manager: new Clutter.BinLayout()});
        this.set_child(this._content);

        this._iconBin = new St.Bin();
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
    }

    /** Número de puntos visibles (0 si la app está cerrada). */
    get dotCount() {
        return this._dots.get_n_children();
    }

    /** Si la app tiene la ventana con el foco. */
    get focused() {
        return this._focused;
    }

    /**
     * @param {number} iconSize - tamaño lógico del icono en píxeles
     */
    setIconSize(iconSize) {
        if (iconSize === this._iconSize)
            return;

        this._iconSize = iconSize;
        this._iconBin.set_child(this.app.create_icon_texture(iconSize));
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

    vfunc_clicked(button) {
        // Igual que el dash nativo: Ctrl+clic o clic central abre una
        // ventana nueva si la aplicación ya está abierta. Un clic normal
        // en una app abierta trae al frente su ventana más reciente.
        const event = Clutter.get_current_event();
        const modifiers = event ? event.get_state() : 0;
        const ctrl = (modifiers & Clutter.ModifierType.CONTROL_MASK) !== 0;
        const middle = button === Clutter.BUTTON_MIDDLE;
        const newWindow = this.app.can_open_new_window() &&
            this.app.state === Shell.AppState.RUNNING &&
            (ctrl || middle);

        if (newWindow)
            this.app.open_new_window(-1);
        else
            this.app.activate();

        Main.overview.hide();
    }
});

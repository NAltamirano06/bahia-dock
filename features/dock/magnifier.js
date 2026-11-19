/* features/dock/magnifier.js
 *
 * Magnificación de iconos al pasar el puntero, como en el Dock de macOS:
 * el icono bajo el puntero crece hasta dock-magnification-scale y los
 * vecinos crecen menos cuanto más lejos están (curva coseno con un radio
 * de RANGE_SLOTS iconos).
 *
 * Las distancias se miden respecto a las posiciones en reposo de los
 * iconos, guardadas al entrar el puntero. Si se midieran respecto a las
 * posiciones ya magnificadas, cada movimiento cambiaría la referencia y
 * los iconos temblarían.
 *
 * Los iconos crecen desde su centro con una transformación
 * (DockItem.setMagnification). La píldora ya es tan ancha como el icono
 * a tamaño máximo (setMagnificationRoom), así que al magnificar solo
 * gana altura: el ancho del área, y con él el espacio reservado, no
 * cambia. Solo cambia al activar o desactivar la magnificación o al
 * cambiar su tamaño máximo.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Clutter from 'gi://Clutter';
import St from 'gi://St';

// Radio de influencia, en iconos.
const RANGE_SLOTS = 2.5;
const GROW_TIME = 120;
const SHRINK_TIME = 200;
// Margen que se deja libre arriba y abajo al crecer la píldora.
const SCREEN_MARGIN = 8;

export class Magnifier {
    /**
     * @param {DockView} view - la píldora
     * @param {Gio.Settings} settings - ajustes de la extensión
     * @param {Lifecycle} lifecycle - registro de señales del módulo
     */
    constructor(view, settings, lifecycle) {
        this._view = view;
        this._settings = settings;
        this._rest = null;
        this._pointerY = 0;

        // 0 = sin magnificar, 1 = magnificación completa. Se anima para
        // entrar y salir con suavidad.
        this._amount = new St.Adjustment({actor: view, lower: 0, upper: 1, value: 0});
        this._amount.connect('notify::value', () => this._apply());

        lifecycle.connect(view, 'motion-event', (_actor, event) => {
            const [, y] = event.get_coords();
            this.magnifyAt(y);
            return Clutter.EVENT_PROPAGATE;
        });
        lifecycle.connect(view, 'notify::hover', () => {
            if (!view.hover)
                this.release();
        });
        lifecycle.connect(view, 'interaction-changed', () => {
            if (view.dragging)
                this.reset();
        });
        lifecycle.connect(settings, 'changed::dock-magnification', () => this._syncRoom());
        lifecycle.connect(settings, 'changed::dock-magnification-scale', () => this._syncRoom());
        this._syncRoom();
    }

    /** Ajusta el ancho de la píldora al tamaño máximo de los iconos. */
    _syncRoom() {
        this.reset();
        this._view.setMagnificationRoom(this._enabled ? this._maxScale : 1);
    }

    get _enabled() {
        return this._settings.get_boolean('dock-magnification');
    }

    get _maxScale() {
        return Math.max(1, this._settings.get_double('dock-magnification-scale'));
    }

    /**
     * Magnifica alrededor de una altura del escenario. Lo llama el
     * movimiento del puntero; es público para la prueba automática.
     *
     * @param {number} stageY - coordenada vertical del puntero
     */
    magnifyAt(stageY) {
        if (!this._enabled || this._view.dragging)
            return;

        this._pointerY = stageY;
        if (!this._rest) {
            this._rest = this._measureRest();
            if (!this._rest)
                return;
        }

        if (this._amount.value < 1 && !this._growing) {
            this._growing = true;
            this._amount.ease(1, {
                duration: GROW_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onStopped: () => (this._growing = false),
            });
        }
        this._apply();
    }

    /** Vuelve al tamaño normal con una animación. */
    release() {
        this._growing = false;
        if (!this._rest)
            return;

        this._amount.ease(0, {
            duration: SHRINK_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: isFinished => {
                if (isFinished)
                    this._rest = null;
            },
        });
    }

    /** Vuelve al tamaño normal al instante (cambios en la lista, arrastre). */
    reset() {
        this._growing = false;
        this._amount.remove_transition('value');
        this._amount.value = 0;
        for (const item of this._view.dockItems)
            item.setMagnification(1);
        this._rest = null;
    }

    /**
     * Centros en reposo de los iconos, la altura de un icono y el
     * espacio libre que queda para crecer.
     */
    _measureRest() {
        const items = this._view.dockItems;
        if (items.length === 0 || items.some(item => item.magnification !== 1))
            return null;

        const centers = items.map(item => {
            const [, y] = item.get_transformed_position();
            const [, height] = item.get_transformed_size();
            return y + height / 2;
        });
        const themeScale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const iconPx = this._view.iconSize * themeScale;
        const [, viewHeight] = this._view.get_transformed_size();
        const area = this._view.get_parent();
        const room = (area?.height ?? viewHeight) - viewHeight - 2 * SCREEN_MARGIN * themeScale;

        return {items, centers, iconPx, room: Math.max(0, room)};
    }

    _apply() {
        const rest = this._rest;
        if (!rest)
            return;

        const amount = this._amount.value;
        const range = RANGE_SLOTS * rest.iconPx;
        const growth = (this._maxScale - 1) * amount;

        const factors = rest.centers.map(center => {
            const d = Math.abs(this._pointerY - center);
            return d < range ? (Math.cos(Math.PI * d / range) + 1) / 2 : 0;
        });

        // Si la píldora no cabe en la pantalla al crecer, se reduce el
        // crecimiento de todos por igual.
        const extra = factors.reduce((sum, f) => sum + f * growth * rest.iconPx, 0);
        const limit = extra > rest.room && extra > 0 ? rest.room / extra : 1;

        rest.items.forEach((item, i) => {
            if (item.get_parent())
                item.setMagnification(1 + factors[i] * growth * limit);
        });
    }

    destroy() {
        this.reset();
        this._amount = null;
        this._view = null;
        this._settings = null;
    }
}

/* core/feature.js
 *
 * Contrato común de los módulos de Bahía Dock. Cada funcionalidad
 * (dock, ventanas, ...) hereda de Feature y define:
 *
 *   - static id: identificador corto. Su interruptor en GSettings es
 *     la clave "<id>-enabled".
 *   - _onEnable(): crea actores y conecta señales.
 *   - _onDisable(): destruye todo lo creado en _onEnable().
 *
 * Los módulos dependen de core/, nunca entre sí.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import {Lifecycle} from './lifecycle.js';

export class Feature {
    static id = 'feature';

    /**
     * @param {object} params
     * @param {Extension} params.extension - instancia de la extensión
     * @param {Gio.Settings} params.settings - ajustes compartidos
     * @param {Logger} params.logger - logger con el nombre del módulo
     */
    constructor({extension, settings, logger}) {
        this.extension = extension;
        this.settings = settings;
        this.logger = logger;
        this.lifecycle = null;
        this.enabled = false;
    }

    get id() {
        return this.constructor.id;
    }

    enable() {
        if (this.enabled)
            return;

        this.lifecycle = new Lifecycle();
        this._onEnable();
        this.enabled = true;
        this.logger.debug('Activado');
    }

    disable() {
        if (!this.enabled && !this.lifecycle)
            return;

        try {
            this._onDisable();
        } finally {
            this.lifecycle?.clear(this.logger);
            this.lifecycle = null;
            this.enabled = false;
            this.logger.debug('Desactivado');
        }
    }

    /** Para sobrescribir en cada módulo. */
    _onEnable() {
    }

    /** Para sobrescribir en cada módulo. */
    _onDisable() {
    }
}

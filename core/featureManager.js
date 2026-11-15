/* core/featureManager.js
 *
 * Activa y desactiva los módulos según sus interruptores en GSettings
 * ("<id>-enabled") y aísla sus errores: si un módulo falla al activarse,
 * se registra el error, se deshace lo que hubiera creado y los demás
 * siguen funcionando.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import {Lifecycle} from './lifecycle.js';

export class FeatureManager {
    /**
     * @param {object} params
     * @param {Extension} params.extension - instancia de la extensión
     * @param {Gio.Settings} params.settings - ajustes compartidos
     * @param {Logger} params.logger - logger raíz
     * @param {Array<typeof Feature>} params.features - clases de módulos
     */
    constructor({extension, settings, logger, features}) {
        this._extension = extension;
        this._settings = settings;
        this._logger = logger;
        this._featureClasses = features;
        this._features = new Map();
        this._lifecycle = null;
    }

    enable() {
        this._lifecycle = new Lifecycle();

        for (const FeatureClass of this._featureClasses) {
            const feature = new FeatureClass({
                extension: this._extension,
                settings: this._settings,
                logger: this._logger.child(FeatureClass.id),
            });
            this._features.set(FeatureClass.id, feature);

            const key = `${FeatureClass.id}-enabled`;
            this._lifecycle.connect(this._settings, `changed::${key}`,
                () => this._sync(feature));
            this._sync(feature);
        }
    }

    disable() {
        this._lifecycle?.clear(this._logger);
        this._lifecycle = null;

        // Orden inverso al de activación.
        for (const feature of [...this._features.values()].reverse())
            this._safeDisable(feature);
        this._features.clear();
    }

    _sync(feature) {
        const wanted = this._settings.get_boolean(`${feature.id}-enabled`);
        if (wanted)
            this._safeEnable(feature);
        else
            this._safeDisable(feature);
    }

    _safeEnable(feature) {
        try {
            feature.enable();
        } catch (e) {
            this._logger.error(`No se pudo activar el módulo "${feature.id}"`, e);
            this._safeDisable(feature);
        }
    }

    _safeDisable(feature) {
        try {
            feature.disable();
        } catch (e) {
            this._logger.error(`No se pudo desactivar el módulo "${feature.id}"`, e);
        }
    }
}

/* extension.js
 *
 * Punto de entrada de Bahía Dock. Solo crea el gestor de módulos y le
 * delega la activación y desactivación. La lógica de cada funcionalidad
 * vive en features/.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {Logger} from './core/logger.js';
import {FeatureManager} from './core/featureManager.js';
import {DockFeature} from './features/dock/dockFeature.js';

export default class BahiaDockExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._logger = new Logger(this.getLogger(), this._settings);

        this._featureManager = new FeatureManager({
            extension: this,
            settings: this._settings,
            logger: this._logger,
            features: [DockFeature],
        });
        this._featureManager.enable();
    }

    disable() {
        this._featureManager?.disable();
        this._featureManager = null;

        this._logger?.destroy();
        this._logger = null;

        this._settings = null;
    }
}

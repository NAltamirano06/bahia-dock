/* features/dock/dockFeature.js
 *
 * Coordinador del módulo del dock. En la Fase 0 solo existe el esqueleto
 * para comprobar el ciclo de activación y desactivación. En la Fase 1
 * creará el espacio reservado, la vista y el modelo de aplicaciones, y
 * ocultará el dash nativo de la vista general.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import {Feature} from '../../core/feature.js';

export class DockFeature extends Feature {
    static id = 'dock';

    _onEnable() {
    }

    _onDisable() {
    }
}

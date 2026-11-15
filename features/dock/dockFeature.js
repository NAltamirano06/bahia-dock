/* features/dock/dockFeature.js
 *
 * Coordinador del módulo del dock. Conecta las piezas:
 *
 *   AppModel    qué aplicaciones mostrar (favoritas y abiertas) y cuál
 *               tiene el foco
 *   DockView    la píldora con los iconos
 *   DockLayout  posición en pantalla y espacio reservado
 *   NativeDash  oculta y restaura el dash de la vista general
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import {Feature} from '../../core/feature.js';

import {AppModel} from './appModel.js';
import {DockLayout} from './dockLayout.js';
import {DockView} from './dockView.js';
import {NativeDash} from './nativeDash.js';

export class DockFeature extends Feature {
    static id = 'dock';

    _onEnable() {
        this._model = new AppModel(this.lifecycle);
        this._view = new DockView();
        this._view.setApps(this._model.favorites, this._model.running);
        this._view.setFocusApp(this._model.focusApp);
        this._layout = new DockLayout(this._view, this.lifecycle);

        this._model.connect('changed', () => {
            this._view.setApps(this._model.favorites, this._model.running);
            this._layout.update();
        });
        this._model.connect('focus-changed', () => {
            this._view.setFocusApp(this._model.focusApp);
        });

        this._nativeDash = new NativeDash(this.settings, this.logger);
        this._nativeDash.hide();

        this.logger.debug(`Dock con ${this._model.favorites.length} favoritas y ` +
            `${this._model.running.length} abiertas no favoritas`);
    }

    _onDisable() {
        // Cada paso se protege por separado: si _onEnable falló a medias,
        // algunas piezas no existen.
        this._nativeDash?.restore();
        this._nativeDash = null;

        // La vista se destruye junto con el área del layout; si el layout
        // no llegó a crearse, se destruye aquí.
        if (this._layout)
            this._layout.destroy();
        else
            this._view?.destroy();
        this._layout = null;
        this._view = null;

        this._model?.destroy();
        this._model = null;
    }
}

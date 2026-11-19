/* features/dock/dockFeature.js
 *
 * Coordinador del módulo del dock. Conecta las piezas:
 *
 *   AppModel    qué aplicaciones mostrar (favoritas y abiertas) y cuál
 *               tiene el foco
 *   DockView    la píldora con los iconos, sus menús, etiquetas y el
 *               destino de los arrastres
 *   DockLayout  posición en pantalla y espacio reservado
 *   Magnifier   agranda los iconos al pasar el puntero
 *   DockVisibility  siempre visible, ocultado automático o intellihide
 *   OverviewBackdrop  fondo de pantalla bajo el dock al abrir la vista
 *               general, para que no se vea un corte en su borde
 *   NativeDash  oculta y restaura el dash de la vista general
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import {Feature} from '../../core/feature.js';

import {AppModel} from './appModel.js';
import {DockLayout} from './dockLayout.js';
import {DockView} from './dockView.js';
import {DockVisibility} from './dockVisibility.js';
import {Magnifier} from './magnifier.js';
import {NativeDash} from './nativeDash.js';
import {OverviewBackdrop} from './overviewBackdrop.js';

export class DockFeature extends Feature {
    static id = 'dock';

    _onEnable() {
        this._model = new AppModel(this.lifecycle);
        this._view = new DockView(this.settings,
            () => this.extension.openPreferences());
        this._syncApps();
        this._view.setFocusApp(this._model.focusApp);
        this._layout = new DockLayout(this._view, this.settings, this.lifecycle);

        this._magnifier = new Magnifier(this._view, this.settings, this.lifecycle);
        this._visibility = new DockVisibility(this._layout, this._view,
            this.settings, this.lifecycle);
        this._backdrop = new OverviewBackdrop(this._layout, this.lifecycle);

        // Las posiciones en reposo de la magnificación dejan de valer al
        // recolocar el dock o cambiar el tamaño de los iconos.
        this.lifecycle.connect(this._layout, 'updated', () => this._magnifier.reset());

        this._model.connect('changed', () => this._refreshApps());
        this.lifecycle.connect(this.settings, 'changed::dock-show-running',
            () => this._refreshApps());
        this.lifecycle.connect(this.settings, 'changed::dock-show-apps-button',
            () => this._layout.update());
        this._model.connect('focus-changed', () => {
            this._view.setFocusApp(this._model.focusApp);
        });

        this._nativeDash = new NativeDash(this.settings, this.logger);
        this._nativeDash.hide();

        this.logger.debug(`Dock con ${this._model.favorites.length} favoritas y ` +
            `${this._model.running.length} abiertas no favoritas`);
    }

    /** Pasa las apps a la vista; sin dock-show-running no hay sección de abiertas. */
    _syncApps() {
        const running = this.settings.get_boolean('dock-show-running')
            ? this._model.running : [];
        this._view.setApps(this._model.favorites, running);
    }

    _refreshApps() {
        this._magnifier.reset();
        this._syncApps();
        this._layout.update();
    }

    _onDisable() {
        // Cada paso se protege por separado: si _onEnable falló a medias,
        // algunas piezas no existen.
        this._nativeDash?.restore();
        this._nativeDash = null;

        this._backdrop?.destroy();
        this._backdrop = null;
        this._visibility?.destroy();
        this._visibility = null;
        this._magnifier?.destroy();
        this._magnifier = null;

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

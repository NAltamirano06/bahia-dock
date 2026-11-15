/* core/lifecycle.js
 *
 * Registro de recursos que deben liberarse al desactivar un módulo:
 * conexiones a señales, temporizadores de GLib y funciones de limpieza
 * arbitrarias. Un módulo crea un Lifecycle en enable() y llama a
 * clear() en disable(); así no quedan señales ni timeouts huérfanos.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import GLib from 'gi://GLib';

export class Lifecycle {
    constructor() {
        this._cleanups = [];
    }

    /**
     * Conecta una señal y registra su desconexión.
     *
     * @param {GObject.Object} object - emisor de la señal
     * @param {string} signal - nombre de la señal
     * @param {Function} callback - manejador
     * @returns {number} id de la conexión
     */
    connect(object, signal, callback) {
        const id = object.connect(signal, callback);
        this._cleanups.push(() => object.disconnect(id));
        return id;
    }

    /**
     * Programa un temporizador de GLib y registra su eliminación.
     * El callback debe devolver GLib.SOURCE_CONTINUE o GLib.SOURCE_REMOVE.
     *
     * @param {number} intervalMs - intervalo en milisegundos
     * @param {Function} callback - función a ejecutar
     * @returns {number} id de la fuente
     */
    timeout(intervalMs, callback) {
        const entry = {id: 0};
        entry.id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, intervalMs, () => {
            const result = callback();
            if (result !== GLib.SOURCE_CONTINUE)
                entry.id = 0;
            return result;
        });
        this._cleanups.push(() => {
            if (entry.id)
                GLib.source_remove(entry.id);
            entry.id = 0;
        });
        return entry.id;
    }

    /**
     * Registra una función de limpieza arbitraria.
     *
     * @param {Function} cleanup - se ejecuta en clear()
     */
    add(cleanup) {
        this._cleanups.push(cleanup);
    }

    /**
     * Ejecuta todas las limpiezas en orden inverso al de registro.
     *
     * @param {Logger} [logger] - para informar de errores en la limpieza
     */
    clear(logger = null) {
        while (this._cleanups.length > 0) {
            const cleanup = this._cleanups.pop();
            try {
                cleanup();
            } catch (e) {
                logger?.error('Error durante la limpieza', e);
            }
        }
    }
}

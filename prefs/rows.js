/* prefs/rows.js
 *
 * Filas de preferencias enlazadas a GSettings, compartidas por todas las
 * páginas. Cada fila escribe la clave al cambiar y se actualiza si la
 * clave cambia desde otro sitio (el menú de configuración del dock, por
 * ejemplo).
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

/**
 * Interruptor para una clave booleana.
 *
 * @param {Gio.Settings} settings - ajustes de la extensión
 * @param {string} key - clave booleana
 * @param {string} title - título
 * @param {string} subtitle - explicación
 * @returns {Adw.SwitchRow}
 */
export function switchRow(settings, key, title, subtitle) {
    const row = new Adw.SwitchRow({title, subtitle});
    settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

/**
 * Selector numérico para una clave entera o decimal.
 *
 * @param {Gio.Settings} settings - ajustes de la extensión
 * @param {string} key - clave "i" o "d"
 * @param {object} params
 * @param {string} params.title - título
 * @param {string} params.subtitle - explicación
 * @param {number} params.lower - mínimo
 * @param {number} params.upper - máximo
 * @param {number} params.step - paso
 * @param {number} [params.digits] - decimales que se muestran
 * @returns {Adw.SpinRow}
 */
export function spinRow(settings, key, {title, subtitle, lower, upper, step, digits = 0}) {
    const row = new Adw.SpinRow({
        title,
        subtitle,
        digits,
        adjustment: new Gtk.Adjustment({lower, upper, step_increment: step, page_increment: step * 10}),
    });
    settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

/**
 * Lista desplegable para una clave de texto con opciones fijas.
 *
 * @param {Gio.Settings} settings - ajustes de la extensión
 * @param {string} key - clave "s"
 * @param {string} title - título
 * @param {string} subtitle - explicación
 * @param {Array<[string, string]>} choices - pares [valor, texto], en orden
 * @returns {Adw.ComboRow}
 */
export function choiceRow(settings, key, title, subtitle, choices) {
    const row = new Adw.ComboRow({
        title,
        subtitle,
        model: Gtk.StringList.new(choices.map(([, label]) => label)),
    });
    const sync = () => {
        const index = choices.findIndex(([value]) => value === settings.get_string(key));
        row.selected = Math.max(0, index);
    };
    sync();
    const id = settings.connect(`changed::${key}`, sync);
    row.connect('notify::selected', () => {
        const [value] = choices[row.selected] ?? choices[0];
        if (settings.get_string(key) !== value)
            settings.set_string(key, value);
    });
    row.connect('destroy', () => settings.disconnect(id));
    return row;
}

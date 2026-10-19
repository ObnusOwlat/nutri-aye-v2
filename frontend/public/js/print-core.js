/**
 * print-core.js - Printable documents for the patient (and the billing receipts):
 * the document is drawn in #print-area and only that is printed (print-docs.css).
 * While printing, the page title becomes the document's name, so "Guardar como
 * PDF" suggests it as the file name. Every document builds its HTML picking
 * fields one by one: nothing internal goes out by accident.
 */

const Print = (function() {
    const esc = (v) => UI.escapeHtml(v ?? '');

    function run({ title, html }) {
        const area = document.getElementById('print-area');
        const previousTitle = document.title;
        area.innerHTML = html;
        document.title = title || previousTitle;
        document.body.classList.add('printing-document');
        const done = () => {
            document.body.classList.remove('printing-document');
            area.innerHTML = '';
            document.title = previousTitle;
            window.removeEventListener('afterprint', done);
        };
        window.addEventListener('afterprint', done);
        window.print();
    }

    // "Plan semanal", patient -> "Plan semanal - Ana Pérez - 16-10-2026"
    const fileTitle = (name, patient) => [name, patient && fullName(patient), UI.formatDate(today()).replace(/\//g, '-')]
        .filter(Boolean).join(' - ');

    const today = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    // Recipe name for the patient: without the level suffix of the loaded plans ("… · 1300/1500 kcal")
    const recipeName = (name) => String(name || '').replace(/\s*·\s*[\d./\s]+kcal\s*$/i, '');
    const fullName = (patient) => `${patient.firstName || ''} ${patient.lastName || ''}`.trim();

    /**
     * One document: consultorio header, title, patient line, body and footer.
     * `body` is already escaped HTML; `legend` replaces the default footer text.
     */
    function page({ title, subtitle, patient, body, legend }) {
        const who = Auth.current()?.user?.name;
        const footer = legend ?? (patient
            ? `Plan personal para ${fullName(patient)}. No reemplaza la indicación médica.`
            : 'No reemplaza la indicación médica.');
        return `
            <article class="pdoc" style="--pdoc-accent: ${PrintBranding.accent()}">
                ${PrintBranding.header()}
                <div class="pdoc__title">
                    <h1>${esc(title)}</h1>
                    ${patient ? `<p class="pdoc__patient">${esc(fullName(patient))}</p>` : ''}
                    ${subtitle ? `<p class="pdoc__subtitle">${subtitle}</p>` : ''}
                </div>
                ${body}
                <footer class="pdoc__foot">
                    <p>${esc(footer)}</p>
                    <p>Emitido el ${UI.formatDate(today())}${who ? ` · Nutricionista: ${esc(who)}` : ''}</p>
                </footer>
            </article>`;
    }

    // cols: [{ label, num? }]; rows: arrays of already escaped cells
    function table(cols, rows, className = '') {
        const cls = (c) => (c.num ? ' class="num"' : '');
        return `
            <table class="pdoc-table ${className}">
                <thead><tr>${cols.map(c => `<th${cls(c)}>${esc(c.label)}</th>`).join('')}</tr></thead>
                <tbody>${rows.map(r => `<tr>${r.map((cell, i) => `<td${cls(cols[i] || {})}>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>`;
    }

    const section = (title, content, className = '') =>
        `<section class="pdoc__section ${className}"><h2>${esc(title)}</h2>${content}</section>`;

    return { run, page, table, section, fileTitle, fullName, recipeName, today, esc };
})();

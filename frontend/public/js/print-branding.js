/**
 * print-branding.js - Header of the printed documents: the consultorio data
 * (Datos del consultorio) and its logo and color (billing pdf-config). Loaded
 * once and kept until the consultorio data is saved again. Also the "Logo y
 * color" block of Datos del consultorio: the logo is shrunk in the browser
 * before it is saved, so it stays small.
 */

const PrintBranding = (function() {
    const esc = (v) => UI.escapeHtml(v ?? '');
    const DEFAULT_ACCENT = '#166534';
    const APP_GREEN = '#22c55e';     // pdf-config default: too light for print, the darker green is used
    const LOGO_BOX = { width: 600, height: 240 };
    const MAX_LOGO_CHARS = 450000;   // the API accepts up to 500.000
    let company = null;
    let config = null;
    let loading = null;

    // Before printing: the data of the consultorio (no error if it is missing)
    function load() {
        if (!loading) {
            loading = Promise.all([
                State._api('GET', '/billing-api/company').catch(() => null),
                State._api('GET', '/billing-api/pdf-config').catch(() => null)
            ]).then(([c, p]) => { company = c; config = p; });
        }
        return loading;
    }
    const invalidate = () => { loading = null; };

    const accent = () => {
        const color = config?.primaryColor;
        return /^#[0-9a-f]{6}$/i.test(color || '') && color.toLowerCase() !== APP_GREEN ? color : DEFAULT_ACCENT;
    };

    function header() {
        const c = company || {};
        const name = c.name || Auth.current()?.organization?.name || 'Consultorio';
        const logo = config?.includeLogo && config.logoB64 ? `<img class="pdoc__logo" src="${esc(config.logoB64)}" alt="">` : '';
        const lines = [
            [c.address, c.city].filter(Boolean).join(', '),
            [c.phone, c.email, c.website].filter(Boolean).join(' · ')
        ].filter(Boolean);
        return `
            <header class="pdoc__head">
                ${logo}
                <div class="pdoc__org">
                    <strong>${esc(name)}</strong>
                    ${lines.map(l => `<span>${esc(l)}</span>`).join('')}
                </div>
            </header>`;
    }

    // ---- "Logo y color" in Datos del consultorio (admin) ----

    let draftLogo = null;

    function formHtml(pdf) {
        draftLogo = pdf?.includeLogo ? pdf.logoB64 || null : null;
        const color = pdf?.primaryColor && pdf.primaryColor.toLowerCase() !== APP_GREEN ? pdf.primaryColor : DEFAULT_ACCENT;
        return `
            <section class="print-brand">
                <h4>Logo y color de los impresos</h4>
                <p class="text-muted">Salen en los planes, recetas y demás documentos para el paciente.</p>
                <div class="print-brand__row">
                    <div class="print-brand__preview" data-logo-preview>${previewHtml()}</div>
                    <div class="print-brand__actions">
                        <label class="btn btn--secondary btn--sm">Elegir logo
                            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-logo-file hidden></label>
                        <button class="btn btn--secondary btn--sm" type="button" data-logo-remove>Quitar logo</button>
                        <label class="print-brand__color">Color <input type="color" name="printColor" value="${esc(color)}"></label>
                    </div>
                </div>
            </section>`;
    }

    const previewHtml = () => (draftLogo ? `<img src="${esc(draftLogo)}" alt="Logo">` : '<span class="text-muted">Sin logo</span>');

    function bindForm(root) {
        const preview = root.querySelector('[data-logo-preview]');
        root.querySelector('[data-logo-file]').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            e.target.value = '';
            if (!file) return;
            try {
                draftLogo = await shrink(file);
                preview.innerHTML = previewHtml();
            } catch (error) { UI.toastError(error.message); }
        });
        root.querySelector('[data-logo-remove]').addEventListener('click', () => {
            draftLogo = null;
            preview.innerHTML = previewHtml();
        });
    }

    // Fits the image in LOGO_BOX; PNG keeps transparency, JPEG if PNG is too big
    function shrink(file) {
        if (!file.type.startsWith('image/')) return Promise.reject(new Error('El logo tiene que ser una imagen'));
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                const scale = Math.min(1, LOGO_BOX.width / img.width, LOGO_BOX.height / img.height);
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                let data = canvas.toDataURL('image/png');
                if (data.length > MAX_LOGO_CHARS) {
                    ctx.globalCompositeOperation = 'destination-over';
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    data = canvas.toDataURL('image/jpeg', 0.85);
                }
                if (data.length > MAX_LOGO_CHARS) reject(new Error('El logo es demasiado pesado; probá con una imagen más simple'));
                else resolve(data);
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
            img.src = url;
        });
    }

    // After the company is saved (pdf-config needs it to exist)
    async function saveForm(root, pdf) {
        const color = root.querySelector('[name=printColor]')?.value || DEFAULT_ACCENT;
        await State._api('PUT', '/billing-api/pdf-config', {
            fontFamily: pdf?.fontFamily || 'Helvetica',
            padding: pdf?.padding ?? 40,
            primaryColor: color,
            secondaryColor: pdf?.secondaryColor || '#64748b',
            includeLogo: Boolean(draftLogo),
            logoB64: draftLogo
        });
        invalidate();
    }

    return { load, invalidate, accent, header, formHtml, bindForm, saveForm };
})();

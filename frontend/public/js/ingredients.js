/**
 * ingredients.js - "Alimentos" tab: the consultorio's own foods, or the shared
 * catalog (USDA + basic, ~8.200 foods) searched page by page in the server.
 * Rows: ingredient-list.js · profile: ingredient-detail.js · form: ingredient-form.js
 * · CSV/JSON: ingredient-import.js · filter tree (group, origen, form): ingredient-filters.js
 */

const Ingredients = (function() {
    const PAGE_SIZE = 30;
    let view = 'own';          // 'own' | 'catalog'
    let source = '';
    let query = '';
    let page = 1;
    let searchTimer = null;
    let requestSeq = 0;
    let list, pager, chips;

    const plain = (text) => String(text || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

    function init() {
        list = document.getElementById('ingredients-list');
        pager = document.getElementById('ingredients-pager');
        chips = document.getElementById('ingredient-filter-chips');
        IngredientList.bind(list);
        IngredientFilters.init(document.getElementById('ingredient-filters'), () => render(1));
        chips?.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-remove]');
            if (chip) IngredientFilters.remove(chip.dataset.remove);
        });

        document.getElementById('btn-add-ingredient')?.addEventListener('click', IngredientForm.showAdd);
        document.querySelector('.catalog-views')?.addEventListener('click', (e) => {
            const button = e.target.closest('[data-view]');
            if (button) setView(button.dataset.view);
        });
        document.getElementById('ingredient-search')?.addEventListener('input', (e) => {
            query = e.target.value.trim();
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => render(1), view === 'catalog' ? 300 : 0);
        });
        document.getElementById('ingredient-source')?.addEventListener('change', (e) => { source = e.target.value; render(1); });
        pager?.addEventListener('click', (e) => {
            const target = e.target.closest('[data-page]');
            if (target) render(Number(target.dataset.page));
        });
        State.subscribe('ingredients:updated', () => { if (view === 'own') render(page); });
        render(1);
    }

    function setView(next) {
        view = next;
        document.querySelectorAll('.catalog-views [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
        document.getElementById('ingredient-source')?.classList.toggle('hidden', view !== 'catalog');
        document.getElementById('ingredient-search').placeholder = view === 'catalog'
            ? 'Buscar en el catálogo (en español o inglés)...' : 'Buscar en mis alimentos...';
        render(1);
    }

    function render(pageNumber) {
        page = pageNumber;
        if (chips) chips.innerHTML = IngredientFilters.summaryHtml();
        return view === 'own' ? renderOwn() : renderCatalog();
    }

    // Own foods: already in memory, filtered here
    function renderOwn() {
        const words = plain(query).split(/\s+/).filter(Boolean);
        const searched = State.getIngredients()
            .filter(i => !i.source || i.source === 'user')
            .filter(i => words.every(w => plain(i.name).includes(w)));
        IngredientFilters.setCounts(IngredientFilters.countLocal(searched));
        const own = searched.filter(IngredientFilters.matches).sort((a, b) => a.name.localeCompare(b.name, 'es'));
        list.innerHTML = IngredientList.listHtml(own, {
            editable: true,
            empty: query || IngredientFilters.active() ? 'Ningún alimento propio coincide' : 'Todavía no cargaste alimentos propios. Agregalos o duplicá uno del catálogo.'
        });
        pager.innerHTML = own.length ? `<span>${UI.plural(own.length, 'alimento propio', 'alimentos propios')}</span>` : '';
    }

    // Catalog: searched in the server (accents and word order do not matter)
    async function renderCatalog() {
        const seq = ++requestSeq;
        list.innerHTML = '<p class="text-muted">Buscando...</p>';
        const params = new URLSearchParams({ scope: 'catalog' });
        if (query) params.set('search', query);
        if (source) params.set('source', source);
        for (const [key, value] of Object.entries(IngredientFilters.query())) if (value) params.set(key, value);
        const listParams = new URLSearchParams(params);
        listParams.set('page', page);
        listParams.set('limit', PAGE_SIZE);
        try {
            const [res, facets] = await Promise.all([
                fetch(`/api/ingredients?${listParams}`),
                fetch(`/api/ingredients/facets?${params}`).then(r => r.json()).catch(() => null)
            ]);
            const json = await res.json();
            if (seq !== requestSeq) return; // a newer search already answered
            if (!res.ok) throw new Error(json.error);
            if (facets?.success) IngredientFilters.setCounts(facets.data);
            const hidden = FoodPrefs.hideImported() && facets?.success ? facets.data.total - facets.data.py : 0;
            const empty = hidden > 0
                ? `No hay alimentos de Paraguay que coincidan. Hay ${UI.plural(hidden, 'importado oculto', 'importados ocultos')}: desmarcá «Ocultar importados» para verlos.`
                : 'Ningún alimento del catálogo coincide con la búsqueda';
            list.innerHTML = IngredientList.listHtml(json.data, { empty });
            pager.innerHTML = IngredientList.pagerHtml(json.pagination);
        } catch (error) {
            if (seq === requestSeq) list.innerHTML = `<p class="text-muted">${UI.escapeHtml(error.message || 'Error al buscar')}</p>`;
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    return { setView };
})();

/**
 * ingredients.js - "Alimentos" tab: the consultorio's own foods, or the shared
 * catalog (USDA + basic, ~8.200 foods) searched page by page in the server.
 * Rows: ingredient-list.js · profile: ingredient-detail.js · form: ingredient-form.js
 * · CSV/JSON: ingredient-import.js
 */

const Ingredients = (function() {
    const PAGE_SIZE = 30;
    let view = 'own';          // 'own' | 'catalog'
    let category = 'all';
    let source = '';
    let query = '';
    let page = 1;
    let searchTimer = null;
    let requestSeq = 0;
    let list, pager;

    const plain = (text) => String(text || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

    function init() {
        list = document.getElementById('ingredients-list');
        pager = document.getElementById('ingredients-pager');
        IngredientList.bind(list);

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
        document.querySelector('#tab-ingredients .category-filter')?.addEventListener('click', (e) => {
            const button = e.target.closest('.category-filter__btn');
            if (!button) return;
            category = button.dataset.category;
            document.querySelectorAll('#tab-ingredients .category-filter__btn').forEach(b => b.classList.toggle('active', b === button));
            render(1);
        });
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
        return view === 'own' ? renderOwn() : renderCatalog();
    }

    // Own foods: already in memory, filtered here
    function renderOwn() {
        const words = plain(query).split(/\s+/).filter(Boolean);
        const own = State.getIngredients()
            .filter(i => !i.source || i.source === 'user')
            .filter(i => category === 'all' || i.category === category)
            .filter(i => words.every(w => plain(i.name).includes(w)))
            .sort((a, b) => a.name.localeCompare(b.name, 'es'));
        list.innerHTML = IngredientList.listHtml(own, {
            editable: true,
            empty: query || category !== 'all' ? 'Ningún alimento propio coincide' : 'Todavía no cargaste alimentos propios. Agregalos o duplicá uno del catálogo.'
        });
        pager.innerHTML = own.length ? `<span>${UI.plural(own.length, 'alimento propio', 'alimentos propios')}</span>` : '';
    }

    // Catalog: searched in the server (accents and word order do not matter)
    async function renderCatalog() {
        const seq = ++requestSeq;
        list.innerHTML = '<p class="text-muted">Buscando...</p>';
        const params = new URLSearchParams({ scope: 'catalog', page, limit: PAGE_SIZE });
        if (query) params.set('search', query);
        if (category !== 'all') params.set('category', category);
        if (source) params.set('source', source);
        try {
            const res = await fetch(`/api/ingredients?${params}`);
            const json = await res.json();
            if (seq !== requestSeq) return; // a newer search already answered
            if (!res.ok) throw new Error(json.error);
            list.innerHTML = IngredientList.listHtml(json.data, { empty: 'Ningún alimento del catálogo coincide con la búsqueda' });
            pager.innerHTML = IngredientList.pagerHtml(json.pagination);
        } catch (error) {
            if (seq === requestSeq) list.innerHTML = `<p class="text-muted">${UI.escapeHtml(error.message || 'Error al buscar')}</p>`;
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    return { setView };
})();

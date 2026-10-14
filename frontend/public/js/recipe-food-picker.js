/**
 * recipe-food-picker.js - Right column of the recipe editor: search the foods
 * (own + catalog) with the same filter tree and rows as the Alimentos tab, page
 * by page; "+ Agregar" calls onAdd(food). ⭐ Paraguay foods come first (server).
 */

const RecipeFoodPicker = (function() {
    const PAGE_SIZE = 30;
    let root, filters, onAdd = () => {}, picked = () => new Set();
    let query = '', page = 1, searchTimer = null, seq = 0;
    const shown = new Map(); // id -> food of the current page

    // Draws the panel inside element (once; later opens only clear the search).
    // inRecipe() returns the ids already in the recipe
    function mount(element, { add, inRecipe }) {
        onAdd = add;
        picked = inRecipe;
        query = '';
        if (root === element) {
            root.querySelector('#rfp-query').value = '';
            return search(1);
        }
        root = element;
        root.innerHTML = `
            <div class="rfp-search">
                <input type="search" class="form-input" id="rfp-query" placeholder="Buscar alimento (en español o inglés)..." autocomplete="off" aria-label="Buscar alimento">
                <button type="button" class="btn btn--secondary btn--sm rfp-filters-toggle" aria-expanded="false">Filtros</button>
            </div>
            <aside class="food-filters rfp-filters" aria-label="Filtros de alimentos"></aside>
            <div class="food-filters__chips rfp-chips"></div>
            <div class="rfp-list"></div>
            <div class="catalog-pager rfp-pager"></div>`;
        filters = IngredientFilters.create(root.querySelector('.rfp-filters'), () => search(1));

        root.querySelector('#rfp-query').addEventListener('input', (e) => {
            query = e.target.value.trim();
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => search(1), 250);
        });
        root.querySelector('.rfp-filters-toggle').addEventListener('click', (e) => {
            const open = root.classList.toggle('rfp--filters-open');
            e.currentTarget.setAttribute('aria-expanded', open);
        });
        root.querySelector('.rfp-chips').addEventListener('click', (e) => {
            const chip = e.target.closest('[data-remove]');
            if (chip) filters.remove(chip.dataset.remove);
        });
        root.querySelector('.rfp-pager').addEventListener('click', (e) => {
            const target = e.target.closest('[data-page]');
            if (target) search(Number(target.dataset.page));
        });
        const list = root.querySelector('.rfp-list');
        IngredientList.bind(list, { onAdd: (id) => shown.has(id) && onAdd(shown.get(id)) });
        search(1);
    }

    async function search(pageNumber) {
        page = pageNumber;
        const mine = ++seq;
        const list = root.querySelector('.rfp-list');
        root.querySelector('.rfp-chips').innerHTML = filters.summaryHtml();
        const params = new URLSearchParams();
        if (query) params.set('search', query);
        for (const [key, value] of Object.entries(filters.query())) if (value) params.set(key, value);
        const listParams = new URLSearchParams(params);
        listParams.set('page', page);
        listParams.set('limit', PAGE_SIZE);
        try {
            const [res, facets] = await Promise.all([
                fetch(`/api/ingredients?${listParams}`),
                fetch(`/api/ingredients/facets?${params}`).then(r => r.json()).catch(() => null)
            ]);
            const json = await res.json();
            if (mine !== seq) return; // a newer search already answered
            if (!res.ok) throw new Error(json.error);
            if (facets?.success) filters.setCounts(facets.data);
            shown.clear();
            for (const food of json.data) shown.set(food.id, food);
            list.innerHTML = IngredientList.listHtml(json.data, { pick: true, picked: picked(), empty: 'Ningún alimento coincide con la búsqueda' });
            root.querySelector('.rfp-pager').innerHTML = IngredientList.pagerHtml(json.pagination);
        } catch (error) {
            if (mine === seq) list.innerHTML = `<p class="text-muted">${UI.escapeHtml(error.message || 'Error al buscar')}</p>`;
        }
    }

    // After adding/removing a food: redraw the "+" / "✓" of the current page
    function refresh() {
        const list = root?.querySelector('.rfp-list');
        if (list && shown.size) list.innerHTML = IngredientList.listHtml([...shown.values()], { pick: true, picked: picked() });
    }

    return { mount, refresh };
})();

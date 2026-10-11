/**
 * recipe-ingredient-search.js - Food search of the recipe editor (dropdown,
 * keyboard navigation). Calls onPick(food) with the chosen food.
 */

const RecipeIngredientSearch = (function() {
    let defaults = [];
    let onPick = () => {};

    // Once: close the dropdown when clicking elsewhere
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.ingredient-search-section')) hide();
    });

    // Called when the editor opens: first foods to show and what to do on pick
    function attach(firstFoods, pickHandler) {
        defaults = firstFoods;
        onPick = pickHandler;
        const input = document.getElementById('recipe-ingredient-search');
        input?.addEventListener('input', (e) => filterIngredients(e.target.value));
        input?.addEventListener('keydown', handleSearchKeydown);
        filterIngredients(input?.value || '');
    }

    function hide() {
        const dropdown = document.getElementById('ingredient-dropdown');
        if (dropdown) dropdown.style.display = 'none';
    }

    function pick(id) {
        const input = document.getElementById('recipe-ingredient-search');
        if (input) input.value = '';
        hide();
        onPick(searchResults.get(id) || State.getIngredient(id));
    }

    // Empty query: the first foods (cache loaded on modal open). With text: search
    // the server (own foods + USDA catalog) plus foods that exist only in this browser.
    let searchTimer = null;
    let searchSeq = 0;
    const searchResults = new Map();

    function filterIngredients(query) {
        const q = (query || '').trim();
        clearTimeout(searchTimer);
        if (!q) return renderDropdown(defaults);
        searchTimer = setTimeout(() => searchIngredients(q), 200);
    }

    async function searchIngredients(q) {
        const seq = ++searchSeq;
        const local = State.getIngredients().filter(ing => ing.name.toLowerCase().includes(q.toLowerCase()));
        let remote = [];
        try {
            const res = await fetch(`/api/ingredients?search=${encodeURIComponent(q)}&limit=30`);
            if (res.ok) remote = (await res.json()).data || [];
        } catch (e) {
            console.warn('[Recipes] Ingredient search failed:', e.message);
        }
        if (seq !== searchSeq) return; // a newer search already ran
        const seen = new Set();
        renderDropdown([...local, ...remote].filter(ing => !seen.has(ing.id) && seen.add(ing.id)));
    }

    function renderDropdown(list) {
        const dropdown = document.getElementById('ingredient-dropdown');
        if (!dropdown) return;
        for (const ing of list) searchResults.set(ing.id, ing);

        if (list.length === 0) {
            dropdown.innerHTML = '<div class="ingredient-dropdown__empty">No ingredients found</div>';
        } else {
            dropdown.innerHTML = list.map(ing => `
                <div class="ingredient-dropdown__item" data-id="${UI.escapeHtml(ing.id)}">
                    <span class="ingredient-dropdown__name">${UI.escapeHtml(ing.name)}</span>
                    <span class="ingredient-dropdown__kcal">${Math.round(ing.kcalPer100g || 0)} kcal/100g</span>
                </div>
            `).join('');
            dropdown.querySelectorAll('.ingredient-dropdown__item').forEach(item => {
                item.addEventListener('click', () => pick(item.dataset.id));
            });
        }
        dropdown.style.display = 'block';
    }

    function handleSearchKeydown(e) {
        const dropdown = document.getElementById('ingredient-dropdown');
        const items = dropdown?.querySelectorAll('.ingredient-dropdown__item');
        if (!items || items.length === 0) return;
        
        const activeClass = 'ingredient-dropdown__item--active';
        let active = dropdown.querySelector('.' + activeClass);
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                active?.classList.remove(activeClass);
                const next = active?.nextElementSibling || items[0];
                next?.classList.add(activeClass);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                active?.classList.remove(activeClass);
                const prev = active?.previousElementSibling || items[items.length - 1];
                prev?.classList.add(activeClass);
                break;
                
            case 'Enter':
                e.preventDefault();
                if (active) {
                    pick(active.dataset.id);
                }
                break;
                
            case 'Escape':
                dropdown.style.display = 'none';
                break;
        }
    }
    
    function handleOutsideClick(e) {
        const searchSection = e.target.closest('.ingredient-search-section');
        if (!searchSection) {
            const dropdown = document.getElementById('ingredient-dropdown');
            if (dropdown) dropdown.style.display = 'none';
        }
    }
    
    return { attach, refresh: filterIngredients };
})();

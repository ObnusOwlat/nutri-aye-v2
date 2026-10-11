/**
 * ingredient-filters.js - Left column of the "Alimentos" tab: tree of
 * categories and their subgroups ("origen": Vaca, Cerdo, Pescados…) and the
 * preparation form (crudo, cocido…), each with how many foods it would give.
 * Several options can be checked; a whole category OR chosen subgroups.
 */

const IngredientFilters = (function() {
    const CATEGORIES = ['protein', 'carbs', 'fats', 'vegetables', 'fruits', 'dairy', 'mixed'];
    const FORMS = ['raw', 'cooked', 'frozen', 'canned', 'dried', 'none'];
    const categories = new Set();          // whole categories
    const subgroups = new Set();           // "category.subgroup"
    const forms = new Set();
    const open = new Set();                // expanded categories
    let root, onChange = () => {};
    let counts = { categories: {}, forms: {} };

    const esc = (t) => UI.escapeHtml(t);
    const formLabel = (f) => (f === 'none' ? 'Sin especificar' : UI.label('foodForm', f));

    function init(element, changed) {
        root = element;
        onChange = changed;
        root.addEventListener('click', (e) => {
            const toggle = e.target.closest('[data-toggle]');
            if (toggle) {
                const cat = toggle.dataset.toggle;
                open.has(cat) ? open.delete(cat) : open.add(cat);
                render();
                return;
            }
            if (e.target.closest('[data-clear]')) clear();
        });
        root.addEventListener('change', (e) => {
            const box = e.target;
            if (box.dataset.category) {
                const cat = box.dataset.category;
                if (box.checked) {
                    categories.add(cat);
                    [...subgroups].filter(s => s.startsWith(`${cat}.`)).forEach(s => subgroups.delete(s));
                    open.add(cat);
                } else categories.delete(cat);
            } else if (box.dataset.subgroup) {
                const key = box.dataset.subgroup;
                categories.delete(key.split('.')[0]);   // choosing one origin narrows the category
                box.checked ? subgroups.add(key) : subgroups.delete(key);
            } else if (box.dataset.form) {
                box.checked ? forms.add(box.dataset.form) : forms.delete(box.dataset.form);
            }
            render();
            onChange();
        });
        render();
    }

    function clear() {
        categories.clear(); subgroups.clear(); forms.clear();
        render();
        onChange();
    }

    // Query string values for /api/ingredients and /api/ingredients/facets
    const query = () => ({ category: [...categories].join(','), subgroup: [...subgroups].join(','), form: [...forms].join(',') });
    const active = () => categories.size + subgroups.size + forms.size > 0;

    // Same rule as the server, for own foods kept in the browser
    function matches(food) {
        const key = `${food.category}.${food.subgroup || 'other'}`;
        const byGroup = !categories.size && !subgroups.size || categories.has(food.category) || subgroups.has(key);
        const byForm = !forms.size || forms.has(food.form || 'none');
        return byGroup && byForm;
    }

    // Counts like /api/ingredients/facets, from a list in memory
    function countLocal(foods) {
        const result = { categories: {}, forms: {} };
        const byForm = (f) => !forms.size || forms.has(f.form || 'none');
        for (const f of foods.filter(byForm)) {
            const entry = result.categories[f.category] || (result.categories[f.category] = { total: 0, subgroups: {} });
            entry.total++;
            const sub = f.subgroup || 'other';
            entry.subgroups[sub] = (entry.subgroups[sub] || 0) + 1;
        }
        const byGroup = foods.filter(f => !categories.size && !subgroups.size || categories.has(f.category) || subgroups.has(`${f.category}.${f.subgroup || 'other'}`));
        for (const f of byGroup) result.forms[f.form || 'none'] = (result.forms[f.form || 'none'] || 0) + 1;
        return result;
    }

    function setCounts(next) {
        counts = next || { categories: {}, forms: {} };
        render();
    }

    function categoryHtml(cat) {
        const entry = counts.categories[cat] || { total: 0, subgroups: {} };
        const subs = Object.entries(entry.subgroups).sort((a, b) => (a[0] === 'other') - (b[0] === 'other') || b[1] - a[1]);
        const chosen = subs.filter(([s]) => subgroups.has(`${cat}.${s}`)).length;
        const isOpen = open.has(cat) || chosen > 0;
        return `
            <li class="food-filters__cat ${entry.total ? '' : 'food-filters__cat--empty'}">
                <div class="food-filters__row">
                    <button type="button" class="food-filters__toggle" data-toggle="${cat}" aria-expanded="${isOpen}" ${subs.length ? '' : 'disabled'}>${isOpen ? '▾' : '▸'}</button>
                    <label><input type="checkbox" data-category="${cat}" ${categories.has(cat) ? 'checked' : ''}>
                        ${esc(UI.label('ingredientCategory', cat))}</label>
                    <span class="food-filters__n">${UI.formatNumber(entry.total)}</span>
                </div>
                ${isOpen && subs.length ? `<ul class="food-filters__subs">${subs.map(([sub, n]) => `
                    <li class="food-filters__row">
                        <label><input type="checkbox" data-subgroup="${cat}.${sub}" ${subgroups.has(`${cat}.${sub}`) || categories.has(cat) ? 'checked' : ''}>
                            ${esc(UI.label('foodSubgroup', sub))}</label>
                        <span class="food-filters__n">${UI.formatNumber(n)}</span>
                    </li>`).join('')}</ul>` : ''}
            </li>`;
    }

    function render() {
        if (!root) return;
        const formRows = FORMS.filter(f => counts.forms[f] || forms.has(f)).map(f => `
            <li class="food-filters__row">
                <label><input type="checkbox" data-form="${f}" ${forms.has(f) ? 'checked' : ''}> ${esc(formLabel(f))}</label>
                <span class="food-filters__n">${UI.formatNumber(counts.forms[f] || 0)}</span>
            </li>`).join('');
        root.innerHTML = `
            <div class="food-filters__head">
                <h4>Filtros</h4>
                ${active() ? '<button type="button" class="btn btn--secondary btn--sm" data-clear>Limpiar</button>' : ''}
            </div>
            <h5>Grupo y origen</h5>
            <ul class="food-filters__tree">${CATEGORIES.map(categoryHtml).join('')}</ul>
            <h5>Preparación</h5>
            <ul class="food-filters__tree">${formRows || '<li class="text-muted">—</li>'}</ul>
            <p class="food-filters__note">El origen y la preparación salen del nombre del alimento y del grupo USDA: pueden tener errores.</p>`;
    }

    // Chips above the list with what is chosen, to remove one quickly
    function summaryHtml() {
        const chips = [
            ...[...categories].map(c => [`cat:${c}`, UI.label('ingredientCategory', c)]),
            ...[...subgroups].map(s => [`sub:${s}`, UI.label('foodSubgroup', s.split('.')[1])]),
            ...[...forms].map(f => [`form:${f}`, formLabel(f)])
        ];
        return chips.map(([key, text]) => `<button type="button" class="food-filters__chip" data-remove="${esc(key)}">${esc(text)} ×</button>`).join('');
    }

    function remove(key) {
        const [kind, value] = key.split(/:(.*)/s);
        ({ cat: categories, sub: subgroups, form: forms })[kind]?.delete(value);
        render();
        onChange();
    }

    return { init, query, active, matches, countLocal, setCounts, summaryHtml, remove, clear };
})();

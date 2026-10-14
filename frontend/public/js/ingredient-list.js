/**
 * ingredient-list.js - Rows of foods (own list and catalog results) and the pager
 */

const IngredientList = (function() {
    const round = (n) => UI.formatDecimal(n || 0, 1);

    // pick: the recipe editor's search, with "+" to add (or "✓" if already in the recipe)
    function rowHtml(ing, { editable, pick, picked }) {
        const source = ing.source && ing.source !== 'user' ? `<span class="food-row__source">${UI.escapeHtml(UI.label('source', ing.source))}</span>` : '';
        return `
            <li class="food-row" data-id="${UI.escapeHtml(ing.id)}">
                <button class="food-row__main" type="button" data-action="detail">
                    <span class="category-badge category-badge--${UI.escapeHtml(ing.category)}">${UI.escapeHtml(UI.label('ingredientCategory', ing.category))}</span>
                    <span class="food-row__name">${ing.availablePy ? '<span class="food-py" title="Se consigue en Paraguay">⭐</span> ' : ''}${UI.escapeHtml(ing.name)}${source}${(ing.allergens || []).map(a => ` <span class="allergen-chip" title="Alérgeno">${UI.escapeHtml(a.label)}</span>`).join('')}</span>
                    <span class="food-row__kcal">${UI.formatNumber(Math.round(ing.kcalPer100g || 0))} kcal</span>
                    <span class="food-row__macros">P ${round(ing.proteinPer100g)} · C ${round(ing.carbsPer100g)} · G ${round(ing.fatPer100g)} g</span>
                </button>
                ${editable ? `
                    <span class="food-row__actions">
                        <button class="btn btn--secondary btn--sm" type="button" data-action="edit">Editar</button>
                        <button class="btn btn--danger btn--sm" type="button" data-action="deactivate">Desactivar</button>
                    </span>` : ''}
                ${pick ? `
                    <span class="food-row__actions">
                        ${picked?.has(ing.id)
                            ? '<span class="food-row__picked" title="Ya está en la receta">✓ agregado</span>'
                            : '<button class="btn btn--primary btn--sm" type="button" data-action="add" title="Agregar a la receta">+ Agregar</button>'}
                    </span>` : ''}
            </li>`;
    }

    function listHtml(items, { editable = false, pick = false, picked = null, empty = 'No se encontraron alimentos' } = {}) {
        if (!items.length) return `<div class="empty-state"><p class="empty-state__text">${UI.escapeHtml(empty)}</p></div>`;
        return `<p class="food-list__note">Valores por 100 g</p><ul class="food-list ${pick ? 'food-list--pick' : ''}">${items.map(i => rowHtml(i, { editable, pick, picked })).join('')}</ul>`;
    }

    function pagerHtml({ page, totalPages, total }) {
        if (!totalPages || totalPages <= 1) return total ? `<span>${UI.plural(total, 'alimento')}</span>` : '';
        return `
            <button class="btn btn--secondary btn--sm" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Anterior</button>
            <span>Página ${UI.formatNumber(page)} de ${UI.formatNumber(totalPages)} · ${UI.plural(total, 'alimento')}</span>
            <button class="btn btn--secondary btn--sm" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Siguiente</button>`;
    }

    // Row clicks: detail, edit, deactivate (own foods); add (recipe editor: onAdd(id))
    function bind(container, { onAdd } = {}) {
        container.addEventListener('click', (e) => {
            const row = e.target.closest('.food-row');
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (!row || !action) return;
            if (action === 'detail') IngredientDetail.open(row.dataset.id);
            if (action === 'edit') IngredientForm.showEdit(row.dataset.id);
            if (action === 'deactivate') IngredientForm.confirmDeactivate(row.dataset.id);
            if (action === 'add') onAdd?.(row.dataset.id);
        });
    }

    return { listHtml, pagerHtml, bind };
})();

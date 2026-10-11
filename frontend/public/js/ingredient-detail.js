/**
 * ingredient-detail.js - A food's profile: key nutrients, household portions
 * and every nutrient by group. Own foods: edit / deactivate. Catalog foods:
 * "Duplicar y editar" creates the consultorio's own copy.
 */

const IngredientDetail = (function() {
    const amount = (n) => {
        const value = Number(n.amount);
        const decimals = value === 0 || value >= 10 ? 0 : value >= 1 ? 1 : 2;
        return `${UI.formatNumber(value, decimals)} <small>${UI.escapeHtml(n.unit === 'UG' ? 'µg' : n.unit?.toLowerCase() || '')}</small>`;
    };
    const rows = (list) => list.map(n => `<tr><td title="${UI.escapeHtml(n.nameEn || '')}">${UI.escapeHtml(n.name)}</td><td>${amount(n)}</td></tr>`).join('');

    async function open(id) {
        UI.openModal({ title: 'Alimento', content: '<p class="text-muted">Cargando...</p>', size: 'large', hideFooter: true });
        let food;
        try {
            food = await State._api('GET', `/api/ingredients/${encodeURIComponent(id)}`);
        } catch (error) {
            document.getElementById('modal-body').innerHTML = `<p class="text-muted">${UI.escapeHtml(error.message)}</p>`;
            return;
        }
        document.getElementById('modal-title').textContent = food.name;
        document.getElementById('modal-body').innerHTML = html(food);
        bind(food);
    }

    function html(food) {
        const groups = {};
        for (const n of food.nutrients) (groups[n.group] = groups[n.group] || []).push(n);
        const portions = food.portions.length
            ? `<ul class="food-detail__portions">${food.portions.map(p => `<li><span>${UI.escapeHtml(p.label)}</span><strong>${UI.formatNumber(p.gramWeight, p.gramWeight < 10 ? 1 : 0)} g</strong></li>`).join('')}</ul>`
            : '<p class="text-muted">Sin porciones caseras cargadas: usá gramos.</p>';

        return `
            <div class="food-detail">
                <p class="food-detail__meta">
                    <span class="category-badge category-badge--${UI.escapeHtml(food.category)}">${UI.escapeHtml(UI.label('ingredientCategory', food.category))}</span>
                    ${UI.escapeHtml(UI.label('source', food.source))}
                    ${food.nameEn ? `· <span title="Nombre original">${UI.escapeHtml(food.nameEn)}</span>` : ''}
                </p>
                <div class="food-detail__columns">
                    <section>
                        <h4>Nutrientes principales <small>por 100 g</small></h4>
                        <table class="food-detail__table"><tbody>${rows(food.keyNutrients)}</tbody></table>
                    </section>
                    <section>
                        <h4>Porciones caseras</h4>
                        ${portions}
                    </section>
                </div>
                ${food.nutrients.length ? `
                    <details class="food-detail__all">
                        <summary>Ver los ${UI.formatNumber(food.nutrients.length)} nutrientes</summary>
                        ${Object.entries(groups).map(([group, list]) => `
                            <h5>${UI.escapeHtml(UI.label('nutrientGroup', group))}</h5>
                            <table class="food-detail__table"><tbody>${rows(list)}</tbody></table>`).join('')}
                    </details>` : ''}
                <div class="food-detail__actions">
                    ${food.editable ? `
                        <button class="btn btn--secondary" data-action="edit">Editar</button>
                        <button class="btn btn--danger" data-action="deactivate">Desactivar</button>` : `
                        <span class="text-muted">Los alimentos del catálogo no se modifican.</span>
                        <button class="btn btn--primary" data-action="duplicate">Duplicar y editar</button>`}
                </div>
            </div>`;
    }

    function bind(food) {
        document.querySelector('.food-detail__actions')?.addEventListener('click', async (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'edit') IngredientForm.showEdit(food.id);
            if (action === 'deactivate') IngredientForm.confirmDeactivate(food.id);
            if (action === 'duplicate') {
                e.target.disabled = true;
                try {
                    const copy = await State._api('POST', `/api/ingredients/${encodeURIComponent(food.id)}/duplicate`, {});
                    State.cacheIngredient(copy);
                    UI.toastSuccess('Copia creada en Mis alimentos');
                    IngredientForm.open(copy);
                } catch (error) {
                    UI.toastError(error.message);
                    e.target.disabled = false;
                }
            }
        });
    }

    return { open };
})();

/**
 * ingredient-form.js - Add/edit modal of the consultorio's own foods (values
 * per 100 g) and their deactivation. Catalog foods are read-only: they are
 * copied with "Duplicar y editar" (ingredient-detail.js).
 */

const IngredientForm = (function() {
    // [API key, unit, indented] by section; names come from the server labels
    const SECTIONS = [
        ['Energía y macronutrientes', [
            ['kcalPer100g', 'kcal'], ['proteinPer100g', 'g'], ['carbsPer100g', 'g'], ['sugarPer100g', 'g', true],
            ['fiberPer100g', 'g', true], ['fatPer100g', 'g'], ['saturatedFatPer100g', 'g', true],
            ['polyunsaturatedFatPer100g', 'g', true], ['monounsaturatedFatPer100g', 'g', true],
            ['cholesterolPer100g', 'mg'], ['sodiumPer100g', 'mg']
        ]],
        ['Vitaminas', [
            ['vitaminAPer100g', 'µg'], ['vitaminB1Per100g', 'mg'], ['vitaminB2Per100g', 'mg'], ['vitaminB3Per100g', 'mg'],
            ['vitaminB5Per100g', 'mg'], ['vitaminB6Per100g', 'mg'], ['vitaminB9Per100g', 'µg'], ['vitaminB12Per100g', 'µg'],
            ['vitaminCPer100g', 'mg'], ['vitaminDPer100g', 'µg'], ['vitaminEPer100g', 'mg'], ['vitaminKPer100g', 'µg']
        ]],
        ['Minerales', [
            ['calciumPer100g', 'mg'], ['ironPer100g', 'mg'], ['magnesiumPer100g', 'mg'], ['phosphorusPer100g', 'mg'],
            ['potassiumPer100g', 'mg'], ['zincPer100g', 'mg'], ['seleniumPer100g', 'µg'], ['copperPer100g', 'mg'], ['manganesePer100g', 'mg']
        ]]
    ];
    const FIELDS = SECTIONS.flatMap(([, fields]) => fields.map(([key]) => key));
    const nutrientName = (key) => UI.label('nutrient', key.replace(/Per100g$/, ''));
    const inputId = (key) => `ingredient-${key}`;

    function open(ingredient = null) {
        UI.openModal({
            title: ingredient ? 'Editar alimento' : 'Agregar alimento',
            content: formHtml(ingredient || {}),
            confirmText: ingredient ? 'Guardar' : 'Agregar',
            onConfirm: () => save(ingredient?.id),
            size: 'large'
        });
    }

    const showAdd = () => open(null);
    function showEdit(id) {
        const ingredient = State.getIngredient(id);
        if (ingredient) open(ingredient);
    }

    function formHtml(ingredient) {
        const field = ([key, unit, indented]) => `
            <div class="nutrition-panel__row ${indented ? 'nutrition-panel__row--sub' : ''}">
                <label for="${inputId(key)}">${UI.escapeHtml(nutrientName(key))}</label>
                <input type="number" id="${inputId(key)}" class="nutrition-input" min="0" step="0.01" placeholder="0"
                       value="${UI.escapeHtml(ingredient[key] ?? '')}">
                <span>${unit}</span>
            </div>`;
        return `
            <div class="form-group">
                <label class="form-label" for="ingredient-name">Nombre *</label>
                <input type="text" id="ingredient-name" class="form-input" value="${UI.escapeHtml(ingredient.name || '')}"
                       placeholder="ej.: Chipa casera" autocomplete="off">
            </div>
            <div class="form-group">
                <label class="form-label" for="ingredient-category">Categoría</label>
                <select id="ingredient-category" class="form-select">
                    ${State.INGREDIENT_CATEGORIES.map(cat => `<option value="${cat}" ${ingredient.category === cat ? 'selected' : ''}>${UI.label('ingredientCategory', cat)}</option>`).join('')}
                </select>
            </div>
            <div class="nutrition-panel">
                <div class="nutrition-panel__header">
                    <span class="nutrition-panel__title">Información nutricional</span>
                    <span class="nutrition-panel__serving">por 100 g</span>
                </div>
                ${SECTIONS.map(([title, fields]) => `
                    <div class="nutrition-panel__section">
                        <div class="nutrition-panel__label">${title}</div>
                        ${fields.map(field).join('')}
                    </div>`).join('')}
            </div>`;
    }

    async function save(existingId) {
        const name = document.getElementById('ingredient-name')?.value.trim();
        if (!name) {
            UI.toastError('Escribí el nombre del alimento');
            return false;
        }
        const data = { name, category: document.getElementById('ingredient-category')?.value, unit: 'gram' };
        for (const key of FIELDS) data[key] = parseFloat(document.getElementById(inputId(key))?.value) || 0;

        if (existingId) {
            await State.updateIngredient(existingId, data);
            UI.toastSuccess('Alimento actualizado');
        } else {
            await State.addIngredient(data);
            UI.toastSuccess('Alimento agregado');
        }
        return true;
    }

    function confirmDeactivate(id) {
        const ingredient = State.getIngredient(id);
        if (!ingredient) return;
        UI.confirmDanger(
            `¿Desactivar "${ingredient.name}"? Deja de aparecer en las búsquedas; las recetas que lo usan no cambian.`,
            async () => {
                await State.deleteIngredient(id);
                UI.toastSuccess('Alimento desactivado');
            }
        );
    }

    return { showAdd, showEdit, open, confirmDeactivate };
})();

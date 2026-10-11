/**
 * ingredient-import.js - Import own foods from CSV/JSON and export them to CSV
 */

const IngredientImport = (function() {
    const CSV_HEADERS = ['name', 'kcalPer100g', 'category'];

    function init() {
        document.getElementById('btn-import-json')?.addEventListener('click', handleImportJSON);
        document.getElementById('btn-import-csv')?.addEventListener('click', handleImportCSV);
        document.getElementById('btn-export-csv')?.addEventListener('click', handleExportCSV);
    }

    /**
     * Handle JSON import (full nutritional data)
     */
    function handleImportJSON() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (!Array.isArray(data)) {
                        throw new Error('JSON must be an array of ingredients');
                    }
                    showImportPreview(data, true);
                } catch (error) {
                    UI.toastError('Error al leer el JSON: ' + error.message);
                }
            };
            reader.onerror = () => UI.toastError('Error al leer el archivo');
            reader.readAsText(file);
        };
        input.click();
    }

    /**
     * Handle CSV import
     */
    function handleImportCSV() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const result = parseCSV(event.target.result);
                    if (result.length === 0) {
                        UI.toastError('El CSV no tiene alimentos válidos');
                        return;
                    }
                    showImportPreview(result);
                } catch (error) {
                    UI.toastError('Error al leer el CSV: ' + error.message);
                }
            };
            reader.onerror = () => UI.toastError('Error al leer el archivo');
            reader.readAsText(file);
        };
        input.click();
    }

    /**
     * Parse CSV content (handles quoted values)
     */
    function parseCSV(content) {
        const rows = parseCSVLines(content);
        if (rows.length < 2) {
            throw new Error('El CSV debe tener una fila de encabezado y al menos una fila de datos');
        }

        const headers = rows[0].map(h => h.trim().toLowerCase());
        const headerMap = {};
        
        headers.forEach((h, i) => {
            if (h.includes('name') || h.includes('nombre')) headerMap.name = i;
            if (h.includes('kcal') || h.includes('calories') || h.includes('calorias')) headerMap.kcal = i;
            if (h.includes('category') || h.includes('categoria') || h.includes('type')) headerMap.category = i;
        });

        if (headerMap.name === undefined || headerMap.kcal === undefined) {
            throw new Error('El CSV debe tener las columnas "name" y "kcalPer100g"');
        }

        const ingredients = [];
        for (let i = 1; i < rows.length; i++) {
            const values = rows[i];
            if (values.length < 2) continue;

            const name = values[headerMap.name]?.trim();
            const kcal = parseFloat(values[headerMap.kcal]) || 0;
            const categoryValue = headerMap.category !== undefined ? values[headerMap.category] : 'mixed';

            if (name && !isNaN(kcal)) {
                ingredients.push({ 
                    name, 
                    kcalPer100g: kcal, 
                    category: normalizeCategory(categoryValue) 
                });
            }
        }

        return ingredients;
    }

    /**
     * Parse CSV content into rows of values
     */
    function parseCSVLines(content) {
        const rows = [];
        let currentRow = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const nextChar = content[i + 1];

            if (char === '"' && !inQuotes) {
                inQuotes = true;
            } else if (char === '"' && inQuotes) {
                if (nextChar === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else if (char === ',' && !inQuotes) {
                currentRow.push(current);
                current = '';
            } else if ((char === '\n' || char === '\r') && !inQuotes) {
                if (char === '\r' && nextChar === '\n') {
                    i++;
                }
                if (current || currentRow.length > 0) {
                    currentRow.push(current);
                    if (currentRow.some(v => v.trim())) {
                        rows.push(currentRow);
                    }
                }
                currentRow = [];
                current = '';
            } else {
                current += char;
            }
        }

        if (current || currentRow.length > 0) {
            currentRow.push(current);
            if (currentRow.some(v => v.trim())) {
                rows.push(currentRow);
            }
        }

        return rows;
    }

    /**
     * Normalize category value
     */
    function normalizeCategory(value) {
        if (!value) return 'mixed';
        const v = value.toLowerCase().trim();
        
        if (v.includes('protein') || v.includes('carne') || v.includes('meat')) return 'protein';
        if (v.includes('carb') || v.includes('carbo') || v.includes('bread') || v.includes('pasta')) return 'carbs';
        if (v.includes('fat') || v.includes('grasa') || v.includes('oil')) return 'fats';
        if (v.includes('veg') || v.includes('verdura') || v.includes('salad')) return 'vegetables';
        if (v.includes('fruit') || v.includes('fruta')) return 'fruits';
        if (v.includes('dairy') || v.includes('lácteo') || v.includes('lacteo') || v.includes('milk') || v.includes('leche') || v.includes('cheese') || v.includes('queso')) return 'dairy';
        return 'mixed';
    }

    /**
     * Show import preview
     */
    function showImportPreview(ingredients, isFullData = false) {
        const hasFullData = isFullData && ingredients.length > 0 && 
            (ingredients[0].proteinPer100g !== undefined || ingredients[0].fatPer100g !== undefined);
        
        const content = document.createElement('div');
        
        if (hasFullData) {
            content.innerHTML = `
                <p>Found ${ingredients.length} ingredient${ingredients.length !== 1 ? 's' : ''} with full nutritional data to import:</p>
                <div style="max-height: 300px; overflow-y: auto; margin-top: 16px; border: 1px solid var(--color-border); border-radius: 8px;">
                    ${ingredients.slice(0, 8).map(i => `
                        <div style="padding: 10px 12px; border-bottom: 1px solid var(--color-border);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <span style="font-weight: 500;">${UI.escapeHtml(i.name)}</span>
                                <span class="text-muted">${i.kcalPer100g} kcal</span>
                            </div>
                            <div style="display: flex; gap: 12px; font-size: 12px; color: var(--color-text-light);">
                                <span>P: ${i.proteinPer100g}g</span>
                                <span>C: ${i.carbsPer100g}g</span>
                                <span>G: ${i.fatPer100g}g</span>
                                ${i.fiberPer100g ? `<span>Fi: ${i.fiberPer100g}g</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                    ${ingredients.length > 8 ? `
                        <div style="padding: 8px; text-align: center; color: var(--color-text-light);">
                            ...and ${ingredients.length - 8} more
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            content.innerHTML = `
                <p>Found ${ingredients.length} ingredient${ingredients.length !== 1 ? 's' : ''} to import:</p>
                <div style="max-height: 300px; overflow-y: auto; margin-top: 16px; border: 1px solid var(--color-border); border-radius: 8px;">
                    ${ingredients.slice(0, 10).map(i => `
                        <div style="padding: 8px 12px; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
                            <span>${UI.escapeHtml(i.name)}</span>
                            <span class="text-muted">${i.kcalPer100g} kcal</span>
                        </div>
                    `).join('')}
                    ${ingredients.length > 10 ? `
                        <div style="padding: 8px; text-align: center; color: var(--color-text-light);">
                            ...and ${ingredients.length - 10} more
                        </div>
                    ` : ''}
                </div>
            `;
        }

        UI.openModal({
            title: 'Importar alimentos',
            content,
            confirmText: 'Importar todo',
            cancelText: 'Cancelar',
            onConfirm: async () => {
                const result = await (isFullData ? State.importIngredientsFull(ingredients) : State.importIngredients(ingredients));
                if (result.imported.length > 0) {
                    UI.toastSuccess(`Importados: ${UI.plural(result.imported.length, 'alimento')}`);
                }
                if (result.errors.length > 0) {
                    UI.toastWarning(`Omitidos: ${UI.plural(result.errors.length, 'alimento')} (faltan datos)`);
                }
            },
            size: 'medium'
        });
    }

    /**
     * Handle CSV export
     */
    function handleExportCSV() {
        const ingredients = State.getIngredients();

        if (ingredients.length === 0) {
            UI.toastWarning('No hay alimentos para exportar');
            return;
        }

        const csvContent = [
            CSV_HEADERS.join(','),
            ...ingredients.map(i => `"${i.name.replace(/"/g, '""')}",${i.kcalPer100g},${i.category}`)
        ].join('\n');

        downloadFile(csvContent, `ingredients_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
        UI.toastSuccess('CSV exported');
    }

    /**
     * Download file helper
     */
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Get CSV template
     */
    function getCSVTemplate() {
        return `name,kcalPer100g,category
"Chicken Breast, boneless",165,protein
Brown Rice,111,carbs
Avocado,160,fats
Broccoli,34,vegetables
Mixed Salad,20,mixed`;
    }

    document.addEventListener('DOMContentLoaded', init);

    return { getCSVTemplate };
})();

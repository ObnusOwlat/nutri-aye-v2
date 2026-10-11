/**
 * shopping.js - Shopping List Generator
 * 
 * Extracts and aggregates ingredients from
 * the weekly meal plan.
 */

const Shopping = (function() {
    // DOM Elements
    let shoppingList, shoppingEmpty, refreshBtn;

    // Checked items (stored in memory, could be localStorage)
    let checkedItems = new Set();

    /**
     * Initialize shopping module
     */
    function init() {
        // Cache DOM elements
        shoppingList = document.getElementById('shopping-list');
        shoppingEmpty = document.getElementById('shopping-empty');
        refreshBtn = document.getElementById('btn-refresh-shopping');

        // Bind events
        bindEvents();

        // Subscribe to state changes
        State.subscribe('weekPlan:updated', renderShoppingList);
        State.subscribe('recipes:updated', renderShoppingList);

        // Initial render
        renderShoppingList();

        console.log('[Shopping] Initialized');
    }

    /**
     * Bind UI events
     */
    function bindEvents() {
        // Refresh button
        refreshBtn?.addEventListener('click', () => {
            checkedItems.clear();
            renderShoppingList();
            UI.toastInfo('Shopping list refreshed');
        });

        // Event delegation for checkboxes (single listener)
        shoppingList.addEventListener('change', handleCheckboxChange);
    }

    /**
     * Group items by category
     */
    const groupByCategory = (items) => items.reduce((acc, item) => {
        const cat = item.category || 'mixed';
        (acc[cat] ??= []).push(item);
        return acc;
    }, {});

    /**
     * Render shopping list
     */
    function renderShoppingList() {
        const items = State.generateShoppingList();
        const hasItems = items.length > 0;

        shoppingList.style.display = hasItems ? 'block' : 'none';
        shoppingEmpty.style.display = hasItems ? 'none' : 'block';

        if (!hasItems) return;

        shoppingList.innerHTML = Object.entries(groupByCategory(items)).map(([category, categoryItems]) => `
            <div class="shopping-category">
                <div class="shopping-category__header">
                    ${UI.capitalize(category)}
                </div>
                ${categoryItems.map(renderShoppingItem).join('')}
            </div>
        `).join('');
    }

    /**
     * Handle checkbox changes via delegation
     */
    function handleCheckboxChange(e) {
        const checkbox = e.target.closest('.shopping-item__checkbox');
        if (!checkbox) return;

        const itemId = checkbox.dataset.id;
        const itemElement = checkbox.closest('.shopping-item');

        checkbox.checked ? checkedItems.add(itemId) : checkedItems.delete(itemId);
        itemElement?.classList.toggle('shopping-item--checked', checkbox.checked);
    }

    /**
     * Render single shopping item
     */
    function renderShoppingItem(item) {
        const isChecked = checkedItems.has(item.ingredientId);
        const totalKcal = (item.kcalPer100g * item.grams / 100).toFixed(0);

        return `
            <div class="shopping-item ${isChecked ? 'shopping-item--checked' : ''}" data-id="${item.ingredientId}">
                <input type="checkbox" class="shopping-item__checkbox" ${isChecked ? 'checked' : ''} data-id="${item.ingredientId}">
                <div class="shopping-item__info">
                    <span class="shopping-item__name">${UI.escapeHtml(item.name)}</span>
                    <span class="shopping-item__category">${totalKcal} kcal</span>
                </div>
                <span class="shopping-item__quantity">${UI.formatWeight(item.grams)}</span>
            </div>
        `;
    }

    /**
     * Get shopping statistics
     */
    function getStats() {
        const items = State.generateShoppingList();
        return {
            totalItems: items.length,
            totalWeight: items.reduce((sum, item) => sum + item.grams, 0),
            totalCalories: Math.round(items.reduce((sum, item) => sum + (item.kcalPer100g * item.grams / 100), 0))
        };
    }

    /**
     * Export shopping list as text
     */
    function exportAsText() {
        const items = State.generateShoppingList();
        if (!items.length) return '';

        let text = 'SHOPPING LIST\n=============\n\n';
        Object.entries(groupByCategory(items)).forEach(([category, categoryItems]) => {
            text += `${UI.capitalize(category)}\n${'-'.repeat(20)}\n`;
            categoryItems.forEach(item => {
                const check = checkedItems.has(item.ingredientId) ? '[x]' : '[ ]';
                text += `${check} ${item.name} - ${UI.formatWeight(item.grams)}\n`;
            });
            text += '\n';
        });
        return text;
    }

    /**
     * Copy shopping list to clipboard
     */
    function copyToClipboard() {
        const text = exportAsText();
        if (!text) {
            UI.toastWarning('Nothing to copy');
            return;
        }

        navigator.clipboard.writeText(text).then(() => {
            UI.toastSuccess('Shopping list copied to clipboard');
        }).catch(() => {
            UI.toastError('Failed to copy to clipboard');
        });
    }

    // ==========================================
    // PUBLIC API
    // ==========================================

    return {
        init,
        renderShoppingList,
        getStats,
        exportAsText,
        copyToClipboard
    };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => Shopping.init());

/**
 * Event Handlers - Centralized event handling
 * 
 * Replaces inline onclick handlers with proper event delegation.
 * This module should be initialized after DOM is ready.
 */

const EventHandlers = (function() {
    /**
     * Initialize all event handlers
     */
    function init() {
        // Modal overlay click handler
        const modalOverlay = document.getElementById('modal-overlay');
        modalOverlay?.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                UI?.closeModal();
            }
        });

        // Modal close button
        document.getElementById('modal-close')?.addEventListener('click', () => {
            UI?.closeModal();
        });

        // Modal cancel button
        document.getElementById('modal-cancel')?.addEventListener('click', () => {
            UI?.closeModal();
        });

        // Planner module events
        initPlannerHandlers();

        // Ingredients module events
        initIngredientsHandlers();

        // Recipes module events
        initRecipesHandlers();

        // Patients module events
        initPatientsHandlers();

        console.log('[EventHandlers] Initialized');
    }

    /**
     * Planner event handlers
     */
    function initPlannerHandlers() {
        const planner = document.getElementById('tab-planner');
        if (!planner) return;

        // Delegate click events in planner
        planner.addEventListener('click', (e) => {
            const target = e.target;

            // Add template button
            if (target.matches('[data-action="add-template"]') || 
                target.closest('[data-action="add-template"]')) {
                Planner?.showAddTemplateModal?.();
            }

            // Edit template button
            if (target.matches('.btn-edit-template') || target.closest('.btn-edit-template')) {
                const btn = target.closest('.btn-edit-template');
                const id = btn?.dataset.id;
                if (id) Planner?.showEditTemplateModal?.(id);
            }

            // Delete template button
            if (target.matches('.btn-delete-template') || target.closest('.btn-delete-template')) {
                const btn = target.closest('.btn-delete-template');
                const id = btn?.dataset.id;
                if (id) Planner?.deleteTemplate?.(id);
            }
        });

        // Manage templates button
        document.getElementById('btn-manage-templates')?.addEventListener('click', () => {
            Planner?.showTemplateModal?.();
        });

        // Clear week plan button
        document.getElementById('btn-clear-week')?.addEventListener('click', () => {
            Planner?.clearWeekPlan?.();
        });

        // Save to patient button
        document.getElementById('btn-save-to-patient')?.addEventListener('click', () => {
            Planner?.saveToPatient?.();
        });

        // Template selector change
        document.getElementById('planner-template-select')?.addEventListener('change', () => {
            Planner?.handleTemplateChange?.();
        });

        // Patient selector change
        document.getElementById('planner-patient-select')?.addEventListener('change', () => {
            Planner?.handlePatientSelect?.();
        });
    }

    /**
     * Ingredients event handlers
     */
    function initIngredientsHandlers() {
        const ingredientsTab = document.getElementById('tab-ingredients');
        if (!ingredientsTab) return;

        // Delegate click events in ingredients tab
        ingredientsTab.addEventListener('click', (e) => {
            const target = e.target;

            // Expand ingredient
            if (target.matches('[data-action="toggle-ingredient"]') || 
                target.closest('[data-action="toggle-ingredient"]')) {
                const item = target.closest('.ingredient-item');
                const id = item?.dataset.id;
                if (id) Ingredients?.toggleExpand?.(id);
            }
        });

        // Add ingredient button
        document.getElementById('btn-add-ingredient')?.addEventListener('click', () => {
            Ingredients?.showAddModal?.();
        });

        // Import buttons
        document.getElementById('btn-import-json')?.addEventListener('click', () => {
            Ingredients?.handleImportJSON?.();
        });

        document.getElementById('btn-import-csv')?.addEventListener('click', () => {
            Ingredients?.handleImportCSV?.();
        });

        document.getElementById('btn-export-csv')?.addEventListener('click', () => {
            Ingredients?.handleExportCSV?.();
        });

        // Delete all button
        document.getElementById('btn-delete-all-ingredients')?.addEventListener('click', () => {
            Ingredients?.deleteAllIngredients?.();
        });

        // Search input
        document.getElementById('ingredient-search')?.addEventListener('input', (e) => {
            Ingredients?.handleSearch?.(e.target.value);
        });
    }

    /**
     * Recipes event handlers
     */
    function initRecipesHandlers() {
        const recipesTab = document.getElementById('tab-recipes');
        if (!recipesTab) return;

        // Add recipe button
        document.getElementById('btn-add-recipe')?.addEventListener('click', () => {
            Recipes?.openModal?.(null);
        });

        // Delegate click events in recipes tab
        recipesTab.addEventListener('click', (e) => {
            const target = e.target;
            const card = target.closest('.recipe-card');

            if (card) {
                const id = card.dataset.id;

                // Edit button
                if (target.matches('.btn-edit') || target.closest('.btn-edit')) {
                    Recipes?.openModal?.(id);
                }

                // Delete button
                if (target.matches('.btn-delete') || target.closest('.btn-delete')) {
                    Recipes?.handleDelete?.(id);
                }
            }
        });
    }

    /**
     * Patients event handlers
     */
    function initPatientsHandlers() {
        // Delegate click events for patient actions
        document.addEventListener('click', (e) => {
            const target = e.target;

            // Edit patient button
            if (target.matches('[data-action="edit-patient"]') || 
                target.closest('[data-action="edit-patient"]')) {
                const btn = target.closest('[data-action="edit-patient"]');
                const id = btn?.dataset.patientId;
                if (id) Patients?.showEditModal?.(id);
            }

            // Export patient button
            if (target.matches('[data-action="export-patient"]') || 
                target.closest('[data-action="export-patient"]')) {
                const btn = target.closest('[data-action="export-patient"]');
                const id = btn?.dataset.patientId;
                if (id) Patients?.exportPatient?.(id);
            }

            // Delete patient button
            if (target.matches('[data-action="delete-patient"]') || 
                target.closest('[data-action="delete-patient"]')) {
                const btn = target.closest('[data-action="delete-patient"]');
                const id = btn?.dataset.patientId;
                if (id) Patients?.deletePatient?.(id);
            }

            // Sync patient to billing
            if (target.matches('[data-action="sync-billing"]') || 
                target.closest('[data-action="sync-billing"]')) {
                const btn = target.closest('[data-action="sync-billing"]');
                const id = btn?.dataset.patientId;
                if (id) Patients?.syncPatientToBilling?.(id);
            }

            // Create invoice from patient
            if (target.matches('[data-action="create-invoice"]') || 
                target.closest('[data-action="create-invoice"]')) {
                const btn = target.closest('[data-action="create-invoice"]');
                const id = btn?.dataset.patientId;
                if (id) Patients?.createInvoiceFromPatient?.(id);
            }

            // Open billing system
            if (target.matches('[data-action="open-billing"]') || 
                target.closest('[data-action="open-billing"]')) {
                window.open('/billing', '_blank');
            }
        });

        // Add patient button
        document.getElementById('btn-add-patient')?.addEventListener('click', () => {
            Patients?.showAddModal?.();
        });

        // Patient search
        document.getElementById('patient-search')?.addEventListener('input', (e) => {
            Patients?.handleSearch?.(e.target.value);
        });
    }

    return { init };
})();

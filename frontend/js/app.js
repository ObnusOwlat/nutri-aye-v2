/**
 * app.js - Main Application Entry
 * 
 * Tab navigation, initialization, and
 * global app state management.
 */

const App = (function() {
    // Tab elements
    let tabs, tabContents;

    // Current tab
    let currentTab = 'patients';

    /**
     * Initialize application
     */
    function init() {
        console.log('[App] Starting Nutri Aye...');

        // Cache DOM elements
        tabs = document.querySelectorAll('.tabs__tab');
        tabContents = document.querySelectorAll('.tab-content');

        // Bind events
        bindEvents();

        // Mark current day in planner
        updateTodayMarker();

        // Log initialization complete
        console.log('[App] Initialization complete');

        return {
            version: '1.0.0',
            currentTab
        };
    }

    /**
     * Bind global events
     */
    function bindEvents() {
        // Tab navigation
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                switchTab(tab.dataset.tab);
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboard);

        // Handle visibility change (pause/resume)
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    /**
     * Switch to a tab
     */
    function switchTab(tabId) {
        if (tabId === currentTab) return;

        // Update tab buttons
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });

        // Update tab content
        tabContents.forEach(content => {
            const isTarget = content.id === `tab-${tabId}`;
            content.classList.toggle('active', isTarget);
            
            // Trigger resize event for responsive layouts
            if (isTarget) {
                window.dispatchEvent(new Event('resize'));
            }
        });

        currentTab = tabId;

        // Emit tab change event
        UI.emit('app:tabChanged', { tab: tabId });

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        console.log('[App] Tab switched to:', tabId);
    }

    /**
     * Handle keyboard shortcuts
     */
    function handleKeyboard(e) {
        // Alt + number for quick tab switch
        if (e.altKey && e.key >= '1' && e.key <= '4') {
            e.preventDefault();
            const tabMap = { '1': 'patients', '2': 'planner', '3': 'ingredients', '4': 'recipes' };
            switchTab(tabMap[e.key]);
        }

        // Ctrl/Cmd + S for save (export backup)
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            Sync.createBackup();
        }

        // Ctrl/Cmd + P for print
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            UI.printPage();
        }
    }

    /**
     * Handle page visibility changes
     */
    function handleVisibilityChange() {
        if (document.hidden) {
            console.log('[App] Page hidden');
            // Could pause non-essential processes here
        } else {
            console.log('[App] Page visible');
            // Resume processes, check for updates
            State.emit('state:resumed');
        }
    }

    /**
     * Mark current day in planner
     */
    function updateTodayMarker() {
        // This is handled in planner.js during render
    }

    /**
     * Get app info
     */
    function getInfo() {
        return {
            name: 'Nutri Aye',
            version: '2.0.0',
            features: {
                localFirst: true,
                backendSync: true,
                offlineSupport: true,
                patientManagement: true
            },
            storage: {
                ingredients: State.getIngredients().length,
                recipes: State.getRecipes().length,
                patients: State.getPatients().length
            }
        };
    }

    /**
     * Reset application data
     */
    function reset() {
        UI.confirmDanger(
            'This will delete ALL your data including ingredients, recipes, meal plans, and patients. This cannot be undone!',
            () => {
                // Clear all localStorage keys
                const keys = [
                    'mp_ingredients_v1', 'mp_dishes_v3', 'mp_week_v3', 'mp_diet_v3',
                    'mp_patients_v1', 'mp_patient_metrics_v1', 'mp_patient_conditions_v1',
                    'mp_patient_plans_v1', 'mp_patient_progress_v1'
                ];
                keys.forEach(key => localStorage.removeItem(key));

                // Reload page
                window.location.reload();
            }
        );
    }

    // ==========================================
    // PUBLIC API
    // ==========================================

    return {
        init,
        switchTab,
        getInfo,
        reset,
        get currentTab() {
            return currentTab;
        }
    };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Also run module initializers
document.addEventListener('DOMContentLoaded', () => {
    // Modules are initialized via their own DOMContentLoaded listeners
    // This ensures proper order of initialization
});

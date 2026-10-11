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
    let currentTab = null; // set by the first switchTab

    /**
     * Initialize application
     */
    function init() {

        // Cache DOM elements
        tabs = document.querySelectorAll('.tabs__tab');
        tabContents = document.querySelectorAll('.tab-content');

        // ?tab=planner opens that tab (only existing tabs)
        const tabParam = new URLSearchParams(window.location.search).get('tab');
        const initialTab = [...tabs].some(t => t.dataset.tab === tabParam) ? tabParam : 'patients';

        bindEvents();
        switchTab(initialTab);

        // Mark current day in planner
        updateTodayMarker();

        // Clear URL params after reading
        if (tabParam) {
            window.history.replaceState({}, '', window.location.pathname);
        }

        // Log initialization complete

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

    }

    /**
     * Handle keyboard shortcuts
     */
    function handleKeyboard(e) {
        // Alt + number for quick tab switch
        if (e.altKey && e.key >= '1' && e.key <= '6') {
            e.preventDefault();
            const tabMap = { '1': 'patients', '2': 'planner', '3': 'ingredients', '4': 'recipes', '5': 'billing', '6': 'activity' };
            switchTab(tabMap[e.key]);
        }

        // Ctrl/Cmd + S: download the consultorio's backup (admins)
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (Auth.current()?.role === 'admin') window.location.href = '/api/backup/export';
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
            // Could pause non-essential processes here
        } else {
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

    // ==========================================
    // PUBLIC API
    // ==========================================

    return {
        init,
        switchTab,
        getInfo,
        get currentTab() {
            return currentTab;
        }
    };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

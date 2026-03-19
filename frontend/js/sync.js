/**
 * sync.js - Backend Sync Layer
 * 
 * Optional backend synchronization with
 * graceful fallback to localStorage.
 */

const Sync = (function() {
    const CONFIG = {
        API_BASE: '/api',
        TIMEOUT: 10000,
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000
    };

    let isOnline = navigator.onLine;
    let isSyncing = false;
    let lastSyncTime = null;

    /**
     * Initialize sync module
     */
    function init() {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        document.getElementById('btn-sync')?.addEventListener('click', manualSync);
        updateSyncStatus();
        console.log('[Sync] Initialized, online:', isOnline);
    }

    /**
     * Handle online/offline
     */
    const handleOnline = () => {
        isOnline = true;
        updateSyncStatus();
        UI.toastSuccess('Back online');
        manualSync();
    };

    const handleOffline = () => {
        isOnline = false;
        updateSyncStatus();
        UI.toastWarning('You are offline. Changes saved locally.');
    };

    /**
     * Update sync button status
     */
    function updateSyncStatus() {
        const btn = document.getElementById('btn-sync');
        if (!btn) return;

        btn.classList.toggle('btn--secondary', isOnline);
        btn.classList.toggle('btn--disabled', !isOnline || isSyncing);

        const icon = btn.querySelector('.btn__icon');
        if (icon) icon.textContent = isSyncing ? '↻' : (isOnline ? '✓' : '✕');
    }

    /**
     * Manual sync trigger
     */
    async function manualSync() {
        if (isSyncing) {
            UI.toastInfo('Sync already in progress');
            return;
        }
        if (!isOnline) {
            UI.toastWarning('You are offline. Cannot sync.');
            return;
        }

        try {
            await pushToBackend();
            await pullFromBackend();
            lastSyncTime = new Date().toISOString();
            UI.toastSuccess('Sync completed');
        } catch (error) {
            console.error('[Sync] Error:', error);
            UI.toastError('Sync failed: ' + error.message);
        }
    }

    /**
     * Push local data to backend
     */
    async function pushToBackend() {
        isSyncing = true;
        updateSyncStatus();

        try {
            const response = await fetchWithTimeout(`${CONFIG.API_BASE}/sync/push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(State.exportData())
            });

            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('[Sync] Push failed:', error);
            throw error;
        } finally {
            isSyncing = false;
            updateSyncStatus();
        }
    }

    /**
     * Pull data from backend
     */
    async function pullFromBackend() {
        const response = await fetchWithTimeout(`${CONFIG.API_BASE}/sync/pull`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        const data = await response.json();
        if (data && Object.keys(data).length > 0) mergeData(data);
        return data;
    }

    /**
     * Merge server data with local data (last-write-wins)
     */
    function mergeData(serverData) {
        const localData = State.exportData();
        State.importData({
            version: serverData.version || localData.version,
            ingredients: mergeArrays(localData.ingredients, serverData.ingredients),
            recipes: mergeArrays(localData.recipes, serverData.recipes),
            weekPlan: serverData.weekPlan || localData.weekPlan,
            dietProfile: serverData.dietProfile || localData.dietProfile
        });
    }

    /**
     * Merge two arrays by ID (latest updatedAt wins)
     */
    const mergeArrays = (local, server) => {
        const map = new Map((local || []).map(item => [item.id, item]));
        (server || []).forEach(item => {
            const existing = map.get(item.id);
            if (!existing || new Date(item.updatedAt) > new Date(existing.updatedAt)) {
                map.set(item.id, item);
            }
        });
        return Array.from(map.values());
    };

    /**
     * Fetch with timeout
     */
    const fetchWithTimeout = (url, options = {}) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Request timeout')), CONFIG.TIMEOUT);
        fetch(url, options).then(r => { clearTimeout(timer); resolve(r); }).catch(e => { clearTimeout(timer); reject(e); });
    });

    /**
     * Create backup (export to JSON)
     */
    function createBackup() {
        const blob = new Blob([JSON.stringify(State.exportData(), null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `meal-prep-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        UI.toastSuccess('Backup created');
    }

    /**
     * Restore from backup
     */
    function restoreBackup() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const data = JSON.parse(await file.text());
                UI.confirm('This will replace all your current data. Continue?', () => {
                    State.importData(data);
                    UI.toastSuccess('Backup restored');
                });
            } catch { UI.toastError('Invalid backup file'); }
        };
        input.click();
    }

    /**
     * Check if backend is available
     */
    async function checkBackendHealth() {
        try {
            const response = await fetchWithTimeout(`${CONFIG.API_BASE}/health`, { method: 'GET' });
            return response.ok;
        } catch { return false; }
    }

    return {
        init,
        manualSync,
        createBackup,
        restoreBackup,
        checkBackendHealth,
        getStatus: () => ({ isOnline, isSyncing, lastSyncTime })
    };
})();

document.addEventListener('DOMContentLoaded', () => Sync.init());

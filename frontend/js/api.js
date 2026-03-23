/**
 * API Service - Frontend communication with normalized backend
 * 
 * Uses the REST API for:
 * - Search with filtering (uses database indexes)
 * - Pagination
 * - Real-time data sync
 */

const API = (function() {
    const BASE_URL = ''; // Uses same origin (backend serves static files)
    
    // Cache for search results
    const cache = new Map();
    const CACHE_TTL = 30000; // 30 seconds

    async function request(endpoint, options = {}) {
        const url = `${BASE_URL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error(`[API] ${options.method || 'GET'} ${endpoint}:`, error);
            throw error;
        }
    }

    // ==========================================
    // INGREDIENTS API
    // ==========================================

    async function getIngredients(params = {}) {
        const query = new URLSearchParams();
        
        if (params.search) query.set('search', params.search);
        if (params.category) query.set('category', params.category);
        if (params.page) query.set('page', params.page);
        if (params.limit) query.set('limit', params.limit);
        if (params.sort) query.set('sort', params.sort);
        if (params.order) query.set('order', params.order);

        const key = query.toString() || 'all';
        const cached = cache.get(`ingredients:${key}`);
        
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }

        try {
            const result = await request(`/api/ingredients?${query.toString()}`);
            cache.set(`ingredients:${key}`, { data: result, timestamp: Date.now() });
            return result;
        } catch (error) {
            console.warn('[API] Falling back to localStorage for ingredients');
            return null;
        }
    }

    async function getIngredient(id) {
        try {
            const result = await request(`/api/ingredients/${id}`);
            return result.data;
        } catch (error) {
            return null;
        }
    }

    async function searchIngredients(query) {
        const result = await getIngredients({ search: query, limit: 20 });
        return result?.data || [];
    }

    async function createIngredient(data) {
        const result = await request('/api/ingredients', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        invalidateCache('ingredients');
        return result.data;
    }

    async function updateIngredient(id, data) {
        const result = await request(`/api/ingredients/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        invalidateCache('ingredients');
        return result.data;
    }

    async function deleteIngredient(id) {
        await request(`/api/ingredients/${id}`, { method: 'DELETE' });
        invalidateCache('ingredients');
    }

    async function bulkImportIngredients(ingredients) {
        const result = await request('/api/ingredients/bulk', {
            method: 'POST',
            body: JSON.stringify({ ingredients })
        });
        invalidateCache('ingredients');
        return result;
    }

    // ==========================================
    // RECIPES API
    // ==========================================

    async function getRecipes(params = {}) {
        const query = new URLSearchParams();
        
        if (params.search) query.set('search', params.search);
        if (params.category) query.set('category', params.category);
        if (params.page) query.set('page', params.page);
        if (params.limit) query.set('limit', params.limit);

        try {
            return await request(`/api/recipes?${query.toString()}`);
        } catch (error) {
            return null;
        }
    }

    async function searchRecipes(query) {
        const result = await getRecipes({ search: query, limit: 20 });
        return result?.data || [];
    }

    async function getRecipe(id) {
        try {
            const result = await request(`/api/recipes/${id}`);
            return result.data;
        } catch (error) {
            return null;
        }
    }

    async function createRecipe(data) {
        const result = await request('/api/recipes', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        invalidateCache('recipes');
        return result.data;
    }

    async function updateRecipe(id, data) {
        const result = await request(`/api/recipes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        invalidateCache('recipes');
        return result.data;
    }

    async function deleteRecipe(id) {
        await request(`/api/recipes/${id}`, { method: 'DELETE' });
        invalidateCache('recipes');
    }

    // ==========================================
    // PATIENTS API
    // ==========================================

    async function getPatients(params = {}) {
        const query = new URLSearchParams();
        
        if (params.search) query.set('search', params.search);
        if (params.page) query.set('page', params.page);
        if (params.limit) query.set('limit', params.limit);

        try {
            return await request(`/api/patients?${query.toString()}`);
        } catch (error) {
            return null;
        }
    }

    async function searchPatients(query) {
        const result = await getPatients({ search: query });
        return result?.data || [];
    }

    async function getPatient(id) {
        try {
            const result = await request(`/api/patients/${id}`);
            return result.data;
        } catch (error) {
            return null;
        }
    }

    async function getPatientAllergies(id) {
        try {
            const result = await request(`/api/patients/${id}/allergies`);
            return result.data || [];
        } catch (error) {
            return [];
        }
    }

    async function createPatient(data) {
        const result = await request('/api/patients', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        invalidateCache('patients');
        return result.data;
    }

    async function updatePatient(id, data) {
        const result = await request(`/api/patients/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        invalidateCache('patients');
        return result.data;
    }

    async function deletePatient(id) {
        await request(`/api/patients/${id}`, { method: 'DELETE' });
        invalidateCache('patients');
    }

    async function addPatientMetric(patientId, data) {
        const result = await request(`/api/patients/${patientId}/metrics`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return result.data;
    }

    async function addPatientCondition(patientId, data) {
        const result = await request(`/api/patients/${patientId}/conditions`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return result.data;
    }

    // ==========================================
    // BACKUP/SYNC API
    // ==========================================

    async function exportBackup() {
        return await request('/api/backup/export');
    }

    async function importBackup(data) {
        const result = await request('/api/backup/import', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        // Invalidate all caches
        cache.clear();
        return result;
    }

    async function getStats() {
        try {
            const result = await request('/api/stats');
            return result.stats;
        } catch (error) {
            return null;
        }
    }

    // ==========================================
    // HEALTH CHECK
    // ==========================================

    async function checkHealth() {
        try {
            const result = await request('/api/health');
            return result.status === 'ok';
        } catch (error) {
            return false;
        }
    }

    // ==========================================
    // CACHE MANAGEMENT
    // ==========================================

    function invalidateCache(type) {
        for (const key of cache.keys()) {
            if (key.startsWith(`${type}:`)) {
                cache.delete(key);
            }
        }
    }

    function clearCache() {
        cache.clear();
    }

    return {
        // Ingredients
        getIngredients,
        getIngredient,
        searchIngredients,
        createIngredient,
        updateIngredient,
        deleteIngredient,
        bulkImportIngredients,
        
        // Recipes
        getRecipes,
        searchRecipes,
        getRecipe,
        createRecipe,
        updateRecipe,
        deleteRecipe,
        
        // Patients
        getPatients,
        searchPatients,
        getPatient,
        getPatientAllergies,
        createPatient,
        updatePatient,
        deletePatient,
        addPatientMetric,
        addPatientCondition,
        
        // Backup/Sync
        exportBackup,
        importBackup,
        getStats,
        
        // Utility
        checkHealth,
        invalidateCache,
        clearCache
    };
})();

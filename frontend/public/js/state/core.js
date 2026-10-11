/**
 * state/core.js - In-memory copy of the consultorio's data, loaded from the
 * server after login. Nothing is kept in the browser: every change is sent to
 * the server first and the copy is updated with its answer.
 *
 * The other state/*.js files add their functions to State (Object.assign).
 */

const State = (function() {
    const data = {
        ingredients: [], recipes: [], patients: [], patientMetrics: [], patientConditions: [],
        patientPlans: [], patientProgress: [], dietTemplates: []
    };
    const listeners = {};
    const indexes = {}; // list name -> Map(id -> item), rebuilt after a change
    let ready = false;

    const subscribe = (event, callback) => {
        (listeners[event] = listeners[event] || []).push(callback);
        return () => { listeners[event] = listeners[event].filter(cb => cb !== callback); };
    };

    const emit = (event, payload) => {
        (listeners[event] || []).forEach(cb => cb(payload));
        (listeners['*'] || []).forEach(cb => cb({ event, data: payload }));
    };

    // Calls the API; throws an Error with the server's message (in Spanish) on failure
    async function api(method, path, body) {
        const res = await fetch(path, {
            method,
            headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
            body: body !== undefined ? JSON.stringify(body) : undefined
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) throw new Error(json.error || `Error del servidor (${res.status})`);
        return json.data;
    }

    // Collection helpers used by the other state files
    const find = (list, id) => {
        if (!id) return null;
        if (!indexes[list]) indexes[list] = new Map(data[list].map(item => [item.id, item]));
        return indexes[list].get(id) || null;
    };
    const put = (list, item) => {
        const i = data[list].findIndex(x => x.id === item.id);
        if (i === -1) data[list].push(item); else data[list][i] = item;
        delete indexes[list];
        return item;
    };
    const drop = (list, id) => {
        data[list] = data[list].filter(x => x.id !== id);
        delete indexes[list];
    };
    const replaceAll = (list, items) => {
        data[list] = items;
        delete indexes[list];
    };

    const today = () => new Date().toISOString().split('T')[0];

    const calculateAge = (dob) => {
        if (!dob) return null;
        const now = new Date(), birth = new Date(dob);
        let age = now.getFullYear() - birth.getFullYear();
        const m = now.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
        return age;
    };
    const calculateBMI = (w, h) => (w && h ? w / Math.pow(h / 100, 2) : null);
    const getBMICategory = (bmi) => (bmi < 18.5 ? 'underweight' : bmi < 25 ? 'normal' : bmi < 30 ? 'overweight' : 'obese');

    /**
     * Loads everything from the server and tells every screen to redraw.
     * Each state file can register a hook that prepares its part (onLoad).
     */
    const loadHooks = [];
    async function load() {
        const [all, labels] = await Promise.all([api('GET', '/api/bootstrap'), api('GET', '/api/labels')]);
        State.labels = labels;
        Object.assign(State.MEAL_LABELS, labels.mealType);
        Object.assign(State.DAY_LABELS, labels.day);
        for (const list of Object.keys(data)) replaceAll(list, all[list] || []);
        loadHooks.forEach(hook => hook());
        ready = true;
        emit('state:ready');
        for (const event of ['ingredients', 'recipes', 'patients', 'dietTemplates']) emit(`${event}:updated`, data[event]);
    }

    document.addEventListener('DOMContentLoaded', () => {
        Auth.ready.then(load).catch(error => {
            console.error('[State] Load error:', error);
            UI.toastError('No se pudieron cargar los datos: ' + error.message);
        });
    });

    return {
        ...StateConstants,
        subscribe, emit, load, isReady: () => ready, calculateAge, calculateBMI, getBMICategory,
        // For the other state files only
        _data: data, _api: api, _find: find, _put: put, _drop: drop, _replaceAll: replaceAll, _today: today,
        _onLoad: (hook) => loadHooks.push(hook)
    };
})();

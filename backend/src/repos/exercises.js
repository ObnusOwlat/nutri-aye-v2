// Exercise catalog (wger, CC-BY-SA) and physical activities with MET values
// (2024 Compendium of Physical Activities). Both are global, read-only files in
// foods-data/exercises/ (refreshed with import-wger.js), kept in memory.
const fs = require('fs');
const path = require('path');
const { unaccent } = require('../db/connection');

const DIR = path.join(__dirname, '..', '..', '..', 'foods-data', 'exercises');
const VO2_ADULT = 3.5;   // ml O2/kg/min of 1 MET (19-59 years)
const VO2_OLDER = 2.7;   // ml O2/kg/min of 1 MET60 (60 years or more)
// wger category -> activity used to estimate its energy cost
const ACTIVITY_OF_CATEGORY = { 15: 'calistenia_intensa' };
const DEFAULT_ACTIVITY = 'pesas_general';

let catalog = null;
function load() {
    if (catalog) return catalog;
    const wger = JSON.parse(fs.readFileSync(path.join(DIR, 'wger-exercises.json'), 'utf8'));
    const met = JSON.parse(fs.readFileSync(path.join(DIR, 'met-compendium.json'), 'utf8'));
    // Spanish names first, then the ones still in English
    const exercises = [...wger.exercises].sort((a, b) => b.translated - a.translated).map(e => ({
        ...e,
        activityId: ACTIVITY_OF_CATEGORY[e.categoryId] || DEFAULT_ACTIVITY,
        search: unaccent(`${e.name} ${e.nameEn || ''}`)
    }));
    const unique = (list) => [...new Set(list)].sort((a, b) => a.localeCompare(b, 'es'));
    catalog = {
        exercises,
        filters: {
            categories: unique(exercises.map(e => e.category)),
            muscles: unique(exercises.flatMap(e => [...e.muscles, ...e.musclesSecondary])),
            equipment: unique(exercises.flatMap(e => e.equipment))
        },
        activities: met.activities,
        activityById: new Map(met.activities.map(a => [a.id, a])),
        sources: { exercises: { source: wger.source, license: wger.license }, activities: { source: met.source, reference: met.reference, notes: met.notes } }
    };
    return catalog;
}

// Without the internal search text
function publicExercise(exercise) {
    const copy = { ...exercise };
    delete copy.search;
    return copy;
}

function listExercises({ search = '', category = '', muscle = '', equipment = '', limit, offset }) {
    const { exercises } = load();
    const words = unaccent(search).split(/\s+/).filter(Boolean);
    const rows = exercises.filter(e =>
        words.every(w => e.search.includes(w)) &&
        (!category || e.category === category) &&
        (!muscle || e.muscles.includes(muscle) || e.musclesSecondary.includes(muscle)) &&
        (!equipment || e.equipment.includes(equipment)));
    return { rows: rows.slice(offset, offset + limit).map(publicExercise), total: rows.length };
}

const filters = () => load().filters;
const sources = () => load().sources;
const listActivities = () => load().activities;
const getActivity = (id) => load().activityById.get(id) || null;

/**
 * Estimated kcal of an activity: MET x VO2 x kg x minutes / 200.
 * From 60 years the Older Adult Compendium value (MET60) is used when it exists.
 */
function estimateKcal(activity, { minutes, weightKg, age = null }) {
    const older = age != null && age >= 60 && activity.older;
    const { met, code } = older ? activity.older : activity.adult;
    const vo2 = older ? VO2_OLDER : VO2_ADULT;
    return {
        activityId: activity.id, name: activity.name, minutes, weightKg, age,
        met, code, table: older ? 'Compendio 60+ (2024)' : 'Compendio adultos (2024)',
        kcal: Math.round(met * vo2 * weightKg * minutes / 200)
    };
}

module.exports = { listExercises, filters, sources, listActivities, getActivity, estimateKcal };

/**
 * planner-energy.js - Energy of the planner's activity week and what the
 * patient needs each day, to compare with what the meal plan gives.
 *   Activity: MET (2024 Compendium, 60+ table from 60 years) x VO2 x kg x min / 200
 *   (same formula as GET /api/activities/kcal). Strength: sets x (reps x 3 s + rest).
 *   Need of the day: Mifflin-St Jeor x 1,2 (rest of the day) + activity of the day.
 */

const PlannerEnergy = (function() {
    const SECONDS_PER_REP = 3;
    const BASE_FACTOR = 1.2; // the day without the planned activity (sedentary)
    let activities = new Map();
    let loading = null;

    // Strength or cardio exercises: the intensity picks the MET row
    const BY_INTENSITY = {
        pesas_general: { low: 'pesas_general', moderate: 'sentadillas_peso_muerto', high: 'pesas_intensas' },
        calistenia_intensa: { low: 'calistenia_moderada', moderate: 'circuito', high: 'calistenia_intensa' }
    };

    function load() {
        if (!loading) {
            loading = State._api('GET', '/api/activities')
                .then(list => { activities = new Map(list.map(a => [a.id, a])); State.emit('activities:loaded'); return list; })
                .catch(error => { loading = null; throw error; });
        }
        return loading;
    }
    const list = () => [...activities.values()];
    const getActivity = (id) => activities.get(id) || null;

    // Patient data for the formulas, or null fields when unknown
    function person(patientId) {
        const context = patientId ? State.getPatientContext(patientId) : null;
        if (!context) return null;
        const p = context.patient, m = context.latestMetrics || {};
        return { weight: m.weight || null, height: m.height || null, age: State.calculateAge(p.dateOfBirth), sex: p.gender };
    }

    function minutesOf(item) {
        if (item.kind === 'exercise' && item.sets && item.reps) {
            return item.sets * (item.reps * SECONDS_PER_REP + (item.restSec ?? 60)) / 60;
        }
        return item.minutes || 0;
    }

    function metRowOf(item) {
        const byLevel = item.kind === 'exercise' && BY_INTENSITY[item.activityId];
        return getActivity(byLevel ? byLevel[item.intensity || 'moderate'] : item.activityId);
    }

    // kcal of one item for a person, or null when the weight is unknown
    function itemKcal(item, who) {
        const row = metRowOf(item);
        if (!row || !who?.weight) return null;
        const older = who.age != null && who.age >= 60 && row.older;
        const met = older ? row.older.met : row.adult.met;
        return Math.round(met * (older ? 2.7 : 3.5) * who.weight * minutesOf(item) / 200);
    }

    const dayKcal = (day, who) => State.getDayActivities(day).reduce((sum, i) => sum + (itemKcal(i, who) || 0), 0);

    // Mifflin-St Jeor resting energy (kcal/day) or null
    function restingEnergy(who) {
        if (!who?.weight || !who.height || who.age == null || !['male', 'female'].includes(who.sex)) return null;
        return 10 * who.weight + 6.25 * who.height - 5 * who.age + (who.sex === 'male' ? 5 : -161);
    }

    // { need, ree, activity } for a day; need null when data is missing
    function dayNeed(day, who) {
        const ree = restingEnergy(who);
        const activity = dayKcal(day, who);
        return { ree, activity, need: ree == null ? null : Math.round(ree * BASE_FACTOR + activity) };
    }

    return { load, list, getActivity, person, minutesOf, itemKcal, dayKcal, restingEnergy, dayNeed, BASE_FACTOR };
})();

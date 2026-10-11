// Example routines every consultorio gets once (they can be edited or
// deactivated like any other). Activities are 2024 Compendium MET ids and
// exercises are wger ids (foods-data/exercises).
const activity = (refId, name, minutes, intensity = null) => ({ kind: 'activity', refId, name, activityId: refId, minutes, ...(intensity ? { intensity } : {}) });
const exercise = (refId, name, sets = 3, reps = 12) => ({ kind: 'exercise', refId: String(refId), name, activityId: 'pesas_general', sets, reps, restSec: 60, intensity: 'moderate' });

const walk = [activity('caminar_moderado', 'Caminar a paso moderado (4,5-5 km/h)', 30)];
const stretch = activity('estiramientos', 'Estiramientos suaves', 10);
const upper = [exercise(73, 'Press de Banca'), exercise(81, 'Remo con mancuernas'), exercise(566, 'Press de hombros con barra'), exercise(355, 'Jalón al pecho'), stretch];
const lower = [exercise(1312, 'Sentadilla con peso corporal'), exercise(1324, 'Zancada con el peso corporal'), exercise(1003, 'Peso Muerto con Kettlebell'), exercise(167, 'Abdominales', 3, 15), stretch];

const EXAMPLES = [
    {
        name: 'Caminata 5 días', level: 'beginner',
        description: '30 minutos de caminata de lunes a viernes. Base para empezar a moverse.',
        plan: { monday: walk, tuesday: walk, wednesday: walk, thursday: walk, friday: walk }
    },
    {
        name: 'Inicio suave', level: 'beginner',
        description: 'Para personas sedentarias o mayores: caminata lenta y estiramientos 3 veces por semana.',
        plan: Object.fromEntries(['monday', 'wednesday', 'friday'].map(d => [d, [activity('caminar_lento', 'Caminar lento (3-4 km/h)', 20), stretch]]))
    },
    {
        name: 'Fuerza 3 días (cuerpo completo)', level: 'intermediate',
        description: 'Lunes, miércoles y viernes: ejercicios de fuerza alternando tren superior e inferior.',
        plan: { monday: upper, wednesday: lower, friday: upper }
    },
    {
        name: 'Fuerza y cardio 5 días', level: 'intermediate',
        description: 'Fuerza lunes, miércoles y viernes; bicicleta fija martes y jueves.',
        plan: {
            monday: upper, wednesday: lower, friday: upper,
            tuesday: [activity('bici_fija', 'Bicicleta fija, general', 30)], thursday: [activity('bici_fija', 'Bicicleta fija, general', 30)]
        }
    }
];

module.exports = { EXAMPLES };

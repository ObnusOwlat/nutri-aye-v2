// Weekly physical-activity plan: per day, a list of exercises (wger, strength:
// sets x reps x kg + rest) or activities (Compendium MET: minutes + intensity)
const { z } = require('./index');
const { DAYS } = require('../constants');

const INTENSITIES = ['low', 'moderate', 'high'];

const activityItem = z.object({
    id: z.string().max(64),
    kind: z.enum(['exercise', 'activity']),
    refId: z.string().max(64),              // wger exercise id or MET activity id
    name: z.string().trim().min(1).max(200),
    activityId: z.string().max(64),         // MET activity used for the energy estimate
    sets: z.coerce.number().int().min(1).max(20).nullish(),
    reps: z.coerce.number().int().min(1).max(200).nullish(),
    weightKg: z.coerce.number().min(0).max(500).nullish(),
    restSec: z.coerce.number().int().min(0).max(900).nullish(),
    minutes: z.coerce.number().min(1).max(600).nullish(),
    intensity: z.enum(INTENSITIES).nullish(),
    notes: z.string().max(300).nullish()
});

const activityPlan = z.record(z.enum(DAYS), z.array(activityItem).max(30));

module.exports = { activityPlan, activityItem, INTENSITIES };

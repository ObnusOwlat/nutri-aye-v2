// Database rows (snake_case) -> API objects (camelCase)
const { NUTRIENT_FIELDS } = require('./nutrient-fields');

// Generic row -> camelCase keys (billing, planner); integer flags stay numbers
const camelKey = (k) => k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
function camelizeRow(row) {
    if (!row) return null;
    return Object.fromEntries(Object.entries(row).map(([k, v]) => [camelKey(k), v]));
}

function transformIngredient(row) {
    if (!row) return null;
    const ingredient = {
        id: row.id,
        name: row.name,
        category: row.category || row.category_id,
        categoryDisplay: row.category_display,
        unit: row.unit_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        nameEn: row.name_en,
        source: row.source,
        fdcId: row.fdc_id,
        sourceCategory: row.source_category
    };
    for (const { column, key } of NUTRIENT_FIELDS) ingredient[key] = row[column];
    return ingredient;
}

function transformRecipe(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        category: row.category || row.category_id,
        categoryDisplay: row.category_display,
        instructions: row.instructions,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        nutrition: {
            calories: row.total_calories || 0,
            protein: row.total_protein || 0,
            carbs: row.total_carbs || 0,
            fat: row.total_fat || 0
        }
    };
}

function transformPatient(row) {
    if (!row) return null;
    return {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        dateOfBirth: row.date_of_birth,
        gender: row.gender,
        address: {
            street: row.street,
            city: row.city,
            zipCode: row.zip_code
        },
        emergencyContact: {
            name: row.emergency_name,
            phone: row.emergency_phone,
            relation: row.emergency_relation
        },
        notes: row.notes,
        photo: row.photo,
        status: row.status,
        billingClientId: row.billing_client_id,  // Integration: billing link
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function transformMetric(row) {
    if (!row) return null;
    return {
        id: row.id,
        patientId: row.patient_id,
        date: row.date,
        weight: row.weight,
        height: row.height,
        bmi: row.bmi,
        bmiCategory: row.bmi_category,
        bodyFat: row.body_fat,
        muscleMass: row.muscle_mass,
        waist: row.waist,
        chest: row.chest,
        hips: row.hips,
        activityLevel: row.activity_level,
        notes: row.notes,
        createdAt: row.created_at
    };
}

function transformCondition(row) {
    if (!row) return null;
    return {
        id: row.id,
        patientId: row.patient_id,
        type: row.type,
        name: row.name,
        severity: row.severity,
        description: row.description,
        dietaryNotes: row.dietary_notes,
        medications: row.medications,
        createdAt: row.created_at
    };
}

module.exports = { camelizeRow, transformIngredient, transformRecipe, transformPatient, transformMetric, transformCondition };

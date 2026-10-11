// Database rows (snake_case) -> API objects (camelCase)

// DATA TRANSFORMATIONS (snake_case → camelCase)
// ==========================================

function transformIngredient(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        category: row.category || row.category_id,
        categoryDisplay: row.category_display,
        unit: row.unit_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        kcalPer100g: row.kcal_per_100g,
        proteinPer100g: row.protein_per_100g,
        carbsPer100g: row.carbs_per_100g,
        fatPer100g: row.fat_per_100g,
        saturatedFatPer100g: row.saturated_fat_per_100g,
        polyunsaturatedFatPer100g: row.polyunsaturated_fat_per_100g,
        monounsaturatedFatPer100g: row.monounsaturated_fat_per_100g,
        sugarPer100g: row.sugar_per_100g,
        fiberPer100g: row.fiber_per_100g,
        cholesterolPer100g: row.cholesterol_per_100g,
        sodiumPer100g: row.sodium_per_100g,
        vitaminAPer100g: row.vitamin_a_per_100g,
        vitaminB1Per100g: row.vitamin_b1_per_100g,
        vitaminB2Per100g: row.vitamin_b2_per_100g,
        vitaminB3Per100g: row.vitamin_b3_per_100g,
        vitaminB5Per100g: row.vitamin_b5_per_100g,
        vitaminB6Per100g: row.vitamin_b6_per_100g,
        vitaminB9Per100g: row.vitamin_b9_per_100g,
        vitaminB12Per100g: row.vitamin_b12_per_100g,
        vitaminCPer100g: row.vitamin_c_per_100g,
        vitaminDPer100g: row.vitamin_d_per_100g,
        vitaminEPer100g: row.vitamin_e_per_100g,
        vitaminKPer100g: row.vitamin_k_per_100g,
        magnesiumPer100g: row.magnesium_per_100g,
        calciumPer100g: row.calcium_per_100g,
        phosphorusPer100g: row.phosphorus_per_100g,
        potassiumPer100g: row.potassium_per_100g,
        ironPer100g: row.iron_per_100g,
        seleniumPer100g: row.selenium_per_100g,
        zincPer100g: row.zinc_per_100g,
        manganesePer100g: row.manganese_per_100g,
        copperPer100g: row.copper_per_100g,
        nameEn: row.name_en,
        source: row.source,
        fdcId: row.fdc_id,
        sourceCategory: row.source_category
    };
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

module.exports = { transformIngredient, transformRecipe, transformPatient, transformMetric, transformCondition };

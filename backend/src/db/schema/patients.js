// Patients and their metrics, conditions, plans and progress

function createPatientTables(db) {
    // ==========================================
    // PATIENTS (1NF - Atomic values)
    // ==========================================
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS patients (
            id TEXT PRIMARY KEY,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            date_of_birth TEXT,
            gender TEXT,
            street TEXT DEFAULT '',
            city TEXT DEFAULT '',
            zip_code TEXT DEFAULT '',
            emergency_name TEXT DEFAULT '',
            emergency_phone TEXT DEFAULT '',
            emergency_relation TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            photo TEXT,
            status TEXT DEFAULT 'active',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        
        CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(first_name COLLATE NOCASE, last_name COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
    `);

    // ==========================================
    // PATIENT_METRICS (2NF - Depends on patient PK)
    // ==========================================
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS patient_metrics (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            date TEXT NOT NULL,
            weight REAL,
            height REAL,
            bmi REAL,
            bmi_category TEXT,
            body_fat REAL,
            muscle_mass REAL,
            waist REAL,
            chest REAL,
            hips REAL,
            activity_level TEXT DEFAULT 'moderate',
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        
        CREATE INDEX IF NOT EXISTS idx_patient_metrics_patient ON patient_metrics(patient_id);
        CREATE INDEX IF NOT EXISTS idx_patient_metrics_date ON patient_metrics(patient_id, date DESC);
    `);

    // ==========================================
    // PATIENT_CONDITIONS (2NF - Allergen tracking)
    // ==========================================
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS patient_conditions (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            severity TEXT DEFAULT 'mild',
            description TEXT DEFAULT '',
            dietary_notes TEXT DEFAULT '',
            medications TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        
        CREATE INDEX IF NOT EXISTS idx_patient_conditions_patient ON patient_conditions(patient_id);
        CREATE INDEX IF NOT EXISTS idx_patient_conditions_type ON patient_conditions(type);
    `);

    // ==========================================
    // PATIENT_PLANS (2NF - Depends on patient PK)
    // ==========================================
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS patient_plans (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            diet_goal TEXT DEFAULT 'maintenance',
            daily_target INTEGER DEFAULT 2000,
            start_date TEXT NOT NULL,
            end_date TEXT,
            notes TEXT DEFAULT '',
            status TEXT DEFAULT 'active',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        
        CREATE INDEX IF NOT EXISTS idx_patient_plans_patient ON patient_plans(patient_id);
        CREATE INDEX IF NOT EXISTS idx_patient_plans_status ON patient_plans(patient_id, status);
    `);

    // ==========================================
    // PATIENT_PLAN_MEALS (2NF - Junction)
    // ==========================================
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS patient_plan_meals (
            id TEXT PRIMARY KEY,
            patient_plan_id TEXT NOT NULL REFERENCES patient_plans(id) ON DELETE CASCADE,
            day_of_week TEXT NOT NULL,
            meal_type TEXT NOT NULL,
            recipe_id TEXT REFERENCES recipes(id),
            UNIQUE(patient_plan_id, day_of_week, meal_type)
        );
        
        CREATE INDEX IF NOT EXISTS idx_patient_plan_meals_plan ON patient_plan_meals(patient_plan_id);
        CREATE INDEX IF NOT EXISTS idx_patient_plan_meals_recipe ON patient_plan_meals(recipe_id);
    `);

    // ==========================================
    // PATIENT_PROGRESS (2NF - Depends on patient PK)
    // ==========================================
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS patient_progress (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            date TEXT NOT NULL,
            weight REAL,
            adherence INTEGER DEFAULT 0,
            energy_level INTEGER DEFAULT 5,
            sleep_quality INTEGER DEFAULT 5,
            mood INTEGER DEFAULT 5,
            symptoms TEXT DEFAULT '[]',
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        
        CREATE INDEX IF NOT EXISTS idx_patient_progress_patient ON patient_progress(patient_id);
        CREATE INDEX IF NOT EXISTS idx_patient_progress_date ON patient_progress(patient_id, date DESC);
    `);
}

module.exports = { createPatientTables };

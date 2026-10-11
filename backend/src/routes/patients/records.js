// Patient metrics, conditions and allergies
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../db/connection');
const { serverError } = require('../../lib/errors');
const { transformMetric, transformCondition } = require('../../transforms');

const router = express.Router();

router.post('/api/patients/:id/metrics', (req, res) => {
    try {
        const id = uuidv4();
        const d = req.body;

        db.prepare(`
            INSERT INTO patient_metrics (id, patient_id, date, weight, height, bmi, bmi_category,
                body_fat, muscle_mass, waist, chest, hips, activity_level, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.id, d.date || new Date().toISOString().split('T')[0],
            d.weight, d.height, d.bmi, d.bmiCategory,
            d.bodyFat, d.muscleMass, d.waist, d.chest, d.hips,
            d.activityLevel || 'moderate', d.notes || ''
        );

        const metric = db.prepare('SELECT * FROM patient_metrics WHERE id = ?').get(id);
        res.json({ success: true, data: transformMetric(metric) });
    } catch (error) {
        serverError(res, error);
    }
});

router.delete('/api/patients/:patientId/metrics/:metricId', (req, res) => {
    try {
        db.prepare('DELETE FROM patient_metrics WHERE id = ? AND patient_id = ?')
            .run(req.params.metricId, req.params.patientId);
        res.json({ success: true });
    } catch (error) {
        serverError(res, error);
    }
});

// API ENDPOINTS - PATIENT CONDITIONS

router.post('/api/patients/:id/conditions', (req, res) => {
    try {
        const id = uuidv4();
        const d = req.body;

        db.prepare(`
            INSERT INTO patient_conditions (id, patient_id, type, name, severity, description, dietary_notes, medications)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, req.params.id, d.type || 'condition', d.name, d.severity || 'mild', d.description || '', d.dietaryNotes || '', d.medications || '');

        const condition = db.prepare('SELECT * FROM patient_conditions WHERE id = ?').get(id);
        res.json({ success: true, data: transformCondition(condition) });
    } catch (error) {
        serverError(res, error);
    }
});

router.delete('/api/patients/:patientId/conditions/:conditionId', (req, res) => {
    try {
        db.prepare('DELETE FROM patient_conditions WHERE id = ? AND patient_id = ?')
            .run(req.params.conditionId, req.params.patientId);
        res.json({ success: true });
    } catch (error) {
        serverError(res, error);
    }
});

// API ENDPOINTS - ALLERGIES (Special query)

router.get('/api/patients/:id/allergies', (req, res) => {
    try {
        const allergies = db.prepare(`
            SELECT name FROM patient_conditions 
            WHERE patient_id = ? AND (type = 'allergy' OR type = 'intolerance')
        `).all(req.params.id);

        res.json({ success: true, data: allergies.map(a => a.name) });
    } catch (error) {
        serverError(res, error);
    }
});

module.exports = router;

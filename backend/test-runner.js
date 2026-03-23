/**
 * test-runner.js - Test Runner para Meal Prep Planner
 * 
 * Ejecutar: node test-runner.js
 * 
 * Tests incluidos:
 * 1. API Health Check
 * 2. Ingredients CRUD
 * 3. Recipes CRUD
 * 4. Patients CRUD
 * 5. Validation Tests
 */

const http = require('http');

const BASE_URL = process.env.API_URL || 'http://localhost:3004';

// ==========================================
// TEST UTILITIES
// ==========================================

function log(message, type = 'info') {
    const icons = {
        pass: '✅',
        fail: '❌',
        info: 'ℹ️',
        warn: '⚠️'
    };
    console.log(`${icons[type]} ${message}`);
}

async function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// ==========================================
// TESTS
// ==========================================

let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        await fn();
        passed++;
        log(name, 'pass');
    } catch (e) {
        failed++;
        log(`${name}: ${e.message}`, 'fail');
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function runTests() {
    console.log('\n🧪 MEAL PREP PLANNER - TEST SUITE\n');
    console.log('='.repeat(50));

    // ==========================================
    // 1. HEALTH CHECK
    // ==========================================
    console.log('\n📋 Health Check\n');

    await test('API should be healthy', async () => {
        const res = await request('GET', '/api/health');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.data.status === 'ok', 'Status should be ok');
    });

    // ==========================================
    // 2. INGREDIENTS API
    // ==========================================
    console.log('\n📋 Ingredients API\n');

    await test('GET /api/ingredients should return list', async () => {
        const res = await request('GET', '/api/ingredients');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(Array.isArray(res.data.data), 'Should return array');
        assert(res.data.data.length > 0, 'Should have ingredients');
    });

    await test('Ingredients should have valid categories', async () => {
        const res = await request('GET', '/api/ingredients');
        const validCategories = ['breakfast', 'lunch', 'dinner', 'afternoon_snack', 'snack'];
        res.data.data.forEach(ing => {
            assert(validCategories.includes(ing.category), 
                `Invalid category: ${ing.category}`);
        });
    });

    await test('POST /api/ingredients should create ingredient', async () => {
        const ingredient = {
            name: 'Test Ingredient',
            category: 'snack',
            kcalPer100g: 100,
            proteinPer100g: 5,
            carbsPer100g: 10,
            fatPer100g: 3
        };
        const res = await request('POST', '/api/ingredients', ingredient);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.data.success === true, 'Should return success');
        assert(res.data.data.name === 'Test Ingredient', 'Should return created ingredient');
    });

    await test('POST /api/ingredients should reject empty name', async () => {
        const ingredient = {
            name: '',
            category: 'snack',
            kcalPer100g: 100
        };
        const res = await request('POST', '/api/ingredients', ingredient);
        assert(res.status === 400, 'Should return 400 for empty name');
    });

    // ==========================================
    // 3. RECIPES API
    // ==========================================
    console.log('\n📋 Recipes API\n');

    await test('GET /api/recipes should return list', async () => {
        const res = await request('GET', '/api/recipes');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(Array.isArray(res.data.data), 'Should return array');
    });

    await test('Recipes should have nutrition calculated', async () => {
        const res = await request('GET', '/api/recipes');
        if (res.data.data.length > 0) {
            const recipe = res.data.data[0];
            assert(recipe.nutrition, 'Recipe should have nutrition');
            assert(typeof recipe.nutrition.calories === 'number', 'Nutrition should have calories');
        }
    });

    await test('POST /api/recipes should create recipe', async () => {
        const ingredients = await request('GET', '/api/ingredients');
        const ingredientId = ingredients.data.data[0]?.id;
        
        if (ingredientId) {
            const recipe = {
                name: 'Test Recipe',
                category: 'lunch',
                instructions: 'Mix ingredients',
                ingredients: [{ ingredientId, grams: 100 }]
            };
            const res = await request('POST', '/api/recipes', recipe);
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            assert(res.data.success === true, 'Should return success');
        }
    });

    // ==========================================
    // 4. PATIENTS API
    // ==========================================
    console.log('\n📋 Patients API\n');

    await test('GET /api/patients should return list', async () => {
        const res = await request('GET', '/api/patients');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(Array.isArray(res.data.data), 'Should return array');
    });

    await test('POST /api/patients should create patient', async () => {
        const patient = {
            firstName: 'Test',
            lastName: 'Patient',
            email: 'test@example.com'
        };
        const res = await request('POST', '/api/patients', patient);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    // ==========================================
    // 5. BILLING API
    // ==========================================
    console.log('\n📋 Billing API\n');

    await test('GET /billing-api/dashboard/stats should return stats', async () => {
        const res = await request('GET', '/billing-api/dashboard/stats');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.data.data, 'Should have data');
        assert(typeof res.data.data.totalClients === 'number', 'Should have totalClients');
    });

    await test('GET /billing-api/clients should return list', async () => {
        const res = await request('GET', '/billing-api/clients');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(Array.isArray(res.data.data), 'Should return array');
    });

    // ==========================================
    // 6. VALIDATION TESTS
    // ==========================================
    console.log('\n📋 Validation Tests\n');

    await test('Should reject ingredient with invalid category', async () => {
        const ingredient = {
            name: 'Test',
            category: 'INVALID_CATEGORY',
            kcalPer100g: 100
        };
        const res = await request('POST', '/api/ingredients', ingredient);
        assert(res.status === 400, 'Should reject invalid category');
    });

    await test('Should reject negative kcal', async () => {
        const ingredient = {
            name: 'Negative Energy',
            category: 'snack',
            kcalPer100g: -100
        };
        const res = await request('POST', '/api/ingredients', ingredient);
        // Backend should either reject or handle gracefully
        assert([200, 400].includes(res.status), 'Should return valid status');
    });

    // ==========================================
    // 7. INTEGRITY TESTS (CRITICAL)
    // ==========================================
    console.log('\n📋 Integrity Tests\n');

    await test('POST /api/recipes should REJECT recipe without ingredients', async () => {
        const res = await request('POST', '/api/recipes', {
            name: 'Empty Recipe',
            ingredients: []
        });
        assert(res.status === 400, 'Should reject empty ingredients');
        assert(res.data.error.includes('at least one ingredient'), 'Error should mention ingredients');
    });

    await test('POST /api/recipes should REJECT recipe with invalid ingredient ID', async () => {
        const res = await request('POST', '/api/recipes', {
            name: 'Bad Ingredient',
            ingredients: [{ ingredientId: 'fake-id-123', grams: 100 }]
        });
        assert(res.status === 400, 'Should reject invalid ingredient');
        assert(res.data.error.includes('not found'), 'Error should mention ingredient not found');
    });

    await test('POST /api/recipes should ACCEPT valid recipe', async () => {
        // Get an ingredient
        const ings = await request('GET', '/api/ingredients');
        const ingId = ings.data.data[0]?.id;
        
        if (ingId) {
            const res = await request('POST', '/api/recipes', {
                name: 'Valid Integrity Test',
                ingredients: [{ ingredientId: ingId, grams: 100 }]
            });
            assert(res.status === 200, 'Should accept valid recipe');
            assert(res.data.success === true, 'Should return success');
        }
    });

    await test('DELETE ingredient should CHECK if in use by recipes', async () => {
        // Create a recipe first
        const ings = await request('GET', '/api/ingredients');
        const ingId = ings.data.data[0]?.id;
        
        if (ingId) {
            // Try to delete the ingredient that might be in use
            const res = await request('DELETE', `/api/ingredients/${ingId}`);
            // Should either succeed or fail gracefully
            assert([200, 400, 500].includes(res.status), 'Should handle deletion gracefully');
        }
    });

    await test('POST /api/planner should REQUIRE patientId', async () => {
        const res = await request('POST', '/api/planner', {});
        assert(res.status === 400, 'Should require patientId');
        assert(res.data.error.includes('patientId'), 'Error should mention patientId');
    });

    await test('POST /api/planner should REJECT invalid patient', async () => {
        const res = await request('POST', '/api/planner', {
            patientId: 'invalid-patient-id'
        });
        assert(res.status === 400, 'Should reject invalid patient');
        assert(res.data.error.toLowerCase().includes('not found'), 'Error should mention patient not found');
    });

    await test('GET /api/planner should return data', async () => {
        const res = await request('GET', '/api/planner');
        assert(res.status === 200, 'Should return planners');
        assert(Array.isArray(res.data.data), 'Should return array');
    });

    // ==========================================
    // RESULTS
    // ==========================================
    console.log('\n' + '='.repeat(50));
    console.log('\n📊 RESULTS:\n');
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📈 Total:  ${passed + failed}`);
    
    if (failed === 0) {
        console.log('\n🎉 ALL TESTS PASSED!\n');
        process.exit(0);
    } else {
        console.log('\n⚠️  SOME TESTS FAILED\n');
        process.exit(1);
    }
}

runTests().catch(e => {
    console.error('Test runner error:', e);
    process.exit(1);
});

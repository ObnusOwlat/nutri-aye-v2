/**
 * Builds foods-data/allergens/off-allergen-terms.json from the Open Food Facts
 * ingredient taxonomy (https://world.openfoodfacts.org, data under ODbL 1.0):
 * every ingredient name and synonym in English and Spanish, with the allergens
 * it carries (inherited from its parents: mozzarella -> cheese -> milk).
 * Terms without allergens are kept when they contain an allergen term, so that
 * "coconut milk" or "peanut oil" do not count as "milk" or "peanuts".
 * The file is versioned: the server reads it, this only runs to refresh it.
 *
 * Usage: node import-off-allergens.js
 */

const fs = require('fs');
const path = require('path');

const URL = 'https://static.openfoodfacts.org/data/taxonomies/ingredients.json';
const OUT = path.join(__dirname, '..', 'foods-data', 'allergens', 'off-allergen-terms.json');
const LANGS = ['en', 'es'];
// The 14 allergens of EU Regulation 1169/2011 (Open Food Facts ids)
const ALLERGENS = new Set(['en:gluten', 'en:crustaceans', 'en:eggs', 'en:fish', 'en:peanuts', 'en:soybeans', 'en:milk', 'en:nuts',
    'en:celery', 'en:mustard', 'en:sesame-seeds', 'en:sulphur-dioxide-and-sulphites', 'en:lupin', 'en:molluscs']);

const plain = (t) => String(t || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

(async () => {
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`Open Food Facts respondió ${res.status}`);
    const taxonomy = await res.json();

    const memo = new Map();
    function allergensOf(id, seen = new Set()) {
        if (memo.has(id)) return memo.get(id);
        const entry = taxonomy[id];
        if (!entry || seen.has(id)) return new Set();
        seen.add(id);
        const own = entry.allergens?.en;
        const found = new Set((Array.isArray(own) ? own : own ? String(own).split(',') : []).map(a => a.trim()).filter(a => ALLERGENS.has(a)));
        for (const parent of entry.parents || []) for (const a of allergensOf(parent, seen)) found.add(a);
        memo.set(id, found);
        return found;
    }

    const terms = new Map(); // term -> Set(allergens)
    for (const [id, entry] of Object.entries(taxonomy)) {
        const allergens = allergensOf(id);
        for (const lang of LANGS) {
            const names = [entry.name?.[lang], ...(entry.synonyms?.[lang] || [])].filter(Boolean);
            for (const name of names) {
                const term = plain(name);
                if (term.length < 3) continue;
                if (!terms.has(term)) terms.set(term, new Set());
                for (const a of allergens) terms.get(term).add(a);
            }
        }
    }
    // Keep allergen terms, and allergen-free terms that contain one (suppressors)
    const withAllergen = [...terms].filter(([, a]) => a.size).map(([t]) => t);
    const containsAllergenTerm = (t) => withAllergen.some(w => w !== t && new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(t));
    const out = {};
    for (const [term, allergens] of terms) {
        if (allergens.size) out[term] = [...allergens].map(a => a.slice(3)).sort();
        else if (containsAllergenTerm(term)) out[term] = [];
    }
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({
        source: 'Open Food Facts, taxonomía de ingredientes (https://world.openfoodfacts.org)',
        license: 'Open Database License (ODbL) 1.0 — © colaboradores de Open Food Facts',
        downloadedAt: new Date().toISOString().slice(0, 10),
        terms: Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
    }));
    const allergenTerms = Object.values(out).filter(a => a.length).length;
    console.log(`${Object.keys(out).length} términos (${allergenTerms} con alérgeno) -> ${path.relative(process.cwd(), OUT)}`);
})().catch(error => { console.error(error.message); process.exit(1); });

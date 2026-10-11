/**
 * Download the wger exercise catalog (https://wger.de, data under CC-BY-SA)
 * into foods-data/exercises/wger-exercises.json, which is versioned: the
 * server reads that file, so this only runs again to refresh the catalog.
 *
 * Spanish name when wger has one, else the English one (translated: false).
 * Categories, muscles and equipment get Spanish names from the tables below.
 * Each exercise keeps its license and author (attribution required).
 *
 * Usage: node import-wger.js
 */

const fs = require('fs');
const path = require('path');

const API = 'https://wger.de/api/v2/exerciseinfo/?limit=100';
const OUT = path.join(__dirname, '..', 'foods-data', 'exercises', 'wger-exercises.json');
const LANG = { es: 4, en: 2 };

const CATEGORIES = {
    10: 'Abdominales', 8: 'Brazos', 12: 'Espalda', 14: 'Pantorrillas',
    15: 'Cardio', 11: 'Pecho', 9: 'Piernas', 13: 'Hombros'
};
const MUSCLES = {
    1: 'Bíceps', 2: 'Deltoides anterior', 3: 'Serrato anterior', 4: 'Pectoral mayor', 5: 'Tríceps',
    6: 'Recto abdominal', 7: 'Gemelos', 8: 'Glúteo mayor', 9: 'Trapecio', 10: 'Cuádriceps',
    11: 'Isquiotibiales', 12: 'Dorsal ancho', 13: 'Braquial', 14: 'Oblicuos', 15: 'Sóleo'
};
const EQUIPMENT = {
    1: 'Barra', 2: 'Barra Z', 3: 'Mancuernas', 4: 'Colchoneta', 5: 'Pelota suiza', 6: 'Barra de dominadas',
    7: 'Sin equipo (peso corporal)', 8: 'Banco', 9: 'Banco inclinado', 10: 'Pesa rusa', 11: 'Banda elástica', 12: 'Polea'
};

const stripHtml = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

async function fetchAll() {
    const all = [];
    for (let url = API; url;) {
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`wger respondió ${res.status} en ${url}`);
        const page = await res.json();
        all.push(...page.results);
        url = page.next;
        process.stdout.write(`\r${all.length} / ${page.count}`);
    }
    process.stdout.write('\n');
    return all;
}

function toExercise(e) {
    const es = e.translations.find(t => t.language === LANG.es);
    const en = e.translations.find(t => t.language === LANG.en);
    const main = es || en;
    if (!main) return null;
    const image = (e.images.find(i => i.is_main) || e.images[0])?.image || null;
    return {
        id: e.id,
        name: main.name.trim(),
        nameEn: en?.name.trim() || null,
        translated: !!es,
        description: stripHtml(main.description).slice(0, 600),
        category: CATEGORIES[e.category.id] || e.category.name,
        categoryId: e.category.id,
        muscles: e.muscles.map(m => MUSCLES[m.id] || m.name_en || m.name),
        musclesSecondary: e.muscles_secondary.map(m => MUSCLES[m.id] || m.name_en || m.name),
        equipment: e.equipment.map(q => EQUIPMENT[q.id] || q.name),
        image,
        license: e.license?.short_name || null,
        author: e.license_author || null
    };
}

(async () => {
    const raw = await fetchAll();
    const exercises = raw.map(toExercise).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({
        source: 'wger.de (https://wger.de/api/v2/exerciseinfo/)',
        license: 'Datos de ejercicios bajo CC-BY-SA; autor y licencia en cada ejercicio',
        downloadedAt: new Date().toISOString().slice(0, 10),
        exercises
    }, null, 1));
    const translated = exercises.filter(x => x.translated).length;
    console.log(`${exercises.length} ejercicios (${translated} con nombre en español) -> ${path.relative(process.cwd(), OUT)}`);
})().catch(error => {
    console.error(error.message);
    process.exit(1);
});

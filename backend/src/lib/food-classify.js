// Classifies a food by its names: subgroup inside its category, preparation
// form, and the category of basic-catalog foods (rules in lib/food-groups.js).
const { SUBGROUPS, FORMS, BASIC_CATEGORY_RULES } = require('./food-groups');

const plain = (text) => String(text || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const cache = new Map();
function matcher(keyword) {
    if (!cache.has(keyword)) {
        const word = escape(plain(keyword));
        const whole = keyword.replace(/[^a-z]/gi, '').length <= 4;
        cache.set(keyword, new RegExp(`(^|[^a-z0-9])${word}${whole ? '(s|es)?(?![a-z])' : ''}`));
    }
    return cache.get(keyword);
}
const hasAny = (text, keywords = []) => keywords.some(k => matcher(k).test(text));

// { category, sourceCategory, name, nameEn } -> subgroup id, or 'other'
function subgroupOf({ category, sourceCategory, name, nameEn }) {
    const rules = SUBGROUPS[category];
    if (!rules) return null;
    // The English USDA name is the most regular, then the USDA food group;
    // the Spanish name decides for basic-catalog and own foods
    const en = plain(nameEn), es = plain(name);
    const found = (en && rules.find(([, rule]) => hasAny(en, rule.en)))
        || rules.find(([, rule]) => rule.usda?.includes(sourceCategory))
        || rules.find(([, rule]) => hasAny(es, rule.es));
    return found ? found[0] : 'other';
}

// Preparation form, or null when the name does not say
function formOf({ name, nameEn }) {
    const es = plain(name), en = plain(nameEn);
    const found = FORMS.find(([, rule]) => hasAny(en, rule.en) || hasAny(es, rule.es));
    return found ? found[0] : null;
}

// Category of a basic-catalog food by its Spanish name, or null to keep it
function basicCategoryOf(name) {
    const es = plain(name);
    const found = BASIC_CATEGORY_RULES.find(([, keywords]) => hasAny(es, keywords));
    return found ? found[0] : null;
}

module.exports = { subgroupOf, formOf, basicCategoryOf };

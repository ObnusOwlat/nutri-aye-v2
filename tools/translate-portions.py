"""
Translate the household portion descriptions of the food catalog (USDA:
"cup, chopped", "slice", "fl oz"...) to Spanish, offline and free: exact
glossary for the frequent ones, then the same OPUS-MT model as the food names.

Output: foods-data/translations/portions-es.json  {"cup, chopped": "taza, picado"}
(versioned; the backend reads it when it serves a food's portions).

Usage: tools/.venv/bin/python tools/translate-portions.py
"""

import importlib.util
import json
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "backend" / "db" / "database.sqlite"
OUT = ROOT / "foods-data" / "translations" / "portions-es.json"

spec = importlib.util.spec_from_file_location("usda", ROOT / "tools" / "translate-usda.py")
usda = importlib.util.module_from_spec(spec)
spec.loader.exec_module(usda)

# Frequent words, translated by hand (applied word by word before the model)
WORDS = {
    "oz": "oz", "fl oz": "oz líq.", "lb": "lb", "cup": "taza", "cups": "tazas", "tbsp": "cda.", "tablespoon": "cucharada",
    "tablespoons": "cucharadas", "tsp": "cdta.", "teaspoon": "cucharadita", "teaspoons": "cucharaditas", "slice": "feta",
    "slices": "fetas", "piece": "porción", "pieces": "porciones", "serving": "porción", "servings": "porciones",
    "medium": "mediano", "large": "grande", "small": "chico", "extra large": "extra grande", "jumbo": "extra grande",
    "each": "unidad", "item": "unidad", "unit": "unidad", "fillet": "filete", "steak": "bife", "roast": "asado",
    "chop": "chuleta", "can": "lata", "jar": "frasco", "package": "paquete", "packet": "sobre", "bar": "barra",
    "scoop": "cucharón", "cookie": "galletita", "sandwich": "sándwich", "pizza": "pizza", "quart": "cuarto de galón",
    "container": "envase", "link": "unidad", "fruit": "fruta", "wedge": "gajo", "egg": "huevo", "drumstick": "pata",
    "RACC": "porción de referencia", "cubic inch": "pulgada cúbica", "inch": "pulgada", "chopped": "picado",
    "diced": "en cubos", "sliced": "en rodajas", "shredded": "rallado", "cubes": "en cubos", "drained": "escurrido",
    "packed": "compacto", "cooked": "cocido", "raw": "crudo", "whole": "entero", "halves": "mitades", "pitted": "sin carozo",
    "spear": "tallo", "bunch": "atado", "olive": "aceituna", "order": "porción", "leaf": "hoja", "leaves": "hojas",
}


# Frequent model mistakes, fixed on the Spanish output
POST_FIX = [
    (r"\bbombardead[oa]s?\b", "sin cáscara"), (r"\bjerga\b", "frasco"), (r"\bservicio\b", "porción"),
    (r"\bsirviendo\b", "porción"), (r"\bof\b", "de"), (r"\bdia\b\.?", "diám."), (r"\bnlea\b", "NLEA"),
    (r"\bcookies\b", "galletitas"), (r"empaquetad[oa] sueltamente", "sin compactar"), (r"\bpequeñ([oa])s?\b", r"chic\1"),
    (r"\brebanadas?\b", "feta"), (r"\bshelled\b", "sin cáscara"), (r"\bpatty\b", "medallón"), (r"\bwafers?\b", "oblea"),
]


def post_fix(text):
    for pattern, repl in POST_FIX:
        text = re.sub(pattern, repl, text, flags=re.IGNORECASE)
    return text[:1].lower() + text[1:] if text[:2].istitle() else text


def translate_words(text):
    out = text
    for en, es in sorted(WORDS.items(), key=lambda kv: -len(kv[0])):
        out = re.sub(rf"(?<![\w]){re.escape(en)}(?![\w])", es, out, flags=re.IGNORECASE)
    return out


def main():
    db = sqlite3.connect(DB_PATH)
    texts = sorted({r[0] for r in db.execute(
        "SELECT DISTINCT COALESCE(modifier, unit) FROM ingredient_portions WHERE COALESCE(modifier, unit) IS NOT NULL")})
    result, pending = {}, []
    for t in texts:
        simple = translate_words(t)
        # Fully covered by the word list (only Spanish/neutral words left)
        if not re.search(r"[a-zA-Z]{3,}", re.sub(r"\b(" + "|".join(map(re.escape, set(WORDS.values()))) + r")\b", "", simple, flags=re.I)):
            result[t] = post_fix(simple)
        else:
            pending.append(t)
    translate = usda.load_model()
    for i in range(0, len(pending), 64):
        chunk = pending[i:i + 64]
        for t, es in zip(chunk, translate([p.lower() for p in chunk])):
            result[t] = post_fix(usda.regionalize(translate_words(es.strip().rstrip("."))))
    OUT.write_text(json.dumps(dict(sorted(result.items())), ensure_ascii=False, indent=0))
    print(f"{len(result)} porciones ({len(texts) - len(pending)} por glosario, {len(pending)} con el modelo) -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

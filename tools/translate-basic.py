"""
Translate the basic food catalog (calories-in, short English names) to
Spanish with the same offline, free tools as the USDA names: glossary first,
then the OPUS-MT model and the regional wording (porotos, batata, palta...),
then the hand-checked names in tools/basic-overrides-es.json.

Output: foods-data/translations/calories-in-names-es.json  {"English name": "nombre"}
(versioned; backend/import-foods.js applies it).

Usage: tools/.venv/bin/python tools/translate-basic.py
"""

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "foods-data" / "calories-in-ingredients.json"
OUT = ROOT / "foods-data" / "translations" / "calories-in-names-es.json"
# Hand-checked names (the model gets some wrong); applied last
OVERRIDES = ROOT / "tools" / "basic-overrides-es.json"

# Reuse the USDA translator (model loading, glossary, regional wording)
spec = importlib.util.spec_from_file_location("usda", ROOT / "tools" / "translate-usda.py")
usda = importlib.util.module_from_spec(spec)
spec.loader.exec_module(usda)


def main():
    foods = json.loads(SOURCE.read_text())
    names = sorted({f["name"].strip() for f in (foods if isinstance(foods, list) else foods.get("ingredients", [])) if f.get("name")})
    glossary = {k.lower(): v for k, v in json.loads(usda.GLOSSARY.read_text()).items()}
    translate = usda.load_model()

    result, pending = {}, []
    for name in names:
        if name.lower() in glossary:
            result[name] = glossary[name.lower()]
        else:
            pending.append(name)
    # Lowercase: title-cased input is often taken as a proper name and left in English
    for name, spanish in zip(pending, translate([n.lower() for n in pending])):
        text = usda.regionalize(spanish.strip().rstrip("."))
        result[name] = text[:1].upper() + text[1:]

    result.update(json.loads(OVERRIDES.read_text()))
    # Sentence case: "Pechuga de pollo sin piel"
    result = {k: v[:1].upper() + v[1:] for k, v in result.items()}
    OUT.write_text(json.dumps(dict(sorted(result.items())), ensure_ascii=False, indent=0))
    print(f"{len(result)} nombres traducidos -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

"""
Translate USDA food names to Spanish, offline and free.

Glossary first (tools/glossary-usda-es.json: frequent USDA segments, local
Spanish: porotos, batata, palta...), then an offline OPUS-MT model (Argos
Translate en->es, run with ctranslate2) for the rest. Adjectives agree with
the head noun's gender/number, taken from the model ("the milk" -> "la leche").

Output: foods-data/translations/usda-names-es.json  {fdcId: "nombre"}
(versioned, so import-usda.js can fill name_es without this tool).

Setup (once):
  python3 -m venv tools/.venv
  tools/.venv/bin/pip install ctranslate2 sentencepiece
  # model: https://argos-net.com/v1/translate-en_es-1_0.argosmodel (zip) -> tools/models/en_es/

Usage: tools/.venv/bin/python tools/translate-usda.py
"""

import json
import re
import sqlite3
import sys
from pathlib import Path

import ctranslate2
import sentencepiece as spm

ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = ROOT / "tools" / "models" / "en_es"
GLOSSARY = ROOT / "tools" / "glossary-usda-es.json"
DB_PATH = ROOT / "backend" / "db" / "database.sqlite"
OUT = ROOT / "foods-data" / "translations" / "usda-names-es.json"

# Model output -> Spanish used in Paraguay / Río de la Plata
REGIONAL = [
    (r"\bfrijoles\b", "porotos"), (r"\bfrijol\b", "poroto"),
    (r"\bjudías verdes\b", "chauchas"), (r"\bjudías\b", "porotos"),
    (r"\bejotes\b", "chauchas"), (r"\bpatatas\b", "papas"), (r"\bpatata\b", "papa"),
    (r"\bpapas? dulces?\b", "batata"), (r"\bcamotes?\b", "batata"),
    (r"\bcacahuetes\b", "maníes"), (r"\bcacahuete\b", "maní"), (r"\bcacahuates?\b", "maní"),
    (r"\bmantequilla\b", "manteca"), (r"\baguacates?\b", "palta"),
    (r"\bfresas\b", "frutillas"), (r"\bfresa\b", "frutilla"),
    (r"\bmelocotones\b", "duraznos"), (r"\bmelocotón\b", "durazno"),
    (r"\balbaricoques\b", "damascos"), (r"\balbaricoque\b", "damasco"),
    (r"\bpiña\b", "ananá"), (r"\bcalabacines\b", "zapallitos"), (r"\bcalabacín\b", "zapallito"),
    (r"\bguisantes\b", "arvejas"), (r"\bchícharos\b", "arvejas"), (r"\bzumo\b", "jugo"),
    (r"\btocino\b", "panceta"), (r"\bnata\b", "crema"), (r"\btoronjas?\b", "pomelo"),
    (r"\belotes?\b", "choclo"), (r"\byuca\b", "mandioca"), (r"\bcassava\b", "mandioca"),
    (r"\bvitaminas ([a-z]) y ([a-z])\b", lambda m: f"vitaminas {m.group(1).upper()} y {m.group(2).upper()}"),
    (r"\bvitamina ([a-z])\b", lambda m: f"vitamina {m.group(1).upper()}"),
    (r"\bcarne de res\b", "carne vacuna"), (r"\bpuerco\b", "cerdo"), (r"\bcarne de carne\b", "carne vacuna"),
]

# Segments built from numbers, translated by rule before the glossary
PATTERNS = [
    (re.compile(r"^(\d+(?:\.\d+)?)% milkfat$", re.I), lambda m: f"{m.group(1).replace('.', ',')} % de grasa láctea"),
    (re.compile(r"^(\d+(?:\.\d+)?)% fat$", re.I), lambda m: f"{m.group(1).replace('.', ',')} % de grasa"),
    (re.compile(r"^(\d+)% lean(?: meat)? / (\d+)% fat$", re.I), lambda m: f"{m.group(1)} % magro / {m.group(2)} % grasa"),
    (re.compile(r"^aust\. marble score (.+)$", re.I), lambda m: f"marmoleo australiano {m.group(1)}"),
]

# Words ending in -o that are nouns or adverbs, never inflected as adjectives
NOUNS_O = {
    "solo", "magro", "medio", "listo", "mixto", "tipo", "estilo",
    "pollo", "cerdo", "huevo", "pescado", "trigo", "helado", "cordero", "pavo", "pato", "queso",
    "jugo", "caldo", "aceite", "arroz", "centeno", "salvado", "tomate", "durazno", "camarón",
    "embutido", "muslo", "bife", "lomo", "hígado", "riñón", "corazón", "seso", "medallón", "grano",
    "envase", "puré", "postre", "plato", "almuerzo", "condimento", "pecho", "brazo", "garrón",
    "costilla", "chocolate", "café", "té", "vino", "agua", "producto", "corte", "centro", "extremo",
    "promedio", "concentrado", "menudo", "pote", "mitad", "calor", "aderezo", "alimento", "relleno",
    "pastel", "estilo", "tipo", "polvo", "trozo", "asado", "parrillero", "spiedo", "vapor", "microondas",
    "ojo", "peceto", "vacío", "cuadril", "nalga", "marucha", "palo", "kilo", "mondongo", "chorizo",
}


# Gender of common head nouns that do not end in -o/-a (True = feminine)
HEAD_GENDER = {
    "ananá": False, "mamón": False, "maní": False, "maníes": False, "maíz": False, "pan": False, "té": False,
    "café": False, "aceite": False, "arroz": False, "kiwi": False, "melón": False, "limón": False, "limones": False,
    "jamón": False, "salmón": False, "atún": False, "flan": False, "tomate": False, "tomates": False, "ají": False,
    "brócoli": False, "alcaucil": False, "alcauciles": False, "perejil": False, "ñame": False, "puré": False,
    "kéfir": False, "yogur": False, "tofu": False, "cuscús": False, "burgol": False, "sorbete": False, "paté": False,
    "leche": True, "carne": True, "miel": True, "sal": True, "coliflor": True, "nuez": True, "nueces": True,
    "col": True, "fórmula": True, "achicoria": True, "lombarda": True, "torta": True,
}


def load_model():
    if not (MODEL_DIR / "model" / "model.bin").exists():
        sys.exit(f"Model not found in {MODEL_DIR} (see setup in this file's docstring)")
    translator = ctranslate2.Translator(str(MODEL_DIR / "model"), device="cpu", intra_threads=4)
    sp = spm.SentencePieceProcessor(model_file=str(MODEL_DIR / "sentencepiece.model"))

    def translate(texts):
        if not texts:
            return []
        tokens = [sp.encode(t, out_type=str) for t in texts]
        results = translator.translate_batch(tokens, beam_size=4, max_batch_size=64)
        return [sp.decode(r.hypotheses[0]) for r in results]

    return translate


def regionalize(text):
    for pattern, repl in REGIONAL:
        text = re.sub(pattern, repl, text, flags=0 if callable(repl) else re.IGNORECASE)
    return text


def masculine_base(word):
    """cocidas -> cocido, madura -> maduro (None if it does not look inflected)."""
    for suffix in ("as", "os", "a", "o"):
        if word.endswith(suffix) and len(word) > len(suffix) + 2:
            return word[: -len(suffix)] + "o"
    return None


def inflect_word(word, feminine, plural, adjectives):
    """Re-inflect a known adjective/participle to the head noun (cocido -> cocida/cocidos/cocidas)."""
    if word[:1].isupper():  # proper noun ("Florida", "Atlántico")
        return word
    base = masculine_base(word)
    if not base or base in NOUNS_O:
        return word
    if base not in adjectives and not base.endswith(("ado", "ido")):
        return word
    word = base[:-1] + ("a" if feminine else "o")
    return word + "s" if plural else word


def inflect_segment(text, feminine, plural, adjectives):
    # Only adjectives/participles before a preposition: "preparado con agua" -> "preparada con agua"
    words = text.split(" ")
    first = masculine_base(words[0])
    if not first or first in NOUNS_O or (first not in adjectives and not first.endswith(("ado", "ido"))):
        return text  # starts with a noun ("grasa recortada..."): leave it as is
    out = []
    for w in words:
        if w in ("con", "sin", "de", "en", "a", "al", "para", "según", "por"):
            out.extend(words[len(out):])
            break
        out.append(inflect_word(w, feminine, plural, adjectives))
    return " ".join(out)


def head_gender(translate, heads):
    """Gender/number of each English head noun from the model's article."""
    out = {}
    heads = sorted(heads)
    for head, es in zip(heads, translate([f"The {h.lower()}" for h in heads])):
        article = es.strip().split(" ")[0].lower()
        out[head] = (article in ("la", "las"), article in ("los", "las"))
    return out


def main():
    translate = load_model()
    glossary = {k.lower(): v for k, v in json.loads(GLOSSARY.read_text()).items()}

    db = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    # name_en: once imported, name already holds the Spanish name
    foods = db.execute("SELECT fdc_id, COALESCE(name_en, name) FROM ingredients WHERE source LIKE 'usda%' AND fdc_id IS NOT NULL").fetchall()
    db.close()

    split = {fdc: [s.strip() for s in name.split(",") if s.strip()] for fdc, name in foods}

    def by_rule(seg):
        for pattern, fn in PATTERNS:
            m = pattern.match(seg)
            if m:
                return fn(m)
        if seg.lower() in glossary:
            return glossary[seg.lower()]
        words = [w for w in seg.split() if w[:1].isalpha()]
        if seg.isupper() or (len(words) >= 2 and all(w[0].isupper() for w in words)):
            return seg  # brand / product names ("MEAD JOHNSON", "Pepperidge Farm") stay as they are
        return None

    # Single-word -o adjectives the glossary uses (crudo, entero, fresco...)
    adjectives = {v for v in glossary.values() if " " not in v and v.endswith("o") and v not in NOUNS_O}

    unknown = sorted({s for segs in split.values() for s in segs if by_rule(s) is None})
    print(f"{len(foods)} foods, {len(unknown)} segments for the model")
    machine = {}
    # The model translates lowercase text much better ("Lentils" -> "Lentils", "lentils" -> "lentejas")
    for seg, es in zip(unknown, translate([u.lower() for u in unknown])):
        es = regionalize(es.strip().rstrip("."))
        # lowercase like the glossary; keep proper nouns ("Atlantic") capitalized
        es = (es[:1].upper() if seg[:1].isupper() else es[:1].lower()) + es[1:]
        machine[seg] = es

    genders = head_gender(translate, {segs[0] for segs in split.values() if segs})

    def head_spanish_gender(head_en):
        """Gender/number from the Spanish head as written (zapallo is masculine even
        if the model says "la calabaza"); falls back to the model's article."""
        feminine, plural = genders.get(head_en, (False, False))
        es = by_rule(head_en) or machine.get(head_en) or ""
        word = es.split(" ")[0].lower().strip(",") if es else ""
        if word in HEAD_GENDER:
            return HEAD_GENDER[word], word.endswith("s")
        if word.endswith("os"):
            return False, True
        if word.endswith("as"):
            return True, True
        if word.endswith("o"):
            return False, False
        if word.endswith("a") and word not in ("día", "mapa", "clima"):
            return True, False
        return feminine, word.endswith("s")

    result = {}
    for fdc, segs in split.items():
        if not segs:
            continue
        feminine, plural = head_spanish_gender(segs[0])
        parts = []
        for i, seg in enumerate(segs):
            es = by_rule(seg)
            if es is None:
                es = machine[seg]
            if not es:
                continue
            if i > 0:
                es = inflect_segment(es, feminine, plural, adjectives)
            parts.append(es)
        name = ", ".join(parts)
        result[str(fdc)] = name[0].upper() + name[1:]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(dict(sorted(result.items(), key=lambda kv: int(kv[0]))), ensure_ascii=False, indent=0))
    print(f"Wrote {len(result)} names to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""One-shot generator: walks ../images/ and emits closet.json.

Safe to re-run; it does NOT read the existing closet.json (it would clobber
any hand-edits). If you've started hand-editing, rename the existing file
and merge manually.
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
IMAGES_ROOT = HERE.parent / "images"
OUT = HERE / "closet.json"

IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

# Match string (case-insensitive) -> canonical display name.
# When a filename uses an alt spelling or a typo (e.g. "Ventements"), the entry
# still resolves to the canonical brand. Most entries are identity (key == value).
BRANDS = {
    "Rick Owens DRKSHDW": "Rick Owens DRKSHDW",
    "Rick Owens": "Rick Owens",
    "Issey Miyake Homme Plisse": "Issey Miyake Homme Plisse",
    "Homme Plisse Issey Miyake": "Homme Plisse Issey Miyake",
    "Homme Plisse": "Homme Plisse",
    "Issey Miyake": "Issey Miyake",
    "Yohji Yamamoto": "Yohji Yamamoto",
    "Yohji Syte": "Yohji Syte",
    "Yohji": "Yohji",
    "Ground Y": "Ground Y",
    "Saint Laurent": "Saint Laurent",
    "Comme des Garcons Homme Plus": "Comme des Garcons Homme Plus",
    "Comme des Garcons": "Comme des Garcons",
    "Dr. Martens": "Dr. Martens",
    "Dr Martens": "Dr. Martens",          # no-dot variant
    "Naked and Famous": "Naked and Famous",
    "John Elliott": "John Elliott",
    "Vivienne Westwood": "Vivienne Westwood",
    "Jean Paul Gaultier": "Jean Paul Gaultier",
    "Maison Margiela": "Maison Margiela",
    "MM6 Maison Margiela": "MM6 Maison Margiela",
    "Iris Van Herpen": "Iris Van Herpen",
    "Feng Cheng Wang": "Feng Cheng Wang",
    "Han Kjobenhavn": "Han Kjobenhavn",
    "Reigning Champ": "Reigning Champ",
    "Sci Fi Fantasy": "Sci Fi Fantasy",
    "Death Mask": "Death Mask",
    "Body Wrappers": "Body Wrappers",
    "Buzz Rickson": "Buzz Rickson",
    "Real McCoy": "Real McCoy",
    "Stone Island": "Stone Island",
    "Gentle Monster": "Gentle Monster",
    "Uniform Bridge": "Uniform Bridge",
    "Vision Streetwear": "Vision Streetwear",
    "Vision Steetwear": "Vision Streetwear",  # typo variant
    "Lord Willys": "Lord Willys",
    "44 Label Group": "44 Label Group",
    "Maison Oge": "Maison Oge",
    "Colorful Standard": "Colorful Standard",
    "Rayon Vert": "Rayon Vert",
    "Guerrilla Group": "Guerrilla Group",
    "Sunflower": "Sunflower",
    "Nanushka": "Nanushka",
    "Dion Lee": "Dion Lee",
    "Saturdays Surf": "Saturdays Surf",
    "Apoc Able Issey Miyake": "Apoc Able Issey Miyake",
    "Apoc Able": "Apoc Able",
    "Pierre Louis Mascia": "Pierre Louis Mascia",
    "Eckhaus Latta": "Eckhaus Latta",
    "Big Love": "Big Love",
    "Soto": "Soto",
    "Asics": "Asics",
    "George Cox": "George Cox",
    "44 Label": "44 Label",
    "Ag Systems": "Ag Systems",
    "Lioness": "Lioness",
    "Doublet": "Doublet",
    "Outlier": "Outlier",
    "Nanamica": "Nanamica",
    "Acronym": "Acronym",
    "Acne": "Acne",
    "Amiri": "Amiri",
    "APC": "APC",
    "A.P.C.": "APC",                       # punctuation variant
    "Asket": "Asket",
    "Balenciaga": "Balenciaga",
    "Baryshnikov": "Baryshnikov",
    "Bonsai": "Bonsai",
    "Capezio": "Capezio",
    "Carhartt": "Carhartt",
    "Converse": "Converse",
    "Crockett and Jones": "Crockett and Jones",
    "Demobaza": "Demobaza",
    "Dieselboy": "Dieselboy",
    "Dita": "Dita",
    "Dries Van Noten": "Dries Van Noten",
    "Dustrial": "Dustrial",
    "Eniac": "Eniac",
    "Etudes": "Etudes",
    "Eytys": "Eytys",
    "G Shock": "G Shock",
    "Hyein Seo": "Hyein Seo",
    "Izzy Du": "Izzy Du",
    "Kapital": "Kapital",
    "Kenzo": "Kenzo",
    "Lcbx": "Lcbx",
    "Luu Dan": "Luu Dan",
    "Maharishi": "Maharishi",
    "Masunaga": "Masunaga",
    "Mcqueen": "Mcqueen",
    "Montbell": "Montbell",
    "Neighborhood": "Neighborhood",
    "Nike": "Nike",
    "Nine Inch Nails": "Nine Inch Nails",
    "Oakley": "Oakley",
    "Paa": "Paa",
    "Perfect Pussy": "Perfect Pussy",
    "Prodigy": "Prodigy",
    "Puebco": "Puebco",
    "Raf Simons": "Raf Simons",
    "Rammstein": "Rammstein",
    "Randolph": "Randolph",
    "Repetto": "Repetto",
    "Sr Studio La Ca": "Sr Studio La Ca",
    "Scarosso": "Scarosso",
    "Ssense": "Ssense",
    "Star Trek": "Star Trek",
    "Taion": "Taion",
    "Undercover": "Undercover",
    "Valentino": "Valentino",
    "Versace": "Versace",
    "Vetements": "Vetements",
    "Ventements": "Vetements",             # typo variant
    "Vollebak": "Vollebak",
    "Weejuns": "Weejuns",
    "Wildside": "Wildside",
    "99%is": "99%is",
    "Adidas": "Adidas",
    "Cw&t": "CW&T",                        # capitalization variant
    "ADSR": "ADSR",
}

COLORS = [
    "black", "white", "off-white", "off white", "grey", "gray", "navy",
    "blue", "red", "pink", "fuschia", "fuchsia", "purple", "lavender",
    "green", "olive", "yellow", "orange", "brown", "beige", "tan",
    "cream", "milk", "indigo", "transparent", "denim", "khaki",
    "bubblegum", "rose", "mustard",
]

MATERIALS: list[str] = []  # Maxwell prefers no auto material tags; left in place if reintroduced


def slug_brand_match(stem_lower: str) -> str | None:
    # Try longest match strings first so specific brands win over generic prefixes.
    for key in sorted(BRANDS, key=len, reverse=True):
        # Word-boundary-ish: must appear with non-alphanum on each side or at edge.
        pattern = r"(^|[^a-z0-9])" + re.escape(key.lower()) + r"($|[^a-z0-9])"
        if re.search(pattern, stem_lower):
            return BRANDS[key]
    return None


def derive_tags(stem_lower: str) -> list[str]:
    tags: list[str] = []
    for c in COLORS:
        pattern = r"(^|[^a-z0-9])" + re.escape(c) + r"($|[^a-z0-9])"
        if re.search(pattern, stem_lower):
            # Normalize a couple of synonyms.
            normalized = {"gray": "grey", "off white": "off-white", "fuschia": "fuchsia"}.get(c, c)
            if normalized not in tags:
                tags.append(normalized)
    for m in MATERIALS:
        pattern = r"(^|[^a-z0-9])" + re.escape(m) + r"($|[^a-z0-9])"
        if re.search(pattern, stem_lower) and m not in tags:
            tags.append(m)
    return tags


def clean_item_name(stem: str) -> str:
    s = stem.strip().strip(".")
    s = re.sub(r"\s+", " ", s)
    return s


def category_for(parts: list[str]) -> tuple[str, str]:
    # parts is relative-from-IMAGES_ROOT, with filename popped off.
    # First part = top-level folder (tops, bottoms, shoes, outerwear, accessories, suits)
    # Second part (if present) = subcategory folder.
    top = parts[0] if parts else "other"
    sub = parts[1] if len(parts) > 1 else ""
    # Map outerwear -> keep "outerwear" as category, sub = jackets/coats.
    return top, sub


def main() -> None:
    if not IMAGES_ROOT.exists():
        raise SystemExit(f"Images root not found: {IMAGES_ROOT}")

    entries = []
    for path in sorted(IMAGES_ROOT.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in IMG_EXT:
            continue
        if path.name.startswith("."):  # .DS_Store etc.
            continue

        rel = path.relative_to(IMAGES_ROOT)
        parts = list(rel.parts)
        folder_parts = parts[:-1]

        category, subcategory = category_for(folder_parts)
        # Skip clearly-incomplete folders.
        if "NOTDONE" in (subcategory or ""):
            continue

        stem = path.stem
        stem_lower = stem.lower()

        brand = slug_brand_match(stem_lower)
        tags = derive_tags(stem_lower)

        # image path relative to ClosetSite/closet.html
        image_rel = f"../images/{rel.as_posix()}"

        entries.append({
            "image": image_rel,
            "item": clean_item_name(stem),
            "brand": brand or "",
            "category": category,
            "subcategory": subcategory,
            "tags": tags,
        })

    # Stable ordering: category, subcategory, item.
    entries.sort(key=lambda e: (e["category"], e["subcategory"], e["item"].lower()))

    OUT.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(entries)} entries to {OUT}")

    # Tiny summary.
    from collections import Counter
    cats = Counter((e["category"], e["subcategory"]) for e in entries)
    for (c, s), n in sorted(cats.items()):
        print(f"  {c}/{s or '-'}: {n}")


if __name__ == "__main__":
    main()

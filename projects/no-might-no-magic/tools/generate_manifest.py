#!/usr/bin/env python3
"""
Scans assets/terrain and "landscape sprites" and writes js/manifest.js.

Terrain tile naming (from the HoMM3 rips):
    t{gr|dt|sn|sa|sw|ro|su|vl}{b|d|s|m}{P}{V}.png
        b = plain base variants (numbered 000..025 with gaps, no pattern grouping)
        d = border vs dirt   (pattern digit P 0-4, variant digit V)
        s = border vs sand/water
        m = mixed dirt+sand border (kept in manifest, unused by v1 renderer)
    watrtl01..33.png  water (01-04 corner, 05-08 left, 09-12 top,
                      13-16+19-20 diagonal, 17-18 surrounded, 21-33 open)
    {clr|icy|mud|lav}rvr00..12.png  rivers
    {TRDC|trdd|trdg}PV.png          roads
    Border pattern P: 0=foreign top+left, 1=foreign left, 2=foreign top,
                      3=foreign bottom-right diagonal only
    The "4" files are not a pattern of their own: variants 0-1 are extra
    corner (pattern 0) tiles and variants 2-3 extra diagonal (pattern 3)
    tiles, so they are filed under groups 0 and 3. No art exists for a
    tile foreign on all four edges; the generator smooths those away.

Objects (AVL*.png): biome inferred from the terrain code embedded in the
filename (trailing letters before the variant digit), with explicit
overrides for families that don't follow the rule.
"""

import json
import re
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TERRAIN_DIR = ROOT / "assets" / "terrain"
OBJECTS_DIR = ROOT / "landscape sprites"
OUT = ROOT / "js" / "manifest.js"

TERRAINS = {"gr": "grass", "dt": "dirt", "sn": "snow", "sa": "sand",
            "sw": "swamp", "ro": "rough", "su": "subterranean", "vl": "lava"}
RIVERS = {"clrrvr": "clear", "icyrvr": "icy", "mudrvr": "mud", "lavrvr": "lava"}
ROADS = {"TRDC": "cobblestone", "trdd": "dirt", "trdg": "gravel"}

# --- object biome classification -------------------------------------------
# suffix codes on AVL object names (letters right before the variant digit)
SUFFIX_BIOMES = {
    "sn": "snow", "sw": "swamp", "g": "grass", "d": "dirt", "r": "rough",
    "s": "sand", "u": "subterranean", "l": "lava",
}
# families that don't follow the suffix rule (prefix match, case-insensitive)
FAMILY_OVERRIDES = {
    "avlautr": "grass",       # autumn trees
    "avlpntr": "grass",       # pine trees
    "avlsptr": "grass",       # spruce-ish trees
    "avlsntr": "snow",        # snow trees
    "avlswtr": "swamp",       # swamp trees
    "avlswt": "swamp",
    "avlca": "sand",          # cacti
    "avlyuc": "sand",         # yucca
    "avlplm": "sand",         # palms
    "avldun": "sand",         # dunes
    "avlmtgn": "grass",       # green mountains
    "avlmtgr": "grass",
    "avlmtdr": "dirt",
    "avlmtsn": "snow",
    "avlmtds": "sand",
    "avlmtsw": "swamp",
    "avlmtrf": "rough",
    "avlmtvo": "lava",
    "avlvol": "lava",         # volcanoes
    "avlxgr": "grass",
    "avlxdt": "dirt",
    "avlxds": "sand",
    "avlxsw": "swamp",
    "avlxro": "rough",
    "avlxsu": "subterranean",
    "avlswmp": "swamp",
    "avlroug": "rough",
    "avldead": "swamp",       # dead vegetation
    "avlddsn": "snow",
    "avlbuzr": "sand",        # buzzard/bones
    "avlskul": "sand",
    "avllv": "lava", "avllav": "lava",
    "avlspit": "sand",        # sand spit/mound
    "avlllk": "subterranean",   # underground lava lakes
    "avllv1u": "subterranean",  # underground lava flows (u suffix)
    "avllv2u": "subterranean",
    "avllv3u": "subterranean",
    "avlrf": "water",         # reefs
    "avlrk": "water",         # sea rocks (AVLrk100-411)
    "avllk1s": "swamp",       # lakes: the s suffix means swamp here
    "avllk2s": "swamp",
    "avllk3s": "swamp",
    "avlctrs": "swamp",       # crater set: d/g/l/r/s, s = swamp too
    "avlrk1s": "swamp", "avlrk2s": "swamp", "avlrk3s": "swamp",
    "avlrk4s": "swamp",   # mossy rocks: s = swamp, not sand
    "avlrk3d": "dirt", "avlrk5d": "dirt",
    "avlmoss": "swamp",   # moss patch
    "avldt": "swamp",     # dead trees on mossy mounds (only s variants)
    "avlhols": "swamp",   # hole set AVLhol{d,g,l,r,s,u}: s = swamp
    "avls0": "swamp",     # swamp shrubs AVLs01s0-s09s0
    "avls1": "swamp",     # AVLs10s0, AVLs11s0
    "avls1sn": "snow",    # snow shrubs (keep clear of the avls1 rule)
    "avlms": "subterranean",  # mushrooms
    "avlca1r": "rough", "avlca2r": "rough",  # rough-terrain cacti
    "avltro": "rough", "avltrro": "rough",  # rough-terrain trees
    "avlswp": "swamp", "avlman": "swamp", "avlwlw": "swamp",
    "avlmtsb": "subterranean",
    "avlstm": "dirt",         # stumps
    "avlglly": "rough",       # gully
    "avlholx": None,
    "avlstg": "subterranean", # stalagmite outcrops
    "avlklp": None,           # kelp - water only, skip for now
    "avlflk": None,
    "avlrfx": None,
    "trdc": None, "trdd": None, "trdg": None,
    "clrrvr": None, "clrd": None,
}

def classify(stem: str):
    low = stem.lower()
    # longest prefix first so specific rules beat general families
    for pre in sorted(FAMILY_OVERRIDES, key=len, reverse=True):
        if low.startswith(pre):
            return FAMILY_OVERRIDES[pre]
    body = low[:-1] if low[-1].isdigit() else low  # strip variant digit
    body = re.sub(r"\d+$", "", body)               # some have 2-digit variants
    for suf in ("sn", "sw"):
        if body.endswith(suf):
            return SUFFIX_BIOMES[suf]
    if body and body[-1] in SUFFIX_BIOMES:
        return SUFFIX_BIOMES[body[-1]]
    return "generic"

# --- animation detection ----------------------------------------------------
# The lava/volcano/sea sprites are exported animations: one file per frame,
# named <family><frame>.png. Collapse each into a single object with a
# "frames" list so they render animated and aren't overrepresented in the
# placement pool. A family is an animation when >=4 files of identical size
# have >50% identical pixels between consecutive frames (real frames measure
# 0.6-0.97; distinct static variants stay below 0.4).

def _similarity(pa, pb):
    ia = np.asarray(Image.open(pa).convert("RGBA"), dtype=int)
    ib = np.asarray(Image.open(pb).convert("RGBA"), dtype=int)
    if ia.shape != ib.shape:
        return 0.0
    return float((np.abs(ia - ib).sum(axis=2) == 0).mean())

def collapse_animations(objects):
    byfile = {o["file"]: o for o in objects}
    groups = {}
    for o in objects:
        groups.setdefault(re.sub(r"\d\.png$", "", o["file"]), []).append(
            o["file"])
    consumed = set()
    frames_of = {}
    for key in sorted(groups):
        files = sorted(groups[key])
        if len(files) < 4:
            continue
        size = {(byfile[f]["w"], byfile[f]["h"]) for f in files}
        if len(size) != 1:
            continue
        paths = [OBJECTS_DIR / f for f in files]
        if min(_similarity(paths[i], paths[i + 1])
               for i in range(len(paths) - 1)) <= 0.5:
            continue
        # two-digit continuations: AVLrk100..109 goes on to 110, 111
        if key[-1:].isdigit() and len(files) == 10:
            n = 10
            while True:
                cand = f"{key[:-1]}{n}.png"
                if (cand not in byfile or cand in consumed or
                    (byfile[cand]["w"], byfile[cand]["h"]) != size.copy().pop()
                    or _similarity(OBJECTS_DIR / files[-1],
                                   OBJECTS_DIR / cand) <= 0.5):
                    break
                files.append(cand)
                n += 1
        consumed.update(files)
        frames_of[files[0]] = files
    out = []
    for o in objects:
        if o["file"] in frames_of:
            o = dict(o, frames=frames_of[o["file"]])
        elif o["file"] in consumed:
            continue
        out.append(o)
    return out, len(frames_of)

def main():
    manifest = {"terrains": {}, "water": {}, "rivers": {}, "roads": {},
                "objects": []}

    files = {p.name: p for p in TERRAIN_DIR.glob("*.png")}
    names = sorted(files)

    for code, tname in TERRAINS.items():
        entry = {"base": [], "dirt": {}, "sand": {}, "mixed": []}
        for n in names:
            m = re.fullmatch(rf"t{code}([bdsm])(\d)(\d)(\d)\.png", n)
            if not m:
                continue
            kind, p, v = m.group(1), m.group(3), m.group(4)
            if kind == "b":
                entry["base"].append(n)
            elif kind == "m":
                entry["mixed"].append(n)
            else:
                key = {"d": "dirt", "s": "sand"}[kind]
                # The "4" files are extra variants of other patterns (see
                # docstring): 0-1 are corners, 2-3 are diagonals.
                if p == "4":
                    p = "0" if v in ("0", "1") else "3"
                entry[key].setdefault(p, []).append(n)
        manifest["terrains"][tname] = entry

    water = {"corner": [], "left": [], "top": [], "diag": [],
             "surrounded": [], "open": []}
    groups = [(range(1, 5), "corner"), (range(5, 9), "left"),
              (range(9, 13), "top"), (list(range(13, 17)) + [19, 20], "diag"),
              (range(17, 19), "surrounded"), (range(21, 34), "open")]
    for rng, key in groups:
        for i in rng:
            n = f"watrtl{i:02d}.png"
            if n in files:
                water[key].append(n)
    manifest["water"] = water

    for pre, rname in RIVERS.items():
        manifest["rivers"][rname] = [f"{pre}{i:02d}.png" for i in range(13)
                                     if f"{pre}{i:02d}.png" in files]
    for pre, rname in ROADS.items():
        road = {}
        for n in names:
            m = re.fullmatch(rf"{pre}(\d)(\d)(\d)\.png", n)
            if m:
                road.setdefault(m.group(2), []).append(n)
        manifest["roads"][rname] = road

    for p in sorted(OBJECTS_DIR.glob("*.png")):
        biome = classify(p.stem)
        if biome is None:
            continue
        with Image.open(p) as img:
            w, h = img.size
        manifest["objects"].append(
            {"file": p.name, "biome": biome, "w": w // 32, "h": h // 32})

    manifest["objects"], n_anim = collapse_animations(manifest["objects"])

    OUT.write_text("// Generated by tools/generate_manifest.py - do not edit\n"
                   "const MANIFEST = " + json.dumps(manifest) + ";\n")
    n_obj = len(manifest["objects"])
    from collections import Counter
    print(f"Wrote {OUT.name}: {n_obj} objects ({n_anim} animated),",
          Counter(o["biome"] for o in manifest["objects"]))

if __name__ == "__main__":
    main()

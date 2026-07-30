# no might, no magic

A generator of Heroes of Might and Magic III landscapes, in the spirit of the
map editor's random terrain tool. Plain HTML/CSS/JS, no build step — serve the
folder with any static server (e.g. `python3 -m http.server`) and open
`index.html`.

## Controls

Gear button or `C` toggles the panel; `R` generates a new map.
Options: seed, biome selection, water, rivers, roads, road type, region
count, object density, zoom.

## Layout

- `index.html`, `css/style.css`, `js/*.js` — the site
- `assets/terrain/` — ground tiles, rivers, roads, shore, rock, map edges
  (converted from the extracted game files, see pipeline below)
- `landscape sprites/` — adventure-map objects (`AVL*`), transparent
  backgrounds, shadows pre-applied
- `js/manifest.js` — generated index of all sprites; regenerate with
  `python3 tools/generate_manifest.py` after changing assets
- `tools/generate_manifest.py` — scans both asset folders, classifies
  objects into biomes by filename conventions, and collapses animation
  frame files (lava flows/lakes, volcanoes, reefs, sea rocks) into
  single objects with a `frames` list, detected by pixel similarity
  between consecutive same-size files; the renderer cycles the frames
  at ~5.5 fps with a per-placement phase offset

## Asset pipeline

Source rips live in
`~/Dropbox/a e s t h e t i c/~stuff-i-make/game sprites and assets/heroes 3
sprites rm background shadow/`. The `bg` folder of the Terrains (v2) rip was
converted with `convert_sprites_v3.py` there: pure cyan `#00FFFF` becomes
transparent; the magenta shadow ramp `#FF00FF/#FF32FF/#FF64FF/#FF96FF`
becomes translucent black at alpha 140/117/93/70 (the two middle shades only
appear in the `Tshre` shore tiles).

## Tile grammar (decoded from the sprites)

Ground tiles are 32×32, named `t{gr|dt|sn|sa|sw|ro|su|vl}{b|d|s|m}NNN.png`
(grass, dirt, snow, sand, swamp, rough, subterranean, lava):

- `b` — plain center variants (~24 per terrain)
- `d` — border against **dirt** (used against any other land terrain too)
- `s` — border against **sand or water**
- `m` — mixed dirt+sand border (present, not yet used by the renderer)

Border sets have 4 patterns of 4-6 variants, `NNN` = `0` + pattern + variant.
Canonical orientation, mirrored at render time for the other directions:

| pattern | foreign terrain sits… |
|---------|----------------------|
| 0 | top + left edges (deep corner, own terrain only at bottom-right) |
| 1 | left (vertical edge) |
| 2 | top (horizontal edge) |
| 3 | bottom-right diagonal only |

The files numbered `040`–`043` are not a fifth pattern: `040`/`041` are
extra pattern-0 corners and `042`/`043` extra pattern-3 diagonals; the
manifest generator files them accordingly. No art exists for a tile with
foreign terrain on all four edges — the smoothing pass removes those.

Water (`watrtl01–33`): 01–04 corner, 05–08 left, 09–12 top, 13–16 + 19–20
diagonal, 17–18 surrounded, 21–33 open water. The land-side coast is just the
land terrain's `s` border; the beach art lives on the water tiles.

Rivers (`{clr|icy|mud|lav}rvr00–12`): 00–03 right+bottom elbow, 04 cross,
05–06 T (no top), 07–08 T (no left), 09–10 vertical, 11–12 horizontal.
Each river has one type for its whole length: lava only inside the lava
biome (normal rivers never enter it), icy only when fully in snow, dry
beds (`mudrvr`) rare and only when fully in rough/dirt, otherwise clear.
Rivers begin at the map edge or under a biome-matching mountain object
and must run off the map edge; they avoid the sea entirely, and
dangling walks are rejected. Roads run from one map edge to another and
never cross water. Rivers and roads are never covered by any part of an
object; the source mountain is the one sanctioned exception.
Roads (`TRDC|trdd|trdg` + `0PV`): same idea plus diagonal turn variants
(`010–013`), end caps (`040` from bottom, `041` from right).

Transition rules mirror the game: dirt and sand are base terrains. Every
other land terrain draws its `d` border against dirt *and* against any other
land terrain (the thin dirt seam you see in-game), and its `s` border against
sand and water. Dirt draws only `s` borders; sand draws none. Tiles whose
neighborhood fits no sprite (three foreign edges, opposite edges, etc.) are
removed by the generator's smoothing pass, which converts them toward
neighboring terrain — and converts tiles that would need unavailable mixed
dirt+sand art into dirt, exactly because dirt borders everything.

## Not yet used

- `t??m` mixed dirt+sand border tiles
- `Tshre/Tshrc` translucent shoreline overlays
- `rocktl` subterranean rock borders, `EDG` map-edge tiles
- river deltas (`clrd{a|b|c|d}NN` in `landscape sprites/`, 3×3 tiles,
  trunk on the middle tile of the entry edge; clear rivers only)
- kelp/flotsam water objects (`AVLklp`, `AVLflk`)

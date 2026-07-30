// Seeded PRNG: xmur3 string hash feeding mulberry32.
function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return function () {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h ^= h >>> 16) >>> 0;
    };
}

function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function makeRng(seedStr) {
    const rng = mulberry32(xmur3(seedStr)());
    rng.int = (n) => Math.floor(rng() * n);
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    return rng;
}

// Deterministic per-cell hash for stable variant selection.
function cellHash(x, y, salt) {
    let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ salt;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
}

// Map generation: biome zones, transition-validity smoothing, rivers,
// roads, object placement. Mirrors the constraints of the HoMM3 map
// editor's terrain sprites (see README for the tile grammar).

const LAND_TERRAINS = ["grass", "dirt", "snow", "sand", "swamp", "rough",
                       "subterranean", "lava"];

// --- neighbor bookkeeping ---------------------------------------------
// Edges are indexed T,R,B,L (0-3); diagonals TL,TR,BR,BL (0-3).
const EDGE_DX = [0, 1, 0, -1], EDGE_DY = [-1, 0, 1, 0];
const DIAG_DX = [-1, 1, 1, -1], DIAG_DY = [-1, -1, 1, 1];
// diagonal i is adjacent to these two edges
const DIAG_EDGES = [[0, 3], [0, 1], [2, 1], [2, 3]];

function terrainAt(map, x, y) {
    if (x < 0) x = 0; if (y < 0) y = 0;
    if (x >= map.w) x = map.w - 1; if (y >= map.h) y = map.h - 1;
    return map.t[y * map.w + x];
}

// Foreign-neighbor masks for the tile's border categories.
// D = borders drawn with the dirt set, S = with the sand set,
// W = water's own border set (foreign = any land).
function foreignMasks(map, x, y) {
    const t = terrainAt(map, x, y);
    const mk = () => ({ edges: [false, false, false, false],
                        diags: [false, false, false, false] });
    const res = { D: mk(), S: mk(), W: mk() };
    const test = (n) => {
        if (t === "water") return { W: n !== "water" };
        if (t === "sand") return {};
        if (n === "sand" || n === "water") return { S: true };
        if (t === "dirt") return {};
        if (n === "dirt" || n !== t) return { D: true };
        return {};
    };
    for (let i = 0; i < 4; i++) {
        const c = test(terrainAt(map, x + EDGE_DX[i], y + EDGE_DY[i]));
        if (c.D) res.D.edges[i] = true;
        if (c.S) res.S.edges[i] = true;
        if (c.W) res.W.edges[i] = true;
    }
    for (let i = 0; i < 4; i++) {
        const c = test(terrainAt(map, x + DIAG_DX[i], y + DIAG_DY[i]));
        if (c.D) res.D.diags[i] = true;
        if (c.S) res.S.diags[i] = true;
        if (c.W) res.W.diags[i] = true;
    }
    return res;
}

// Match a foreign mask against the 5 canonical patterns (+ mirroring).
// Returns {p, flipH, flipV} (p: 0=corner 1=left 2=top 3=diag 4=surrounded)
// or null if no sprite exists for this configuration, or {p:-1} for plain.
function matchPattern(mask) {
    const e = mask.edges, d = mask.diags;
    const nEdges = e.filter(Boolean).length;
    // free diagonals: foreign diagonals not flanked by a foreign edge
    const free = d.map((f, i) =>
        f && !e[DIAG_EDGES[i][0]] && !e[DIAG_EDGES[i][1]]);
    const nFree = free.filter(Boolean).length;

    if (nEdges === 0) {
        if (nFree === 0) return { p: -1, flipH: false, flipV: false };
        if (nFree > 1) return null;
        const i = free.indexOf(true); // canonical art: foreign at BR (diag 2)
        if (i === 2) return { p: 3, flipH: false, flipV: false };
        if (i === 3) return { p: 3, flipH: true, flipV: false };
        if (i === 1) return { p: 3, flipH: false, flipV: true };
        return { p: 3, flipH: true, flipV: true }; // TL
    }
    if (nEdges === 1) {
        if (nFree > 0) return null;
        if (e[3]) return { p: 1, flipH: false, flipV: false }; // left
        if (e[1]) return { p: 1, flipH: true, flipV: false };  // right
        if (e[0]) return { p: 2, flipH: false, flipV: false }; // top
        return { p: 2, flipH: false, flipV: true };            // bottom
    }
    if (nEdges === 2) {
        if (nFree > 0) return null;
        if (e[0] && e[3]) return { p: 0, flipH: false, flipV: false };
        if (e[0] && e[1]) return { p: 0, flipH: true, flipV: false };
        if (e[2] && e[3]) return { p: 0, flipH: false, flipV: true };
        if (e[2] && e[1]) return { p: 0, flipH: true, flipV: true };
        return null; // opposite edges
    }
    if (nEdges === 4) {
        const own = d.map(f => !f);
        if (own.filter(Boolean).length !== 1) return null;
        const i = own.indexOf(true); // canonical art: own terrain at BR
        if (i === 2) return { p: 4, flipH: false, flipV: false };
        if (i === 3) return { p: 4, flipH: true, flipV: false };
        if (i === 1) return { p: 4, flipH: false, flipV: true };
        return { p: 4, flipH: true, flipV: true };
    }
    return null; // 3 edges
}

// A tile is renderable if each of its border categories matches a pattern
// with existing art and it doesn't need dirt- and sand-borders at once
// (no mixed art in v1).
function landMatch(t, key, mask) {
    const m = matchPattern(mask);
    if (m === null) return false;
    const files = MANIFEST.terrains[t][key][String(m.p)];
    return !!(files && files.length);
}

function tileValid(map, x, y) {
    const t = terrainAt(map, x, y);
    const m = foreignMasks(map, x, y);
    if (t === "water") {
        // water connected only diagonally renders as odd triangle pairs
        const orth = m.W.edges.filter(Boolean).length;
        if (orth === 4) return false;
        return matchPattern(m.W) !== null;
    }
    if (t === "sand") return true;
    const hasD = m.D.edges.some(Boolean) || m.D.diags.some(Boolean);
    const hasS = m.S.edges.some(Boolean) || m.S.diags.some(Boolean);
    if (hasD && hasS) return false;
    if (hasD) return landMatch(t, "dirt", m.D);
    if (hasS) return landMatch(t, "sand", m.S);
    return true;
}

// --- zone layout --------------------------------------------------------
function makeNoise(rng, w, h, cell) {
    const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
    const g = Array.from({ length: gw * gh }, () => rng() * 2 - 1);
    return (x, y) => {
        const fx = x / cell, fy = y / cell;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = fx - x0, ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const v = (xx, yy) => g[yy * gw + xx];
        const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * sx;
        const b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * sx;
        return a + (b - a) * sy;
    };
}

function generateTerrain(rng, w, h, biomes, waterOn, zoneCount) {
    const centers = [];
    const pool = biomes.slice();
    const nZones = Math.max(zoneCount, waterOn ? pool.length + 1 : pool.length);
    for (let i = 0; i < nZones; i++) {
        let biome;
        if (waterOn && i === 0) biome = "water";
        else if (i - (waterOn ? 1 : 0) < pool.length)
            biome = pool[i - (waterOn ? 1 : 0)];
        else biome = waterOn && (pool.length === 0 || rng() < 0.15)
            ? "water" : rng.pick(pool);
        centers.push({ x: rng() * w, y: rng() * h, t: biome });
    }
    const warpX = makeNoise(rng, w, h, 7), warpY = makeNoise(rng, w, h, 7);
    const map = { w, h, t: new Array(w * h) };
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const wx = x + warpX(x, y) * 6, wy = y + warpY(x, y) * 6;
            let best = 0, bd = Infinity;
            for (let i = 0; i < centers.length; i++) {
                const dx = wx - centers[i].x, dy = wy - centers[i].y;
                const dd = dx * dx + dy * dy;
                if (dd < bd) { bd = dd; best = i; }
            }
            map.t[y * w + x] = centers[best].t;
        }
    }
    return map;
}

function majoritySmooth(map, rng, rounds) {
    for (let r = 0; r < rounds; r++) {
        const next = map.t.slice();
        for (let y = 0; y < map.h; y++) {
            for (let x = 0; x < map.w; x++) {
                const counts = {};
                for (let dy = -1; dy <= 1; dy++)
                    for (let dx = -1; dx <= 1; dx++) {
                        const t = terrainAt(map, x + dx, y + dy);
                        counts[t] = (counts[t] || 0) + (dx || dy ? 1 : 2);
                    }
                let best = null, bn = -1;
                for (const t in counts)
                    if (counts[t] > bn) { bn = counts[t]; best = t; }
                next[y * map.w + x] = best;
            }
        }
        map.t = next;
    }
}

// Convert tiles whose border configuration has no sprite until stable.
function constraintSmooth(map, rng) {
    for (let iter = 0; iter < 60; iter++) {
        let changed = 0;
        for (let y = 0; y < map.h; y++) {
            for (let x = 0; x < map.w; x++) {
                if (tileValid(map, x, y)) continue;
                const t = terrainAt(map, x, y);
                const m = foreignMasks(map, x, y);
                const hasD = m.D.edges.some(Boolean) || m.D.diags.some(Boolean);
                const hasS = m.S.edges.some(Boolean) || m.S.diags.some(Boolean);
                let to;
                if (t !== "water" && t !== "dirt" && hasD && hasS) {
                    // needs mixed border art -> become dirt, the universal
                    // base terrain (a sand conversion would cascade sand
                    // seams along every biome border)
                    to = "dirt";
                } else {
                    // become the most common neighboring terrain
                    const counts = {};
                    for (let dy = -1; dy <= 1; dy++)
                        for (let dx = -1; dx <= 1; dx++) {
                            if (!dx && !dy) continue;
                            const n = terrainAt(map, x + dx, y + dy);
                            counts[n] = (counts[n] || 0) + 1;
                        }
                    delete counts[t];
                    let bn = -1;
                    for (const n in counts)
                        if (counts[n] > bn) { bn = counts[n]; to = n; }
                }
                if (to && to !== t) { map.t[y * map.w + x] = to; changed++; }
            }
        }
        if (!changed) return 0;
    }
    let bad = 0;
    for (let y = 0; y < map.h; y++)
        for (let x = 0; x < map.w; x++)
            if (!tileValid(map, x, y)) bad++;
    return bad;
}

// --- rivers and roads ---------------------------------------------------
function walkPath(map, rng, start, isGoal, maxLen, goalDir) {
    const path = [start];
    const seen = new Set([start.x + "," + start.y]);
    let dir = rng.int(4);
    let cur = start;
    for (let i = 0; i < maxLen; i++) {
        if (isGoal(cur) && i > 5) break;
        const opts = [];
        for (let d = 0; d < 4; d++) {
            if ((d + 2) % 4 === dir % 4 && d !== dir) continue; // no reverse
            const nx = cur.x + EDGE_DX[d], ny = cur.y + EDGE_DY[d];
            if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) {
                opts.push({ d, x: nx, y: ny, off: true });
                continue;
            }
            if (seen.has(nx + "," + ny)) continue;
            // never run alongside or into an earlier stretch of the path:
            // the candidate may only touch the current tile
            let touches = false;
            for (let e = 0; e < 4; e++) {
                const ax = nx + EDGE_DX[e], ay = ny + EDGE_DY[e];
                if (ax === cur.x && ay === cur.y) continue;
                if (seen.has(ax + "," + ay)) { touches = true; break; }
            }
            if (touches) continue;
            let wgt = d === dir ? 4 : 1;
            if (goalDir !== undefined && d === goalDir) wgt += 4;
            for (let k = 0; k < wgt; k++) opts.push({ d, x: nx, y: ny });
        }
        if (!opts.length) break;
        const step = rng.pick(opts);
        if (step.off) break;
        dir = step.d;
        cur = { x: step.x, y: step.y };
        seen.add(cur.x + "," + cur.y);
        path.push(cur);
    }
    return path;
}

// One type per river, chosen by where the whole river runs:
// lava rivers exist only inside the lava biome (and normal rivers never
// enter it), icy only when fully in snow, dry beds (mud) are rare and
// only when fully in rough/dirt, everything else is clear.
// A river must run off the map edge; walks that end in the interior
// (or in water — rivers avoid the sea entirely) are rejected.
function generateRivers(map, rng, count) {
    const rivers = [];
    const claimed = new Set();
    for (let i = 0; i < count; i++) {
        for (let attempt = 0; attempt < 8; attempt++) {
            // some rivers enter from the map edge; the rest get a
            // mountain source placed over their first tile
            const fromEdge = rng() < 0.4;
            let start = null;
            for (let tries = 0; tries < 50 && !start; tries++) {
                let x, y;
                if (fromEdge) {
                    const side = rng.int(4);
                    x = side === 1 ? map.w - 1
                        : side === 3 ? 0 : rng.int(map.w);
                    y = side === 0 ? 0
                        : side === 2 ? map.h - 1 : rng.int(map.h);
                } else {
                    x = 2 + rng.int(map.w - 4);
                    y = 2 + rng.int(map.h - 4);
                }
                if (terrainAt(map, x, y) !== "water" &&
                    !claimed.has(x + "," + y)) start = { x, y };
            }
            if (!start) break;
            let path = walkPath(map, rng, start,
                (c) => c.x === 0 || c.y === 0 ||
                       c.x === map.w - 1 || c.y === map.h - 1,
                map.w + map.h);
            // cut the walk where it stops being a valid river: at
            // water, at the lava border, or at an earlier river
            const onLava = terrainAt(map, start.x, start.y) === "lava";
            let cut = path.length;
            for (let j = 0; j < path.length; j++) {
                const c = path[j], t = terrainAt(map, c.x, c.y);
                if (j > 0 && claimed.has(c.x + "," + c.y)) { cut = j; break; }
                if (t === "water") { cut = j; break; }
                if (onLava !== (t === "lava")) { cut = j; break; }
            }
            path = path.slice(0, cut);
            if (path.length <= 6) continue;
            const last = path[path.length - 1];
            if (last.x > 0 && last.y > 0 &&
                last.x < map.w - 1 && last.y < map.h - 1) continue;
            const terrs = path.map((c) => terrainAt(map, c.x, c.y));
            let type = "clear";
            if (onLava) type = "lava";
            else if (terrs.every((t) => t === "snow")) type = "icy";
            else if (terrs.every((t) => t === "rough" || t === "dirt") &&
                     rng() < 0.25) type = "mud";
            for (const c of path) claimed.add(c.x + "," + c.y);
            rivers.push({ path, type });
            break;
        }
    }
    return rivers;
}

// A biome-matching mountain over each interior river source, so rivers
// visibly spring from under it. Feet may cover only the river's first
// two tiles, never roads or other river stretches. Sets r.mount on
// success; interior-source rivers without one are discarded upstream.
function sourceMountains(map, rng, rivers, riverCells, roadCells) {
    const mounts = [];
    for (const r of rivers) {
        const s = r.path[0];
        if (s.x === 0 || s.y === 0 ||
            s.x === map.w - 1 || s.y === map.h - 1) continue;
        const t = terrainAt(map, s.x, s.y);
        const pool = MANIFEST.objects.filter((o) =>
            o.biome === t && /^avlmt/i.test(o.file) &&
            o.w <= 5 && o.h <= 4 && o.h <= s.y + 1);
        if (!pool.length) continue;
        const allowed = new Set([s.x + "," + s.y]);
        if (r.path[1]) allowed.add(r.path[1].x + "," + r.path[1].y);
        // first pass wants all feet on the source biome; if the source
        // sits on a biome border, settle for a straddling mountain
        let placedOne = false;
        for (const strict of [true, false]) {
            for (let tries = 0; tries < 16 && !placedOne; tries++) {
                const o = rng.pick(pool);
                const x0 = s.x - rng.int(o.w);
                if (x0 < 0 || x0 + o.w > map.w) continue;
                let ok = true;
                for (let k = 0; k < o.w && ok; k++) {
                    const key = (x0 + k) + "," + s.y;
                    if (strict && terrainAt(map, x0 + k, s.y) !== t)
                        ok = false;
                    else if (terrainAt(map, x0 + k, s.y) === "water")
                        ok = false;
                    else if (roadCells.has(key)) ok = false;
                    else if (riverCells.has(key) && !allowed.has(key))
                        ok = false;
                }
                if (ok) {
                    mounts.push({ file: o.file, x: x0, y: s.y - o.h + 1,
                                  w: o.w, h: o.h });
                    r.mount = true;
                    placedOne = true;
                }
            }
            if (placedOne) break;
        }
    }
    return mounts;
}

// Roads must run from one map edge to another; walks that get stuck in
// the interior or would cross water are rejected.
function generateRoads(map, rng, count) {
    const roads = [];
    for (let i = 0; i < count; i++) {
        for (let attempt = 0; attempt < 6; attempt++) {
            const vertical = rng() < 0.5;
            const start = vertical
                ? { x: 2 + rng.int(map.w - 4), y: 0 }
                : { x: 0, y: 2 + rng.int(map.h - 4) };
            const path = walkPath(map, rng, start,
                (c) => vertical ? c.y >= map.h - 1 : c.x >= map.w - 1,
                (map.w + map.h) * 2, vertical ? 2 : 1);
            if (path.length <= 8) continue;
            const last = path[path.length - 1];
            if (last.x > 0 && last.y > 0 &&
                last.x < map.w - 1 && last.y < map.h - 1) continue;
            if (path.some((p) => terrainAt(map, p.x, p.y) === "water"))
                continue;
            roads.push({ path });
            break;
        }
    }
    return roads;
}

// Connection mask (T,R,B,L booleans) for each cell of a set of paths.
// Only path endpoints continue off the map; cells that merely run along
// the border must not sprout extra off-map outlets.
function connectionMasks(map, paths) {
    const cells = new Set();
    for (const p of paths)
        for (const c of p.path) cells.add(c.x + "," + c.y);
    const conns = new Map();
    for (const key of cells) {
        const [x, y] = key.split(",").map(Number);
        const m = [];
        for (let d = 0; d < 4; d++) {
            const nx = x + EDGE_DX[d], ny = y + EDGE_DY[d];
            m.push(cells.has(nx + "," + ny));
        }
        conns.set(key, m);
    }
    for (const p of paths) {
        const n = p.path.length;
        patchOffMap(map, conns, p.path[0], p.path[1]);
        patchOffMap(map, conns, p.path[n - 1], p.path[n - 2]);
    }
    return conns;
}

// Extend a border endpoint's mask off the map, preferring to continue
// straight through the edge. Interior endpoints are left alone.
function patchOffMap(map, conns, end, prev) {
    if (!end) return;
    const offDirs = [];
    for (let d = 0; d < 4; d++) {
        const nx = end.x + EDGE_DX[d], ny = end.y + EDGE_DY[d];
        if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) offDirs.push(d);
    }
    if (!offDirs.length) return;
    let dir = offDirs[0];
    if (prev) {
        const straight = EDGE_DX.findIndex((dx, d) =>
            end.x - prev.x === dx && end.y - prev.y === EDGE_DY[d]);
        if (offDirs.includes(straight)) dir = straight;
    }
    conns.get(end.x + "," + end.y)[dir] = true;
}

// --- objects -------------------------------------------------------------
function placeObjects(map, rng, riverCells, roadCells, density, preplaced) {
    const objsByBiome = {};
    for (const o of MANIFEST.objects) {
        (objsByBiome[o.biome] = objsByBiome[o.biome] || []).push(o);
    }
    const occupied = new Uint8Array(map.w * map.h);
    // rivers and roads may never be covered by any part of an object
    // (source mountains, placed below, are the one sanctioned exception)
    const noCover = new Uint8Array(map.w * map.h);
    for (const key of riverCells) {
        const [x, y] = key.split(",").map(Number);
        occupied[y * map.w + x] = 1;
        noCover[y * map.w + x] = 1;
    }
    for (const key of roadCells) {
        const [x, y] = key.split(",").map(Number);
        occupied[y * map.w + x] = 1;
        noCover[y * map.w + x] = 1;
    }
    const placed = [];
    for (const o of preplaced || []) {
        const fy = o.y + o.h - 1;
        for (let dx = 0; dx < o.w; dx++)
            occupied[fy * map.w + (o.x + dx)] = 1;
        placed.push(o);
    }
    const attempts = Math.floor(map.w * map.h * density);
    for (let i = 0; i < attempts; i++) {
        const x = rng.int(map.w), y = rng.int(map.h);
        const t = terrainAt(map, x, y);
        // open water stays mostly empty: reefs and sea rocks are sparse
        // accents, not carpet
        if (t === "water" && rng() < 0.80) continue;
        const pool = objsByBiome[t];
        if (!pool || !pool.length) continue;
        const o = rng.pick(pool);
        if (x + o.w > map.w || y - o.h + 1 < 0) continue;
        // Only the object's bottom row of cells ("feet") blocks and must
        // match the biome - canopies may overlap, like in the game.
        let ok = true;
        for (let dx = 0; dx < o.w && ok; dx++) {
            if (occupied[y * map.w + (x + dx)]) ok = false;
            else if (terrainAt(map, x + dx, y) !== t) ok = false;
        }
        // the whole sprite, canopy included, must stay off rivers/roads
        for (let dy = 0; dy < o.h && ok; dy++)
            for (let dx = 0; dx < o.w && ok; dx++)
                if (noCover[(y - dy) * map.w + (x + dx)]) ok = false;
        if (ok && t === "water") {
            // reefs only on open water, away from the coast
            for (let dy = 0; dy < o.h && ok; dy++)
                for (let dx = 0; dx < o.w && ok; dx++)
                    for (let ey = -1; ey <= 1 && ok; ey++)
                        for (let ex = -1; ex <= 1 && ok; ex++)
                            if (terrainAt(map, x + dx + ex,
                                          y - dy + ey) !== "water")
                                ok = false;
        }
        if (!ok) continue;
        for (let dx = 0; dx < o.w; dx++)
            occupied[y * map.w + (x + dx)] = 1;
        placed.push({ file: o.file, frames: o.frames,
                      x, y: y - o.h + 1, w: o.w, h: o.h });
    }
    placed.sort((a, b) => (a.y + a.h) - (b.y + b.h) || a.x - b.x);
    return placed;
}

// --- entry point ----------------------------------------------------------
function generateMap(opts) {
    const rng = makeRng(opts.seed);
    const { w, h } = opts;
    const biomes = opts.biomes.length ? opts.biomes : (opts.water ? [] : ["grass"]);
    const map = generateTerrain(rng, w, h, biomes, opts.water, opts.zones);
    majoritySmooth(map, rng, 2);
    const bad = constraintSmooth(map, rng);
    if (bad) console.warn(bad + " tiles left unmatchable; rendered plain");

    const area = w * h;
    let rivers = opts.rivers
        ? generateRivers(map, rng, Math.max(1, Math.round(area / 900))) : [];
    const roads = opts.roads
        ? generateRoads(map, rng, Math.max(1, Math.round(area / 1400))) : [];

    const roadConns = connectionMasks(map, roads);
    const roadType = opts.roadType === "auto"
        ? rng.pick(Object.keys(MANIFEST.roads)) : opts.roadType;
    const roadCells = new Set(roadConns.keys());

    // interior-source rivers must spring from under a mountain; drop
    // the rare ones where no mountain fits
    let riverCells = new Set();
    for (const r of rivers)
        for (const c of r.path) riverCells.add(c.x + "," + c.y);
    const mounts = sourceMountains(map, rng, rivers, riverCells, roadCells);
    rivers = rivers.filter((r) => {
        const s = r.path[0];
        return r.mount || s.x === 0 || s.y === 0 ||
               s.x === map.w - 1 || s.y === map.h - 1;
    });
    riverCells = new Set();
    for (const r of rivers) {
        r.conns = connectionMasks(map, [r]);
        for (const c of r.path) riverCells.add(c.x + "," + c.y);
    }

    const objects = placeObjects(map, rng, riverCells, roadCells,
                                 opts.density, mounts);

    return { map, rivers,
             roads: { conns: roadConns, type: roadType },
             objects, salt: xmur3(opts.seed)() };
}

// Rendering: picks the correct sprite (+ mirroring) for every tile from
// its neighborhood, then draws terrain, rivers, roads, and objects.

const TILE = 32;
const TERRAIN_URL = "assets/terrain/";
const OBJECT_URL = "landscape sprites/";

const imageCache = new Map();
function loadImage(url) {
    if (imageCache.has(url)) return imageCache.get(url);
    const p = new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("missing " + url));
        img.src = encodeURI(url);
    });
    imageCache.set(url, p);
    return p;
}

// pattern index -> manifest group key for land border sets
const LAND_GROUP = { 0: "0", 1: "1", 2: "2", 3: "3", 4: "4" };
const WATER_GROUP = { 0: "corner", 1: "left", 2: "top", 3: "diag",
                      4: "surrounded" };

function pickVariant(files, x, y, salt) {
    return files[cellHash(x, y, salt) % files.length];
}

// Decide the sprite for one terrain tile.
function tileSprite(map, x, y, salt) {
    const t = terrainAt(map, x, y);
    const masks = foreignMasks(map, x, y);
    const plain = (setName) =>
        ({ file: pickVariant(setName, x, y, salt), flipH: false, flipV: false });

    if (t === "water") {
        const m = matchPattern(masks.W);
        if (!m || m.p === -1) return plain(MANIFEST.water.open);
        const files = MANIFEST.water[WATER_GROUP[m.p]];
        return { file: pickVariant(files, x, y, salt),
                 flipH: m.flipH, flipV: m.flipV };
    }
    const entry = MANIFEST.terrains[t];
    if (t === "sand") return plain(entry.base);
    const hasD = masks.D.edges.some(Boolean) || masks.D.diags.some(Boolean);
    const hasS = masks.S.edges.some(Boolean) || masks.S.diags.some(Boolean);
    let set = null, m = null;
    if (hasS && !hasD) { m = matchPattern(masks.S); set = entry.sand; }
    else if (hasD && !hasS) { m = matchPattern(masks.D); set = entry.dirt; }
    else if (!hasD && !hasS) return plain(entry.base);
    if (!m || m.p === -1 || !set[LAND_GROUP[m.p]])
        return plain(entry.base); // smoothing fallback
    const files = set[LAND_GROUP[m.p]];
    return { file: pickVariant(files, x, y, salt),
             flipH: m.flipH, flipV: m.flipV };
}

// Overlay frame tables: suffix number -> connections it serves.
// Base orientations; other orientations come from mirroring.
const RIVER_FRAMES = [
    { conn: "RB", nums: [0, 1, 2, 3] },
    { conn: "TRBL", nums: [4] },
    { conn: "RBL", nums: [5, 6] },
    { conn: "TRB", nums: [7, 8] },
    { conn: "TB", nums: [9, 10] },
    { conn: "RL", nums: [11, 12] },
];
const ROAD_FRAMES = [
    { conn: "RB", nums: [0, 1, 10, 11, 12, 13] },
    { conn: "TRB", nums: [20, 21] },
    { conn: "RBL", nums: [22, 23] },
    { conn: "TB", nums: [30, 31] },
    { conn: "RL", nums: [32, 33] },
    { conn: "B", nums: [40] },
    { conn: "R", nums: [41] },
    { conn: "TRBL", nums: [50] },
];

// Map a T,R,B,L connection mask onto a base frame + flips.
function overlayFrame(mask, frames, x, y, salt) {
    const [T, R, B, L] = mask;
    const n = (T ? 1 : 0) + (R ? 1 : 0) + (B ? 1 : 0) + (L ? 1 : 0);
    const find = (c) => frames.find(f => f.conn === c);
    let f = null, flipH = false, flipV = false;
    if (n === 4) f = find("TRBL");
    else if (n === 3) {
        if (!T) f = find("RBL");
        else if (!L) f = find("TRB");
        else if (!B) { f = find("RBL"); flipV = true; }
        else { f = find("TRB"); flipH = true; }
    } else if (n === 2) {
        if (T && B) f = find("TB");
        else if (L && R) f = find("RL");
        else {
            f = find("RB");
            flipH = L; flipV = T;
        }
    } else if (n === 1) {
        if (find("B")) { // road set has end caps
            if (B) f = find("B");
            else if (T) { f = find("B"); flipV = true; }
            else if (R) f = find("R");
            else { f = find("R"); flipH = true; }
        } else {         // rivers end with a straight piece
            f = (T || B) ? find("TB") : find("RL");
        }
    }
    if (!f) return null;
    const num = f.nums[cellHash(x, y, salt) % f.nums.length];
    return { num, flipH, flipV };
}

function drawTile(ctx, img, x, y, flipH, flipV) {
    const s = TILE;
    ctx.save();
    ctx.translate(x * s + (flipH ? s : 0), y * s + (flipV ? s : 0));
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(img, 0, 0, s, s);
    ctx.restore();
}

let animTimer = null;

async function renderMap(canvas, gen) {
    if (animTimer) { clearInterval(animTimer); animTimer = null; }
    const { map, rivers, roads, objects, salt } = gen;
    canvas.width = map.w * TILE;
    canvas.height = map.h * TILE;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    // resolve every sprite first so we can batch-load
    const tiles = [];
    for (let y = 0; y < map.h; y++)
        for (let x = 0; x < map.w; x++)
            tiles.push({ x, y, ...tileSprite(map, x, y, salt) });

    const RIVER_PREFIX = { clear: "clrrvr", icy: "icyrvr",
                           mud: "mudrvr", lava: "lavrvr" };
    const roadPrefix = { cobblestone: "TRDC", dirt: "trdd",
                         gravel: "trdg" }[roads.type];
    const overlays = [];
    for (const r of rivers) {
        const prefix = RIVER_PREFIX[r.type];
        for (const [key, mask] of r.conns) {
            const [x, y] = key.split(",").map(Number);
            const f = overlayFrame(mask, RIVER_FRAMES, x, y, salt);
            if (f) overlays.push({ x, y, flipH: f.flipH, flipV: f.flipV,
                file: prefix + String(f.num).padStart(2, "0") + ".png" });
        }
    }
    for (const [key, mask] of roads.conns) {
        const [x, y] = key.split(",").map(Number);
        const f = overlayFrame(mask, ROAD_FRAMES, x, y, salt);
        if (f) overlays.push({ x, y, flipH: f.flipH, flipV: f.flipV,
            file: roadPrefix + String(f.num).padStart(3, "0") + ".png" });
    }

    const urls = new Set();
    for (const t of tiles) urls.add(TERRAIN_URL + t.file);
    for (const o of overlays) urls.add(TERRAIN_URL + o.file);
    for (const o of objects) {
        if (o.frames) for (const f of o.frames) urls.add(OBJECT_URL + f);
        else urls.add(OBJECT_URL + o.file);
    }
    const loaded = new Map();
    await Promise.all([...urls].map(async (u) => {
        try { loaded.set(u, await loadImage(u)); }
        catch (e) { console.warn(e.message); }
    }));

    let tick = 0;
    const draw = () => {
        for (const t of tiles) {
            const img = loaded.get(TERRAIN_URL + t.file);
            if (img) drawTile(ctx, img, t.x, t.y, t.flipH, t.flipV);
        }
        for (const o of overlays) {
            const img = loaded.get(TERRAIN_URL + o.file);
            if (img) drawTile(ctx, img, o.x, o.y, o.flipH, o.flipV);
        }
        for (const o of objects) {
            // stagger animation phase per placement so instances of the
            // same object don't pulse in sync
            const file = o.frames
                ? o.frames[(tick + o.x + o.y) % o.frames.length]
                : o.file;
            const img = loaded.get(OBJECT_URL + file);
            if (img) ctx.drawImage(img, o.x * TILE, o.y * TILE);
        }
    };
    draw();
    if (objects.some((o) => o.frames))
        animTimer = setInterval(() => { tick++; draw(); }, 180);
}

// UI wiring: controls panel, seed handling, regeneration.

const ALL_BIOMES = ["grass", "dirt", "snow", "sand", "swamp", "rough",
                    "subterranean", "lava"];

function randomSeed() {
    return Math.random().toString(36).slice(2, 10);
}

function readOptions() {
    const biomes = ALL_BIOMES.filter(
        (b) => document.getElementById("biome-" + b).checked);
    return {
        seed: document.getElementById("seed").value || randomSeed(),
        w: Math.ceil(window.innerWidth / TILE),
        h: Math.ceil(window.innerHeight / TILE),
        biomes,
        water: document.getElementById("water").checked,
        rivers: document.getElementById("rivers").checked,
        roads: document.getElementById("roads").checked,
        roadType: document.getElementById("roadType").value,
        zones: parseInt(document.getElementById("zones").value, 10),
        density: parseFloat(document.getElementById("density").value),
    };
}

// Snapshot of the generation knobs that "repopulate objects" re-applies
// (everything except viewport size, which resize handles on its own).
function optionsKey(opts) {
    return JSON.stringify({
        seed: opts.seed,
        biomes: opts.biomes,
        water: opts.water,
        rivers: opts.rivers,
        roads: opts.roads,
        roadType: opts.roadType,
        zones: opts.zones,
        density: opts.density,
    });
}

let appliedKey = null;
let rendering = false;

function updateRegenVisibility() {
    const dirty = appliedKey !== null &&
        optionsKey(readOptions()) !== appliedKey;
    document.querySelector("#controls .buttons")
        .classList.toggle("show", dirty);
}

async function regenerate(newSeed) {
    if (rendering) return;
    rendering = true;
    try {
        if (newSeed) document.getElementById("seed").value = randomSeed();
        const opts = readOptions();
        const gen = generateMap(opts);
        await renderMap(document.getElementById("map"), gen);
        appliedKey = optionsKey(opts);
        updateRegenVisibility();
    } finally {
        rendering = false;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const panel = document.getElementById("controls");
    const about = document.getElementById("about");
    const corner = document.getElementById("corner");
    function openAbout() { about.hidden = false; }
    function closeAbout() { about.hidden = true; }
    document.getElementById("gear").addEventListener("click",
        () => panel.classList.toggle("open"));
    document.getElementById("about-btn").addEventListener("click", openAbout);
    document.getElementById("about-close").addEventListener("click", closeAbout);
    about.addEventListener("click", (e) => {
        if (e.target === about) closeAbout();
    });
    document.getElementById("regen").addEventListener("click",
        () => regenerate(false));
    document.getElementById("newseed").addEventListener("click",
        () => regenerate(true));
    document.getElementById("map").addEventListener("click",
        () => regenerate(true));
    let cornerHideTimer;
    document.addEventListener("mousemove", () => {
        corner.classList.add("show");
        clearTimeout(cornerHideTimer);
        cornerHideTimer = setTimeout(() => {
            if (!panel.classList.contains("open") && about.hidden)
                corner.classList.remove("show");
        }, 1500);
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !about.hidden) {
            closeAbout();
            return;
        }
        if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")
            return;
        if (e.key === "r" || e.key === "R") regenerate(true);
        if (e.key === "c" || e.key === "C") panel.classList.toggle("open");
    });
    let resizeTimer;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => regenerate(false), 300);
    });
    panel.addEventListener("input", updateRegenVisibility);
    panel.addEventListener("change", updateRegenVisibility);
    for (const b of ALL_BIOMES)
        document.getElementById("biome-" + b).checked = Math.random() < 0.5;
    if (!ALL_BIOMES.some((b) => document.getElementById("biome-" + b).checked))
        document.getElementById("biome-" + ALL_BIOMES[
            Math.floor(Math.random() * ALL_BIOMES.length)]).checked = true;
    document.getElementById("water").checked = Math.random() < 0.5;
    document.getElementById("rivers").checked = Math.random() < 0.5;
    document.getElementById("roads").checked = Math.random() < 0.5;
    document.getElementById("seed").value = randomSeed();
    regenerate(false);
});

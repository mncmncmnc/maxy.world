// Max's Closet — JSON-driven SPA.
// Three views: randomizer (vertical stack + control panel), categories (library),
// classic (preserves the original randomizer look).

const STATE = {
  items: [],
  byCat: new Map(), // key: "category/subcategory" -> items[]
  pools: {},        // slot name -> filtered items[] (stable order, for prev/next stepping)
  slotIndex: {},    // slot name -> current index in its pool
};

// Bucket items for the randomizer. Keep this small and explicit; the human
// can rename/rearrange categories without breaking lookups.
const SLOT_FILTERS = {
  top: (e) => e.category === "tops",
  bottom: (e) => e.category === "bottoms",
  shoe: (e) => e.category === "shoes",
  jacket: (e) => e.category === "outerwear",
  sunglasses: (e) => e.category === "accessories" && e.subcategory === "sunglasses",
  hat: (e) => e.category === "accessories" && e.subcategory === "hats",
  scarf: (e) => e.category === "accessories" && e.subcategory === "scarves",
  bag: (e) => e.category === "accessories" && e.subcategory === "bags",
};

function pickRandom(items) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function setSlot(slotEl, entry) {
  const img = slotEl.querySelector("img");
  const cap = slotEl.querySelector("figcaption");
  if (!entry) {
    img.removeAttribute("src");
    cap.textContent = "—";
    return;
  }
  img.src = entry.image;
  img.alt = entry.item;
  cap.textContent = entry.brand ? `${entry.brand} — ${entry.item}` : entry.item;
  if (img.complete && img.naturalWidth) {
    positionLock(slotEl);
  } else {
    img.addEventListener("load", () => positionLock(slotEl), { once: true });
  }
}

// Position the .lock-btn at the top-right corner of the visible image content
// (accounting for object-fit: contain letter/pillarboxing). The lock-btn CSS
// `top`/`right` defaults act as fallback while images load or if JS fails.
function positionLock(slotEl) {
  if (!slotEl || slotEl.hidden) return;
  const img = slotEl.querySelector("img");
  const lock = slotEl.querySelector(".lock-btn");
  if (!img || !lock) return;
  if (!img.naturalWidth || !img.naturalHeight) return;
  const imgRect = img.getBoundingClientRect();
  if (imgRect.width === 0 || imgRect.height === 0) return;
  const ratioImg = img.naturalWidth / img.naturalHeight;
  const ratioBox = imgRect.width / imgRect.height;
  let contentTopInImg, contentRightInImg;
  if (ratioImg > ratioBox) {
    // Letterboxed (gap top/bottom)
    const contentH = imgRect.width / ratioImg;
    contentTopInImg = (imgRect.height - contentH) / 2;
    contentRightInImg = imgRect.width;
  } else {
    // Pillarboxed (gap left/right)
    contentTopInImg = 0;
    const contentW = imgRect.height * ratioImg;
    contentRightInImg = (imgRect.width + contentW) / 2;
  }
  const slotRect = slotEl.getBoundingClientRect();
  const imgTopInSlot = imgRect.top - slotRect.top;
  const imgLeftInSlot = imgRect.left - slotRect.left;
  lock.style.top = `${imgTopInSlot + contentTopInImg + 4}px`;
  lock.style.right = `${slotRect.width - (imgLeftInSlot + contentRightInImg) + 4}px`;
}

function repositionAllLocks() {
  document.querySelectorAll("#view-randomizer .slot").forEach(positionLock);
}

// Watch each slot image for size changes (caused by flex redistribution when
// checkboxes toggle, window resizes, etc.) and reposition the lock to match.
function watchSlotImageSizes() {
  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const slotEl = entry.target.closest(".slot");
      if (slotEl) positionLock(slotEl);
    }
  });
  document.querySelectorAll("#view-randomizer .slot img").forEach((img) => ro.observe(img));
}

function pickRandomForSlot(slot, slotEl) {
  const pool = STATE.pools[slot];
  if (!pool || !pool.length) return;
  const idx = Math.floor(Math.random() * pool.length);
  STATE.slotIndex[slot] = idx;
  setSlot(slotEl, pool[idx]);
}

function stepSlot(slot, direction) {
  const pool = STATE.pools[slot];
  if (!pool || !pool.length) return;
  const cur = STATE.slotIndex[slot] ?? 0;
  const next = (cur + direction + pool.length) % pool.length;
  STATE.slotIndex[slot] = next;
  const slotEl = document.querySelector(`#view-randomizer .slot[data-slot="${slot}"]`);
  if (slotEl) setSlot(slotEl, pool[next]);
}

function shuffleOutfit() {
  document.querySelectorAll("#view-randomizer .slot").forEach((slotEl) => {
    const slot = slotEl.dataset.slot;
    const cb = document.querySelector(`#control-panel input[data-opt="${slot}"]`);
    if (cb && !cb.checked) {
      slotEl.hidden = true;
      return;
    }
    slotEl.hidden = false;
    if (slotEl.classList.contains("locked")) return;
    pickRandomForSlot(slot, slotEl);
  });
}

function toggleSlotFromCheckbox(cb) {
  const slot = cb.dataset.opt;
  const slotEl = document.querySelector(`#view-randomizer .slot[data-slot="${slot}"]`);
  if (!slotEl) return;
  if (cb.checked) {
    slotEl.hidden = false;
    pickRandomForSlot(slot, slotEl);
  } else {
    slotEl.classList.remove("locked");
    slotEl.hidden = true;
  }
}

const LOCK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;

function injectSlotControls() {
  document.querySelectorAll("#view-randomizer .slot").forEach((slotEl) => {
    const slot = slotEl.dataset.slot;
    const prev = document.createElement("button");
    prev.className = "nav-arrow prev";
    prev.type = "button";
    prev.setAttribute("aria-label", `previous ${slot}`);
    prev.textContent = "‹";
    prev.addEventListener("click", () => stepSlot(slot, -1));
    const next = document.createElement("button");
    next.className = "nav-arrow next";
    next.type = "button";
    next.setAttribute("aria-label", `next ${slot}`);
    next.textContent = "›";
    next.addEventListener("click", () => stepSlot(slot, 1));
    const lock = document.createElement("button");
    lock.className = "lock-btn";
    lock.type = "button";
    lock.setAttribute("aria-label", `lock ${slot}`);
    lock.innerHTML = LOCK_SVG;
    lock.addEventListener("click", () => slotEl.classList.toggle("locked"));
    slotEl.appendChild(prev);
    slotEl.appendChild(next);
    slotEl.appendChild(lock);
  });
}

// ---- Categories / library view ----

function buildCategoryNav() {
  const nav = document.getElementById("category-nav");
  nav.innerHTML = "";
  for (const [key, items] of STATE.byCat) {
    const [cat, sub] = key.split("/");
    const btn = document.createElement("button");
    btn.className = "cat-btn";
    btn.dataset.key = key;
    btn.textContent = sub || cat;
    btn.addEventListener("click", () => renderLibrary(key));
    nav.appendChild(btn);
  }
}

function renderLibrary(key) {
  document.querySelectorAll(".cat-btn").forEach((b) =>
    b.toggleAttribute("aria-current", b.dataset.key === key)
  );
  const lib = document.getElementById("library");
  lib.innerHTML = "";
  const items = STATE.byCat.get(key) || [];
  for (const e of items) {
    const fig = document.createElement("figure");
    fig.className = "library-item";
    const img = document.createElement("img");
    img.src = e.image;
    img.alt = e.item;
    img.loading = "lazy";
    const cap = document.createElement("figcaption");
    cap.innerHTML = `<strong>${e.brand || ""}</strong><br>${e.item}` +
      (e.tags && e.tags.length ? `<br><small>${e.tags.join(" · ")}</small>` : "");
    fig.appendChild(img);
    fig.appendChild(cap);
    lib.appendChild(fig);
  }
}

// ---- Classic view (mirrors original behavior) ----

function classicShuffle() {
  const pick = (filter) => {
    const pool = STATE.items.filter(filter);
    return pickRandom(pool);
  };
  const set = (id, entry) => {
    const el = document.getElementById(id);
    if (el && entry) el.src = entry.image;
  };
  set("image_shower", pick(SLOT_FILTERS.bottom));
  set("image_shower2", pick(SLOT_FILTERS.top));
  set("image_shower3", pick(SLOT_FILTERS.jacket));
  set("image_shower4", pick(SLOT_FILTERS.shoe));
  set("image_shower6", pick(SLOT_FILTERS.sunglasses));
  set("image_shower7", pick(SLOT_FILTERS.hat));
  set("image_shower8", pick(SLOT_FILTERS.scarf));
  set("image_shower9", pick(SLOT_FILTERS.bag));
}

// ---- Tab switching ----

function showView(name) {
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.view === name;
    t.toggleAttribute("aria-current", active);
  });
  document.querySelectorAll(".view").forEach((v) => {
    v.hidden = v.id !== `view-${name}`;
  });
  if (name === "classic" && !STATE.classicSeeded) {
    classicShuffle();
    STATE.classicSeeded = true;
  }
  if (name === "randomizer") {
    requestAnimationFrame(repositionAllLocks);
  }
}

// ---- Boot ----

async function boot() {
  const res = await fetch("closet.json");
  if (!res.ok) throw new Error(`Failed to load closet.json: ${res.status}`);
  STATE.items = await res.json();

  // Group by category/subcategory.
  for (const e of STATE.items) {
    const key = e.subcategory ? `${e.category}/${e.subcategory}` : `${e.category}/`;
    if (!STATE.byCat.has(key)) STATE.byCat.set(key, []);
    STATE.byCat.get(key).push(e);
  }
  // Sort the map by key for a stable category nav.
  STATE.byCat = new Map([...STATE.byCat.entries()].sort());

  // Precompute the pool for each slot once. Pools are stable across the session.
  for (const slot of Object.keys(SLOT_FILTERS)) {
    STATE.pools[slot] = STATE.items.filter(SLOT_FILTERS[slot]);
  }

  injectSlotControls();
  watchSlotImageSizes();

  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => showView(t.dataset.view))
  );
  document.getElementById("shuffle").addEventListener("click", shuffleOutfit);
  document.getElementById("classic-shuffle").addEventListener("click", classicShuffle);
  document.querySelectorAll("#control-panel input[type=checkbox]").forEach((cb) =>
    cb.addEventListener("change", () => toggleSlotFromCheckbox(cb))
  );

  buildCategoryNav();
  // Default to first category in the library so it's not blank.
  const firstKey = STATE.byCat.keys().next().value;
  if (firstKey) renderLibrary(firstKey);

  shuffleOutfit();
  showView("randomizer");
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<p style="color:red;padding:1em">Failed to load closet.json — serve this directory over HTTP (e.g. <code>python3 -m http.server</code>) and reload. (${err.message})</p>`
  );
});

(function () {
  const caret = document.createElement("span");
  caret.className = "terminal-caret";
  caret.setAttribute("aria-hidden", "true");

  let activePassageId = null;
  let marginWindowCount = 0;
  const everRevealed = new Set();
  let titleAuthorWindowShown = false;
  const TOTAL_PASSAGES = 21;

  const MARGIN_DECORATIONS = [
    /*  1. A flower */
    "   \\ | /\n  -- * --\n   / | \\\n    \\|\n   / \\\n  '   '",
    /*  2. A different flower */
    "   ___\n  /   \\\n |  *  |\n  \\___/\n  / | \\\n '  |  '",
    /*  3. A cube */
    "   +---+\n  /   /|\n +---+ |\n |   |/\n +---+",
    /*  4. A different flower */
    "   ) (\n  ( * )\n   ) (\n  /   \\\n |     |\n  \\___/",
    /*  5. A different flower */
    "  \\|/   \\|/\n   \\ \\ / /\n  ~ \\V/ ~\n     |\n    / \\",
    /*  6. A leaf */
    "   \\   /\n    \\ /\n     V\n    /|\\\n   / | \\\n  '  |  '",
    /*  7. A vine */
    "  ~ \\|/ ~\n   \\ | /\n    \\|/\n   / | \\\n  ~ \\|/ ~\n     |",
    /*  8. An ocean wave */
    "    ~~~~~\n  ~~     ~~\n~~  ~~~~~~~  ~~",
    /*  9. A Scepter */
    "     ( )\n     | |\n     | |\n  ---+---\n     |\n     |\n    / \\",
    /* 10. A tower */
    "   +---+\n   |   |\n   +---+\n   |   |\n   +---+\n  /     \\",
    /* 11. Fleur */
    "   )|\n  (_)\n   |\n  /|\\\n   |\n  / \\",
    /* 12. Mosaic */
    "  +-+-+\n  |#| |\n  +-+-+\n  | |#|\n  +-+-+",
    /* 13. A wound */
    "   (   )\n  (     )\n (   *   )\n  (     )\n   (   )",
    /* 14. A winding path */
    "  __\n /  \\_\n \\    /\n  \\__/\n    \\_\n      \\__",
    /* 15. Rolling hills */
    "  /\\  /\\\n /  \\/  \\\n/        \\",
    /* 16. Shooting stars */
    "  *\n   \\\n    *\n     \\\n  *   *\n   \\ /",
    /* 17. Two forests */
    "  Y   Y\n  |   |\n /|\\ /|\\\n  |   |\n  |   |",
    /* 18. A stream */
    "  ~~  ~~  ~~\n~~  ~~  ~~  ~~\n  ~~  ~~  ~~",
    /* 19. A storm */
    "  \\  |  /\n   \\ | /\n  ---*---\n   /|\\\n  / | \\\n '  *  '",
    /* 20. A cage */
    "  +-+-+\n  | | |\n  +-+-+\n  | | |\n  +-+-+"
  ];

  function frameDoodle(str) {
    const lines = str.split("\n").map((s) => s.trim());
    const maxLen = Math.max(...lines.map((s) => s.length));
    return lines
      .map((s) => {
        const leftPad = Math.floor((maxLen - s.length) / 2);
        const rightPad = maxLen - s.length - leftPad;
        return " ".repeat(leftPad) + s + " ".repeat(rightPad);
      })
      .join("\n");
  }

  function addMarginWindow() {
    const leftEl = document.querySelector(".margins-left");
    const rightEl = document.querySelector(".margins-right");
    const bottomEl = document.querySelector(".margins-bottom");
    if (!leftEl || !rightEl || !bottomEl) return;
    const doodleIndex = marginWindowCount % MARGIN_DECORATIONS.length;
    const isBottomSlot = marginWindowCount >= 16 && marginWindowCount < 20;
    const container = isBottomSlot ? bottomEl : (marginWindowCount % 2 === 0 ? leftEl : rightEl);
    marginWindowCount += 1;
    const content = document.createElement("div");
    content.className = "margin-window-content";
    content.textContent = frameDoodle(MARGIN_DECORATIONS[doodleIndex]);
    const titleBar = document.createElement("div");
    titleBar.className = "margin-window-titlebar";
    titleBar.innerHTML =
      '<span class="window-control" role="button" tabindex="0" data-action="close" aria-label="Close"></span>' +
      '<span class="window-control" role="button" tabindex="0" data-action="minimize" aria-label="Minimize"></span>' +
      '<span class="window-control" role="button" tabindex="0" data-action="expand" aria-label="Expand"></span>';
    const win = document.createElement("div");
    win.className = "margin-window";
    win.appendChild(titleBar);
    win.appendChild(content);
    container.appendChild(win);
  }

  function showTitleAuthorWindow() {
    if (titleAuthorWindowShown) return;
    titleAuthorWindowShown = true;
    const bottomEl = document.querySelector(".margins-bottom");
    if (!bottomEl) return;
    const content = document.createElement("div");
    content.className = "margin-window-content title-author-window";
    content.innerHTML = "<div class=\"title-author-title\">Angel in Latency</div><div class=\"title-author-by\">By Grace Dignazio</div>";
    const titleBar = document.createElement("div");
    titleBar.className = "margin-window-titlebar";
    titleBar.innerHTML =
      '<span class="window-control" role="button" tabindex="0" data-action="close" aria-label="Close"></span>' +
      '<span class="window-control" role="button" tabindex="0" data-action="minimize" aria-label="Minimize"></span>' +
      '<span class="window-control" role="button" tabindex="0" data-action="expand" aria-label="Expand"></span>';
    const win = document.createElement("div");
    win.className = "margin-window";
    win.appendChild(titleBar);
    win.appendChild(content);
    bottomEl.appendChild(win);
  }

  function checkPieceFinished() {
    if (everRevealed.size !== TOTAL_PASSAGES) return;
    showTitleAuthorWindow();
  }

  document.addEventListener("click", (event) => {
    const btn = event.target.closest(".window-control");
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    const action = btn.getAttribute("data-action");
    const win = btn.closest(".terminal, .margin-window");
    if (!win) return;
    if (action === "close") {
      if (win.classList.contains("margin-window")) win.remove();
    } else if (action === "minimize") {
      win.classList.toggle("minimized");
      win.classList.remove("expanded");
    } else if (action === "expand") {
      win.classList.toggle("expanded");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const btn = event.target.closest(".window-control");
    if (!btn) return;
    event.preventDefault();
    btn.click();
  });

  function placeCaret(passageEl) {
    if (caret.parentNode) caret.parentNode.removeChild(caret);
    if (!passageEl || !passageEl.classList.contains("revealed")) return;
    const p = passageEl.querySelector("p");
    if (p) p.appendChild(caret);
  }

  function updateLinkRevealedState() {
    document.querySelectorAll("a.choice[data-target]").forEach((link) => {
      const id = link.getAttribute("data-target");
      const passage = id ? document.getElementById(id) : null;
      const isRevealed = passage && passage.classList.contains("revealed");
      link.classList.toggle("target-revealed", !!isRevealed);
    });
  }

  function togglePassage(id) {
    const passage = document.getElementById(id);
    if (!passage) return;
    const isNowRevealed = passage.classList.toggle("revealed");
    updateLinkRevealedState();

    if (isNowRevealed) {
      everRevealed.add(id);
      activePassageId = id;
      placeCaret(passage);
      addMarginWindow();
      checkPieceFinished();
      passage.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else if (activePassageId === id) {
      activePassageId = null;
      placeCaret(null);
    }
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-target]");
    if (!link) return;
    const target = link.getAttribute("data-target");
    if (!target) return;
    event.preventDefault();
    togglePassage(target);
  });

  updateLinkRevealedState();
  const initialRevealed = document.querySelector(".passage.revealed");
  if (initialRevealed) {
    everRevealed.add(initialRevealed.id);
    activePassageId = initialRevealed.id;
    placeCaret(initialRevealed);
  }
  checkPieceFinished();
})();


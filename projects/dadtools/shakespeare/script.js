(function () {
  var passageEl = document.getElementById("passage");
  var headingEl = document.querySelector(".heading");
  var workEl = document.getElementById("work");
  var metaEl = document.getElementById("meta");
  var noteEl = document.getElementById("note");
  var sourceEl = document.getElementById("source");
  var button = document.getElementById("another");
  var listButton = document.getElementById("list");
  var listEl = document.getElementById("index");

  var entries = [];
  var lastIndex = -1;

  var playOrder = [
    "The Two Gentlemen of Verona",
    "The Taming of the Shrew",
    "Henry VI, Part 2",
    "Henry VI, Part 3",
    "Titus Andronicus",
    "Richard III",
    "Love's Labour's Lost",
    "Richard II",
    "Romeo and Juliet",
    "A Midsummer Night's Dream",
    "King John",
    "The Merchant of Venice",
    "Henry IV, Part 1",
    "The Merry Wives of Windsor",
    "Henry IV, Part 2",
    "Much Ado About Nothing",
    "Henry V",
    "Julius Caesar",
    "As You Like It",
    "Hamlet",
    "Twelfth Night",
    "Troilus and Cressida",
    "Sir Thomas More",
    "Measure for Measure",
    "Othello",
    "All's Well That Ends Well",
    "Timon of Athens",
    "King Lear",
    "Macbeth",
    "Antony and Cleopatra",
    "Coriolanus",
    "The Winter's Tale",
    "Cymbeline",
    "The Tempest",
    "Henry VIII",
    "Sonnets"
  ];

  function pick() {
    if (!entries.length) return;

    var index = Math.floor(Math.random() * entries.length);
    if (entries.length > 1) {
      while (index === lastIndex) {
        index = Math.floor(Math.random() * entries.length);
      }
    }

    present(index);
  }

  function choose(index) {
    present(index);
  }

  function present(index) {
    lastIndex = index;
    show(entries[index]);
    markCurrent(index);
    setListOpen(false);
    window.scrollTo(0, 0);
  }

  function setListOpen(open) {
    listEl.hidden = !open;
    passageEl.hidden = open;
    sourceEl.hidden = open;
    headingEl.hidden = open;
    listButton.setAttribute("aria-expanded", open ? "true" : "false");

    if (!open) return;

    var current = listEl.querySelector("[aria-current='true']");
    if (current) current.scrollIntoView({ block: "center" });
    else window.scrollTo(0, 0);
  }

  function markCurrent(index) {
    var items = listEl.querySelectorAll("button");
    for (var i = 0; i < items.length; i++) {
      if (Number(items[i].dataset.index) === index) {
        items[i].setAttribute("aria-current", "true");
      } else {
        items[i].removeAttribute("aria-current");
      }
    }
  }

  function renderList() {
    listEl.textContent = "";

    var groups = [];
    var byName = {};

    entries.forEach(function (entry, index) {
      var name = entry.category === "sonnet" ? "Sonnets" : (entry.work || "");
      if (!byName[name]) {
        byName[name] = { name: name, items: [] };
        groups.push(byName[name]);
      }
      byName[name].items.push({ entry: entry, index: index });
    });

    groups.sort(function (a, b) {
      var aIndex = playOrder.indexOf(a.name);
      var bIndex = playOrder.indexOf(b.name);
      if (aIndex === -1) aIndex = playOrder.length;
      if (bIndex === -1) bIndex = playOrder.length;
      return aIndex - bIndex;
    });

    groups.forEach(function (groupData) {
      var group = document.createElement("section");
      group.className = "group";

      var heading = document.createElement("h2");
      heading.className = "group-label";
      heading.textContent = groupData.name;
      group.appendChild(heading);

      groupData.items.forEach(function (item) {
        var entry = item.entry;
        var control = document.createElement("button");
        control.type = "button";
        control.dataset.index = String(item.index);

        var title = document.createElement("span");
        title.className = "item-title";
        title.textContent = entry.title || "";
        control.appendChild(title);

        var bits = [];
        if (entry.speaker) bits.push(entry.speaker);
        if (entry.location) bits.push(entry.location);
        if (bits.length) {
          var meta = document.createElement("span");
          meta.className = "item-meta";
          meta.textContent = bits.join(" · ");
          control.appendChild(meta);
        }

        control.addEventListener("click", function () {
          choose(item.index);
        });

        group.appendChild(control);
      });

      listEl.appendChild(group);
    });
  }

  function show(entry) {
    document.title = entry.title;

    workEl.hidden = false;
    workEl.textContent = entry.work || "";

    var bits = [];
    if (entry.speaker) bits.push(entry.speaker);
    if (entry.location) bits.push(entry.location);
    metaEl.textContent = bits.join(" · ");

    if (entry.note) {
      noteEl.hidden = false;
      noteEl.textContent = entry.note;
    } else {
      noteEl.hidden = true;
      noteEl.textContent = "";
    }

    sourceEl.textContent = entry.source || "";
    passageEl.textContent = "";

    var blocks = entry.passage || [];
    var speakers = [];
    blocks.forEach(function (block) {
      if (block.speaker && speakers.indexOf(block.speaker) === -1) {
        speakers.push(block.speaker);
      }
    });
    var showSpeakers = speakers.length > 1;
    var previousSpeaker = "";

    blocks.forEach(function (block) {
      if (showSpeakers && block.speaker && block.speaker !== previousSpeaker) {
        var name = document.createElement("p");
        name.className = "speaker";
        name.textContent = block.speaker;
        passageEl.appendChild(name);
      }
      previousSpeaker = block.speaker || previousSpeaker;

      if (block.form === "prose") {
        var prose = document.createElement("p");
        prose.className = "prose";
        prose.textContent = block.text || "";
        passageEl.appendChild(prose);
        return;
      }

      var verse = document.createElement("div");
      verse.className = "verse";
      (block.lines || []).forEach(function (line) {
        var lineEl = document.createElement("p");
        lineEl.textContent = line;
        verse.appendChild(lineEl);
      });
      passageEl.appendChild(verse);
    });
  }

  button.addEventListener("click", pick);

  listButton.addEventListener("click", function () {
    setListOpen(listEl.hidden);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !listEl.hidden) setListOpen(false);
  });

  fetch("shakespeare-speeches.json")
    .then(function (response) {
      if (!response.ok) throw new Error("Could not load speeches");
      return response.json();
    })
    .then(function (data) {
      entries = data.entries || [];
      renderList();
      pick();
    })
    .catch(function () {
      passageEl.textContent = "The speeches could not be loaded.";
    });
})();

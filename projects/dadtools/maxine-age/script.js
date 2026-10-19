const fonts = [
  "Data70.woff2",
  "Hershey-Futural-40.woff",
  "NIS-JTC-Win-M9-Condensed.woff2",
  "OldLondon.woff2",
  "texgyreschola-italic.woff2",
  "unison-pro-bold.woff"
];

function pickFont() {
  const file = fonts[Math.floor(Math.random() * fonts.length)];
  const format = file.slice(file.lastIndexOf(".") + 1);
  const style = document.createElement("style");
  style.textContent =
    '@font-face{font-family:"Age Face";src:url("fonts/' +
    encodeURIComponent(file) +
    '") format("' + format +
    '");font-weight:400;font-style:normal;font-display:swap;}';
  document.head.appendChild(style);
}

pickFont();

const birth = new Date(2026, 8, 26);

function unit(count, singular, plural) {
  return count + "\u00a0" + (count === 1 ? singular : plural);
}

function ageText(now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (today < birth) return "0 days old";

  let years = 0;
  for (;;) {
    const next = new Date(birth.getFullYear() + years + 1, birth.getMonth(), birth.getDate());
    if (next > today) break;
    years += 1;
  }

  const yearMark = new Date(birth.getFullYear() + years, birth.getMonth(), birth.getDate());
  let months = 0;
  let cursor = yearMark;
  for (;;) {
    const next = new Date(yearMark.getFullYear(), yearMark.getMonth() + months + 1, yearMark.getDate());
    if (next > today) break;
    months += 1;
    cursor = next;
  }

  const daysSince = Math.round((today - cursor) / 86400000);
  if (years === 0 && months === 0) return unit(daysSince, "day", "days") + "\u00a0old";

  const weeks = Math.floor(daysSince / 7);
  const days = daysSince % 7;
  const parts = [];
  if (years) parts.push(unit(years, "year", "years"));
  if (months) parts.push(unit(months, "month", "months"));
  if (weeks) parts.push(unit(weeks, "week", "weeks"));
  if (days) parts.push(unit(days, "day", "days"));
  return parts.join(", ") + "\u00a0old";
}

function render() {
  document.getElementById("age").textContent = ageText(new Date());
}

function scheduleNextDay() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  setTimeout(function () {
    render();
    scheduleNextDay();
  }, next - now + 1000);
}

render();
scheduleNextDay();

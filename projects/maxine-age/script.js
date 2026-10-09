const birth = new Date(2026, 8, 26);

function unit(count, singular, plural) {
  return count + "\u00a0" + (count === 1 ? singular : plural);
}

function ageText(now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (today < birth) return "0 DAYS OLD";

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
  if (years === 0 && months === 0) return unit(daysSince, "DAY", "DAYS") + "\u00a0OLD";

  const weeks = Math.floor(daysSince / 7);
  const days = daysSince % 7;
  const parts = [];
  if (years) parts.push(unit(years, "YEAR", "YEARS"));
  if (months) parts.push(unit(months, "MONTH", "MONTHS"));
  if (weeks) parts.push(unit(weeks, "WEEK", "WEEKS"));
  if (days) parts.push(unit(days, "DAY", "DAYS"));
  return parts.join(", ") + "\u00a0OLD";
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

import {
  DAYPARTS,
  WEEKDAYS,
  MONTHLY_OCCURRENCES,
  blankPlan,
  samplePlan,
  validatePlan,
  orderActivities,
  reorderActivities,
  activitiesForDate,
  summarizeDay,
  dateKey,
  parseDate,
  formatDate,
  formatMinutes,
  isoWeek,
  weeksInYear,
  dateFromIsoWeek,
  recurrenceLabel,
} from "./core.js?v=6";
import { $, esc } from "./ui.js";
import { confirmDialog, promptDialog } from "./dialogs.js?v=4";
const today = dateKey(new Date());
const DEFAULT_FILTERS = Object.freeze({
  q: "",
  day: "",
  active: "",
  recurrence: "",
});
const PRINT_PAGE_ACTIVITY_LIMIT = 21;
const CAPACITY_WARNING_PERCENTAGE = 75;
const CAPACITY_OVERLOAD_PERCENTAGE = 100;
const DEFAULT_DEADLINE_DAY = "mon";
const PRINT_DATE_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const state = {
  plan: null,
  status: "Geen planning geopend",
  dirty: false,
  lastUpdated: null,
  page: "home",
  date: today,
  mode: "week",
  weekYear: isoWeek(new Date()).year,
  week: isoWeek(new Date()).week,
  filters: { ...DEFAULT_FILTERS },
};
const RECOVERY_KEY = "actiplan-recovery-v1";
const timeValue = (plan, day, key) => plan.metadata.daypartTimes[day][key];
const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const printDate = (date) => capitalize(PRINT_DATE_FORMATTER.format(date));
const daypartTimeMap = (plan) =>
  Object.fromEntries(
    WEEKDAYS.map(([day]) => [
      day,
      Object.fromEntries(
        DAYPARTS.map(([key]) => [key, timeValue(plan, day, key)]),
      ),
    ]),
  );
const afwijkendeDagenVoorDagdeel = (plan, key) =>
  WEEKDAYS.filter(
    ([day]) =>
      day !== DEFAULT_DEADLINE_DAY &&
      timeValue(plan, day, key) !== timeValue(plan, DEFAULT_DEADLINE_DAY, key),
  ).map(([, label]) => label.toLowerCase());
const timeToMinutes = (value) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};
const persistRecovery = () => {
  if (!state.plan || !state.dirty) return;
  try {
    localStorage.setItem(
      RECOVERY_KEY,
      JSON.stringify({ plan: state.plan, savedAt: new Date().toISOString() }),
    );
  } catch (err) {
    console.error("Herstelversie kon niet worden opgeslagen.", err);
  }
};
const clearRecovery = () => {
  try {
    localStorage.removeItem(RECOVERY_KEY);
  } catch (err) {
    console.error("Herstelversie kon niet worden verwijderd.", err);
  }
};
const setStatus = (text, dirty = state.dirty) => {
  state.status = text;
  state.dirty = dirty;
  if (dirty) {
    state.lastUpdated = new Date().toISOString();
    persistRecovery();
  }
  const statusElement = $("#status"),
    saveButton = $("#save-plan");
  statusElement.textContent = text;
  statusElement.hidden = !state.plan;
  statusElement.classList.toggle("changed", dirty);
  if (saveButton) {
    saveButton.textContent = dirty ? "Wijzigingen opslaan" : "Opslaan";
    saveButton.classList.toggle("save-plan-needed", dirty);
  }
  const title = state.plan?.metadata.title,
    department = state.plan?.metadata.department,
    summary =
      title && department && title === `Planning ${department}`
        ? title
        : title && department
          ? `${title} · ${department}`
          : "Geen planning geopend";
  $("#file-summary").textContent = summary;
};
const toast = (text, error = false) => {
  const t = $("#toast");
  t.textContent = text;
  t.className = `toast show ${error ? "error" : ""}`;
  setTimeout(() => (t.className = "toast"), 4000);
};
function pageGuard() {
  const statusElement = $("#status");
  if (!state.plan) {
    $("#welcome").hidden = false;
    $("#workspace").hidden = true;
    statusElement.hidden = true;
    return false;
  }
  $("#welcome").hidden = true;
  $("#workspace").hidden = false;
  statusElement.hidden = false;
  return true;
}
function navigate() {
  state.page = location.hash.slice(1) || "home";
  if (!pageGuard()) return;
  document.querySelectorAll("[data-page]").forEach((a) => {
    const selected = a.dataset.page === state.page;
    a.classList.toggle("selected", selected);
    if (selected) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  render();
}
function groups(items, print = false, day, continuation = false) {
  let out = "";
  let firstGroup = true;
  for (const [key, label] of DAYPARTS) {
    const list = items.filter((a) => a.daypart === key);
    if (!list.length) continue;
    const heading =
      continuation && firstGroup
        ? ""
        : `<h4>${label} <small>(${timeValue(state.plan, day, key)})</small></h4>`;
    out += `<section class="daypart${heading ? "" : " continuation-daypart"}">${heading}${list.map((a) => activityCard(a, print)).join("")}</section>`;
    firstGroup = false;
  }
  return out || `<p class="empty">Geen activiteiten gepland.</p>`;
}
function usesMultipleDayparts(activity) {
  const name = activity.name.trim().toLocaleLowerCase();
  return new Set(
    state.plan.activities
      .filter((candidate) => candidate.name.trim().toLocaleLowerCase() === name)
      .map((candidate) => candidate.daypart),
  ).size > 1;
}
function daypartLabel(key) {
  return `Uitvoering: ${(DAYPARTS.find(([daypart]) => daypart === key)?.[1] || key).toLowerCase()}`;
}
function activityCard(a, print = false) {
  const hasDescription = Boolean(a.description?.trim());
  const daypart = !print && usesMultipleDayparts(a)
    ? `<span class="daypart-label">${esc(daypartLabel(a.daypart))}</span>`
    : "";
  return `<article class="activity-card ${a.active ? "" : "inactive"}${a.loadOnly ? " other-department" : ""}${print && !hasDescription ? " no-description" : ""}">${print ? '<span class="check">☐</span>' : ""}<div class="activity-content"><div class="activity-title">${a.deadline ? `<span class="deadline${print ? " print-deadline" : ""}" aria-label="Uiterlijk om ${esc(a.deadline)}">◷ ${esc(a.deadline)}</span>` : ""}<h4>${esc(a.name)}${daypart}</h4></div>${hasDescription ? `<p>${esc(a.description)}</p>` : ""}${!print ? `<small class="activity-meta">${a.durationMinutes != null ? `<span class="meta-item" title="Indicatie uitvoeringsduur">◷ Indicatie ${formatMinutes(a.durationMinutes)}</span>` : ""}${a.workInstruction?.trim() ? '<span class="meta-item instruction-meta" title="Werkinstructie beschikbaar">✦ Werkinstructie</span>' : ""}${a.loadOnly ? '<span class="meta-item other-department-meta" title="Activiteit op andere afdeling">Andere afdeling</span>' : ""}</small>` : ""}${print ? '<div class="signature"><strong>Uitgevoerd door:</strong></div>' : ""}</div></article>`;
}
function render() {
  const main = $("#main");
  if (state.page === "home") main.innerHTML = home();
  if (state.page === "print") main.innerHTML = printPage();
  if (state.page === "manage") main.innerHTML = manage();
  if (state.page === "handbook") {
    location.hash = "#manage";
    return;
  }
  if (state.page === "handbook-print") main.innerHTML = handbook(true);
  bindPage();
  main.focus();
}
function home() {
  const activeActivities = state.plan.activities.filter((a) => a.active),
    activeCount = activeActivities.length,
    lastUpdated = state.lastUpdated
      ? new Intl.DateTimeFormat("nl-NL", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(state.lastUpdated))
      : "Nog niet gewijzigd",
    fileStatus = state.dirty
      ? "Niet opgeslagen"
      : state.plan.metadata.updatedAt
        ? "Opgeslagen"
        : "Nog niet opgeslagen",
    dailySummaries = Array.from({ length: 7 }, (_, index) => {
      const dayparts = summarizeDay(
          activeActivities,
          state.plan.metadata.daypartTimes,
          dateFromIsoWeek(state.weekYear, state.week, index),
        ),
        activities = dayparts.reduce((sum, part) => sum + part.count, 0),
        dailyCapacity = dayparts.reduce((sum, part) => sum + part.capacity, 0);
      return {
        count: activities,
        duration: dayparts.reduce((sum, part) => sum + part.duration, 0),
        capacity: dailyCapacity,
        dayparts,
      };
    });
  return `<section class="hero"><div class="page-heading"><div><p class="eyebrow">Overzicht</p><h1>${esc(state.plan.metadata.title)}</h1></div><button type="button" class="button" id="edit-opening-times">Dagdelen aanpassen</button></div><p class="lead">Hier vind je een overzicht van je planning en activiteiten.</p><div class="home-meta"><div class="home-meta-primary"><span>Afdeling</span><strong>${esc(state.plan.metadata.department)}</strong></div><div class="home-meta-primary"><span>Actieve activiteiten</span><strong>${activeCount} van ${state.plan.activities.length}</strong></div><div><span>Bestandsstatus</span><strong class="${state.dirty ? "is-unsaved" : "is-saved"}">${fileStatus}</strong></div><div><span>Laatst gewijzigd</span><strong>${esc(lastUpdated)}</strong></div></div><section class="daily-overview" aria-labelledby="daily-overview-title"><div class="daily-overview-heading"><div><h2 id="daily-overview-title">Activiteiten per dag</h2><span>Deze week</span></div><button type="button" class="button small" id="toggle-dayparts" aria-expanded="false">Alle dagdelen tonen</button></div><p class="daily-overview-help">Per dagdeel zie je hoeveel tijd er nog beschikbaar is. Bij een overschrijding zie je hoeveel tijd er te veel is ingepland.</p><div class="daily-counts">${dailySummaries
    .map((summary, index) => {
      const percentage = Math.round(
          (summary.duration / summary.capacity) * 100,
        ),
        status =
          percentage > CAPACITY_OVERLOAD_PERCENTAGE
            ? "is-over"
            : percentage > CAPACITY_WARNING_PERCENTAGE
              ? "is-warning"
              : "is-ok";
      return `<details class="daily-summary"><summary><span>${WEEKDAYS[index][1]}</span><small>${formatMinutes(summary.duration)} <em>${percentage}%</em></small><progress class="daily-load-track ${status}" aria-label="Geschatte taakduur ${WEEKDAYS[index][1]}: ${percentage}%" value="${summary.duration}" max="${summary.capacity}"></progress></summary><div class="daily-dayparts" aria-label="Belasting per dagdeel">${summary.dayparts.map((part) => {
        const partPercentage = Math.round((part.duration / part.capacity) * 100),
          partStatus =
            partPercentage > CAPACITY_OVERLOAD_PERCENTAGE
              ? "is-over"
              : partPercentage > CAPACITY_WARNING_PERCENTAGE
                ? "is-warning"
                : "is-ok";
        const difference = part.capacity - part.duration,
          loadPercentage = Math.round((part.duration / part.capacity) * 100),
          loadLabel =
            difference > 0
              ? `${difference} minuten over`
              : difference < 0
                ? `${Math.abs(difference)} minuten teveel`
                : "0 minuten over",
          percentageLabel = `${loadPercentage}%`;
        return `<div class="daily-daypart"><span>${part.label}</span><small class="${difference < 0 ? "is-over" : difference === 0 ? "is-full" : ""}" aria-label="${part.label}: ${loadLabel}, ${percentageLabel}"><strong>${loadLabel}</strong><em>${percentageLabel}</em></small><progress class="daily-daypart-track ${partStatus}" aria-label="${part.label}: ${loadLabel}" value="${part.duration}" max="${part.capacity}"></progress></div>`;
      }).join("")}</div></details>`;
    })
    .join(
      "",
    )}</div></section><a class="button primary large" href="#print">Planning bekijken en printen</a></section>`;
}
function printPage() {
  const date = parseDate(state.date),
    week =
      state.mode === "week"
        ? Array.from({ length: 7 }, (_, i) =>
            dateFromIsoWeek(state.weekYear, state.week, i),
          )
        : [date],
    dayPages = week.map((d) => {
      const items = activitiesForDate(state.plan.activities, d),
        title = printDate(d),
        day = WEEKDAYS[(d.getDay() + 6) % 7][0],
        rest = items.slice(PRINT_PAGE_ACTIVITY_LIMIT),
        pages = [
          {
            title,
            label: title,
            day,
            items: items.slice(0, PRINT_PAGE_ACTIVITY_LIMIT),
            long: rest.length > 0,
          },
        ];
      if (state.mode === "week" || rest.length)
        pages.push({
          title,
          continuation: true,
          label: title,
          day,
          items: rest,
          long: false,
          blank: state.mode === "week" && rest.length === 0,
        });
      return pages;
    }),
    pageData = dayPages.flat(),
    hasPages = pageData.some((page) => page.items.length),
    emptyPlan = !state.plan.activities.length,
    emptyMessage = emptyPlan
      ? "Voeg eerst een activiteit toe voordat je gaat printen."
      : state.mode === "day"
        ? "Op deze dag staan geen activiteiten gepland. Kies een andere dag."
        : "In deze week staan geen activiteiten gepland. Kies een andere week.";
  const pages = pageData
    .map((page, index) => {
      const last = index === pageData.length - 1;
      if (page.blank)
        return `<div class="print-page blank-print-page${last ? " last-print-page" : ""}" aria-hidden="true"></div>`;
      const context =
        state.mode === "week"
          ? `Week ${state.week}`
          : `Dagplanning · ${page.label}`;
      const extraWorkField = page.continuation
        ? ""
        : `<section class="print-extra-work" aria-label="Extra activiteiten"><strong>Extra activiteiten</strong><div class="print-extra-work-lines"><span></span><span></span><span></span></div></section>`;
      return `<div class="print-page${last ? " last-print-page" : ""}"><header class="print-page-header"><span>${esc(state.plan.metadata.department)}</span><span>${context}</span></header><h2><span>${page.title}</span>${page.continuation ? '<small>— vervolg</small>' : ""}</h2>${extraWorkField}${groups(page.items, true, page.day, page.continuation)}${page.long ? '<p class="back-page-note">↳ Deze planning gaat verder op de achterkant van dit blad.</p>' : ""}</div>`;
    })
    .join("");
  if (emptyPlan)
    return `<section><div class="page-heading"><div><p class="eyebrow">Printen</p><h1>Planning printen</h1></div></div><p class="notice print-empty">${emptyMessage}</p><a class="button primary" href="#manage">Activiteit toevoegen</a></section>`;
  const rangeStart = formatDate(week[0]).split(" "),
    rangeEnd = formatDate(week[6]).split(" "),
    dateRange =
      rangeStart[1] === rangeEnd[1] && rangeStart[2] === rangeEnd[2]
        ? `${rangeStart[0]}–${rangeEnd[0]} ${rangeEnd.slice(1).join(" ")}`
        : `${formatDate(week[0])} – ${formatDate(week[6])}`;
  return `<section><div class="page-heading"><div><p class="eyebrow">Printen</p><h1>Planning printen</h1></div><button class="button primary" id="print-button" ${hasPages ? "" : "disabled"}>Printen</button></div><div class="toolbar${state.mode === "week" ? " week-print-toolbar" : ""}"><div class="view-switcher" role="group" aria-label="Kies een weergave"><span class="view-switcher-label">Weergave</span><div class="view-switcher-options"><button type="button" class="${state.mode === "day" ? "selected" : ""}" data-view-mode="day" aria-pressed="${state.mode === "day"}">Dag</button><button type="button" class="${state.mode === "week" ? "selected" : ""}" data-view-mode="week" aria-pressed="${state.mode === "week"}">Week</button></div></div>${state.mode === "day" ? `<label>Datum<input id="date-choice" type="date" required value="${state.date}"></label>` : `<label>Jaar<input id="week-year" type="number" min="2000" max="2100" value="${state.weekYear}"></label><label>Weeknummer<input id="week-number" type="number" min="1" max="53" value="${state.week}"></label>  <div class="week-summary" aria-live="polite"><span>Periode</span><strong>${dateRange}</strong></div>`}</div>${hasPages ? `<div id="print-content" class="${state.mode === "week" ? "week-print" : ""}">${pages}</div>` : `<p class="notice print-empty">${emptyMessage}</p>`}</section>`;
}
function activityMatchesDay(activity, day) {
  return (
    activity.recurrence.type === "daily" ||
    (activity.recurrence.type === "monthly" &&
      activity.recurrence.weekday === day) ||
    activity.recurrence.weekdays?.includes(day)
  );
}
function capacitySummary(all, key, day) {
  if (!day) return "";
  const [start, end] = timeValue(state.plan, day, key).split("–"),
    available = timeToMinutes(end) - timeToMinutes(start),
    fixed = all
      .filter(
        (a) =>
          a.active &&
          a.daypart === key &&
          (a.recurrence.type === "daily" ||
            (a.recurrence.type === "weekly" &&
              a.recurrence.weekdays.includes(day))),
      )
      .reduce((sum, a) => sum + a.durationMinutes, 0),
    monthlyGroups = new Map();
  all
    .filter(
      (a) =>
        a.active &&
        a.daypart === key &&
        a.recurrence.type === "monthly" &&
        a.recurrence.weekday === day,
    )
    .forEach((a) => {
      const groupKey = `${a.recurrence.occurrence}-${a.recurrence.weekday}`;
      monthlyGroups.set(
        groupKey,
        (monthlyGroups.get(groupKey) || 0) + a.durationMinutes,
      );
    });
  const monthlyRows = [...monthlyGroups]
      .map(([groupKey, duration]) => {
        const [occurrence, weekday] = groupKey.split("-"),
          occurrenceLabel =
            MONTHLY_OCCURRENCES.find(([key]) => key === occurrence)?.[1] ||
            occurrence,
          weekdayLabel =
            WEEKDAYS.find(([key]) => key === weekday)?.[1] || weekday;
        return `<div class="capacity-monthly-row"><span>+${duration} min</span><strong>op elke ${occurrenceLabel} ${weekdayLabel}</strong></div>`;
      })
      .join(""),
    percentage = Math.round((fixed / available) * 100),
    status =
      percentage > CAPACITY_OVERLOAD_PERCENTAGE
        ? "is-over"
        : percentage > CAPACITY_WARNING_PERCENTAGE
          ? "is-warning"
          : "is-ok";
  return `<div class="capacity-summary"><div class="capacity-main"><div class="capacity-label"><span>Belasting (op basis van een collega, pauze niet meegerekend)</span><strong>${fixed} / ${available} min · ${percentage}%</strong></div><progress class="capacity-track ${status}" aria-label="Belasting (op basis van een collega, pauze niet meegerekend)" value="${fixed}" max="${available}"></progress>${percentage > CAPACITY_OVERLOAD_PERCENTAGE ? `<small class="capacity-warning">Dit dagdeel is ${fixed - available} minuten overvol gepland.</small>` : ""}</div>${monthlyRows ? `<div class="capacity-monthly"><span>Extra belasting door maandelijkse activiteiten</span>${monthlyRows}</div>` : ""}</div>`;
}
function manage() {
  const all = state.plan.activities,
    filtered = orderActivities(
      all.filter(
        (a) =>
          (!state.filters.q ||
            `${a.name} ${a.description}`
              .toLowerCase()
              .includes(state.filters.q.toLowerCase())) &&
          (!state.filters.day || activityMatchesDay(a, state.filters.day)) &&
          (state.filters.active === "" ||
            String(a.active) === state.filters.active) &&
          (!state.filters.recurrence ||
            (state.filters.recurrence === "weekly"
              ? ["daily", "weekly"].includes(a.recurrence.type)
              : a.recurrence.type === state.filters.recurrence)),
      ),
    ),
    restricted = filtered.length !== all.length,
    hasFilters = Boolean(
      state.filters.q ||
        state.filters.day ||
        state.filters.active ||
        state.filters.recurrence,
    );
  return `<section><div class="page-heading"><div><p class="eyebrow">Aan de slag</p><h1>Planning bewerken</h1></div><button class="button primary" id="add-activity">Activiteit toevoegen</button></div><div class="toolbar filters${restricted ? " has-filter-warning" : ""}"><label>Zoeken<input id="filter-q" value="${esc(state.filters.q)}" placeholder="Naam of beschrijving"></label><label class="day-filter-label"><span>Dag <button type="button" class="filter-info" aria-expanded="false" aria-label="Uitleg geplande tijd">ⓘ</button><span class="filter-info-text" hidden>Selecteer een dag voor meer inzicht in de geplande tijd per dagdeel.</span></span><select id="filter-day"><option value="">Alle dagen</option>${WEEKDAYS.map((x) => `<option value="${x[0]}" ${state.filters.day === x[0] ? "selected" : ""}>${x[1]}</option>`).join("")}</select></label><label>Herhaling<select id="filter-recurrence"><option value="">Alle herhalingen</option><option value="weekly" ${state.filters.recurrence === "weekly" ? "selected" : ""}>Dagen</option><option value="monthly" ${state.filters.recurrence === "monthly" ? "selected" : ""}>Maandelijks</option></select></label><label>Status<select id="filter-active"><option value="">Alle</option><option value="true" ${state.filters.active === "true" ? "selected" : ""}>Actief</option><option value="false" ${state.filters.active === "false" ? "selected" : ""}>Inactief</option></select></label>${hasFilters ? '<button type="button" class="button small" id="clear-filters">Filters wissen</button>' : ""}${restricted ? '    <p class="manage-restricted"><span class="message-label">Let op:</span> <span>Verslepen is uitgeschakeld zolang er filters actief zijn.</span></p>' : ""}</div><div class="manage-list">${DAYPARTS.map(
    ([key, label]) =>
      `<section class="manage-group"><h2>${label} <small>(${timeValue(state.plan, state.filters.day || DEFAULT_DEADLINE_DAY, key)})</small>${!state.filters.day && afwijkendeDagenVoorDagdeel(state.plan, key).length ? `<small class="manage-time-exception">Tijden wijken af op: ${esc(afwijkendeDagenVoorDagdeel(state.plan, key).join(", "))}</small>` : ""}</h2>${capacitySummary(all, key, state.filters.day)}<div class="manage-columns" aria-hidden="true"><span></span><span>Activiteit</span>${WEEKDAYS.map(([, day]) => `<span>${day.slice(0, 2)}</span>`).join("")}<span></span></div><div data-dropzone="${key}">${
        filtered
          .filter((a) => a.daypart === key)
          .map((a) => manageCard(a, restricted))
          .join("") || '<p class="empty">Geen activiteiten.</p>'
      }</div></section>`,
  ).join("")}</div></section>`;
}
function manageCard(a, restricted) {
  const instruction = a.workInstruction?.trim(),
    monthlyMeta =
      a.recurrence.type === "monthly"
        ? `<span class="manage-monthly-recurrence">Maandelijks · elke ${esc(MONTHLY_OCCURRENCES.find(([key]) => key === String(a.recurrence.occurrence))?.[1] || "onbekend")} ${esc(WEEKDAYS.find(([key]) => key === a.recurrence.weekday)?.[1].toLowerCase() || "onbekende dag")}</span>`
        : "",
    days =
      a.recurrence.type === "daily"
        ? WEEKDAYS.map(([day]) => day)
        : a.recurrence.type === "weekly"
          ? a.recurrence.weekdays
          : [a.recurrence.weekday];
  const daypart = usesMultipleDayparts(a)
    ? `<span class="daypart-label">${esc(daypartLabel(a.daypart))}</span>`
    : "";
  return `<article class="manage-card ${a.active ? "" : "inactive"}${a.loadOnly ? " other-department" : ""}" draggable="${!restricted}" data-id="${esc(a.id)}"><span class="drag-handle" title="Verslepen om te sorteren" aria-label="Verslepen om te sorteren">⋮⋮</span><div class="manage-info"><strong>${esc(a.name)}${daypart}</strong><span>${esc(a.description)}</span><small>${a.deadline ? `<span class="deadline" aria-label="Uiterlijk om ${esc(a.deadline)}">◷ ${esc(a.deadline)}</span>` : ""}${a.durationMinutes != null ? `<span class="meta-item" title="Uitvoeringsduur">◷ ${formatMinutes(a.durationMinutes)}</span>` : ""}${instruction ? '<span class="meta-item instruction-meta" title="Werkinstructie beschikbaar" aria-label="Werkinstructie beschikbaar">✦ Werkinstructie</span>' : ""}${a.loadOnly ? '<span class="meta-item other-department-meta" title="Activiteit op andere afdeling">Andere afdeling</span>' : ""}</small></div><div class="manage-days" aria-label="Uitvoeringsdagen">${WEEKDAYS.map(([day, label]) => `<span class="${days.includes(day) ? "is-scheduled" : ""}" title="${days.includes(day) ? `${label}: uitvoeren` : `${label}: niet uitvoeren`}">${days.includes(day) ? "✓" : "–"}</span>`).join("")}${monthlyMeta}</div><div class="manage-actions"><button class="icon-button edit" data-id="${a.id}" title="Bewerken" aria-label="Bewerken">✎</button><button class="icon-button copy" data-id="${a.id}" title="Kopiëren" aria-label="Kopiëren">⧉</button><button class="icon-button delete" data-id="${a.id}" title="Verwijderen" aria-label="Verwijderen">×</button></div></article>`;
}
function form(existing) {
  const a = existing || {
    id: `activity-${Date.now()}`,
    active: true,
    name: "",
    description: "",
    workInstruction: "",
    loadOnly: false,
    durationMinutes: null,
    deadline: "",
    daypart: "morning",
    sortOrder: 0,
    recurrence: { type: "weekly", weekdays: WEEKDAYS.map(([day]) => day) },
  };
  return `<dialog id="activity-dialog"><form id="activity-form" autocomplete="off"><h2>${existing ? "Activiteit bewerken" : "Activiteit toevoegen"}</h2><p class="form-help">Velden met <span class="required-mark">*</span> zijn verplicht.</p><input name="id" type="hidden" value="${esc(a.id)}"><label>Naam<span class="required-mark">*</span><input autocomplete="off" required name="name" value="${esc(a.name)}"></label><label>Korte beschrijving<textarea autocomplete="off" name="description">${esc(a.description || "")}</textarea></label><label>Indicatie uitvoeringsduur in minuten<span class="required-mark">*</span><input autocomplete="off" required name="durationMinutes" type="number" min="0" value="${a.durationMinutes ?? ""}"></label><label>Dagdeel<span class="required-mark">*</span><select required name="daypart">${DAYPARTS.map((x) => `<option value="${x[0]}" ${a.daypart === x[0] ? "selected" : ""}>${x[1]}</option>`).join("")}</select></label><label>Herhaling<select required name="recurrenceType"><option value="weekly" ${a.recurrence.type !== "monthly" ? "selected" : ""}>Dagen</option><option value="monthly" ${a.recurrence.type === "monthly" ? "selected" : ""}>Maandelijks</option></select></label><fieldset class="weekly-fields"><legend>Dagen<span class="required-mark">*</span></legend><label class="check-label select-all-days"><input type="checkbox" name="allDays">Alle dagen</label>${WEEKDAYS.map((x) => `<label class="check-label"><input type="checkbox" name="weekday" value="${x[0]}" ${(a.recurrence.type === "daily" || a.recurrence.weekdays?.includes(x[0])) ? "checked" : ""}>${x[1]}</label>`).join("")}</fieldset><div class="monthly-fields"><label>Week van de maand<span class="required-mark">*</span><select name="monthOccurrence">${MONTHLY_OCCURRENCES.map((x) => `<option value="${x[0]}" ${String(a.recurrence.occurrence) === x[0] ? "selected" : ""}>${x[1]}</option>`).join("")}</select></label>  <label>Weekdag<span class="required-mark">*</span><select name="monthWeekday">${WEEKDAYS.map((x) => `<option value="${x[0]}" ${a.recurrence.weekday === x[0] ? "selected" : ""}>${x[1]}</option>`).join("")}</select></label></div>  <details class="activity-extra-options"><summary>Meer opties</summary><div class="activity-extra-fields"><label class="check-label"><input type="checkbox" name="active" ${a.active ? "checked" : ""}>Actief</label><div class="other-department-option"><label class="check-label"><input type="checkbox" name="loadOnly" ${a.loadOnly ? "checked" : ""}>Activiteit op andere afdeling</label><small class="field-help">Gebruik deze optie wanneer je de activiteit voor een andere afdeling uitvoert (bijvoorbeeld vlinderen). De activiteit blijft meetellen in je eigen planning.</small></div><label>Deadline<div class="deadline-input"><input autocomplete="off" name="deadline" type="time" value="${esc(a.deadline || "")}"><button type="button" class="button small clear-deadline">Wissen</button></div><span class="deadline-warning" hidden></span></label><label>Werkinstructie<textarea autocomplete="off" name="workInstruction">${esc(a.workInstruction || "")}</textarea></label></div></details><div class="dialog-actions"><button type="button" class="button" id="cancel-activity">Annuleren</button><button class="button primary">Opslaan</button></div></form></dialog>`;
}
const handbookIntro = () => state.plan.metadata.handbookIntro;
function editHandbookIntro() {
  const dialog = $("#handbook-intro-dialog"),
    textarea = $("#handbook-intro-text");
  textarea.value = handbookIntro().join("\n\n");
  dialog.showModal();
  const close = () => {
    dialog.removeEventListener("close", close);
  };
  dialog.addEventListener("close", close, { once: true });
  $("#cancel-handbook-intro").onclick = () => dialog.close("cancel");
  dialog.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const paragraphs = textarea.value
      .split(/\n\s*\n/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (!paragraphs.length) return toast("Vul ten minste één alinea in.", true);
    state.plan.metadata.handbookIntro = paragraphs;
    dialog.close("confirm");
    setStatus("Wijzigingen nog niet opgeslagen", true);
    render();
  };
}
function handbook(print) {
  const list = state.plan.activities
      .filter((a) => a.workInstruction?.trim())
      .sort((a, b) => a.name.localeCompare(b.name, "nl")),
    printedOn = new Intl.DateTimeFormat("nl-NL", { dateStyle: "long" }).format(
      new Date(),
    ),
    intro = handbookIntro();
  const editButton =
      '<button type="button" class="icon-button handbook-edit" id="edit-handbook-intro" title="Inleiding aanpassen" aria-label="Inleiding aanpassen">✎</button>',
    actions = print
      ? `${editButton}<button class="button primary" id="print-button">Printen</button>`
      : editButton;
  return `<section><div class="page-heading"><div><p class="eyebrow">Handige info</p><h1>Werkinstructies${print ? " printen" : " bekijken"}</h1></div><div class="handbook-actions">${actions}</div></div>${!print ? `<div class="toolbar"><label>Zoeken<input id="handbook-q" placeholder="Activiteit of instructie"></label></div>` : ""}<div class="handbook">${print ? `<article class="handbook-cover"><p class="eyebrow">Werkinstructies</p><h2>${esc(state.plan.metadata.title)}</h2>${intro.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}<p class="handbook-date">Geprint op ${printedOn}</p></article>` : ""}${list.map((a) => `<article class="handbook-entry"><h2>${esc(a.name)}</h2>${a.deadline ? `<p class="deadline handbook-deadline">Uiterlijk om ${esc(a.deadline)}</p>` : ""}${a.description ? `<p><strong>Korte beschrijving</strong>${esc(a.description)}</p>` : ""}<p><strong>Werkinstructie</strong>${esc(a.workInstruction)}</p>${a.durationMinutes != null ? `<strong>Indicatie uitvoeringsduur: ${formatMinutes(a.durationMinutes)}</strong>` : ""}${!print ? `<button class="button small edit" data-id="${a.id}">Bewerken</button>` : ""}</article>`).join("") || '<p class="empty">Er zijn nog geen werkinstructies.</p>'}</div></section>`;
}
function editOpeningTimes() {
  const dialog = document.createElement("dialog");
  dialog.className = "opening-times-dialog";
  const allTimes = daypartTimeMap(state.plan),
    customDays = WEEKDAYS.filter(([day]) =>
      DAYPARTS.some(([key]) => allTimes[day][key] !== allTimes.mon[key]),
    ).map(([day]) => day),
    rangeFields = (day, label) =>
      DAYPARTS.map(([key, part]) => {
        const [start, end] = allTimes[day][key].split("–");
        return `<label class="opening-time-field"><span>${part}</span><div class="opening-time-range"><input aria-label="${label} ${part} begintijd" required type="time" data-day="${day}" data-part="${key}" data-edge="start" value="${start}"><span>tot</span><input aria-label="${label} ${part} eindtijd" required type="time" data-day="${day}" data-part="${key}" data-edge="end" value="${end}"></div></label>`;
      }).join("");
  dialog.innerHTML = `<form><h2>Dagdelen aanpassen</h2><p>Stel eerst de standaardtijden in. Voeg daarna alleen afwijkende tijden toe voor specifieke dagen.</p><section class="opening-times-section"><h3>Standaardtijden</h3><div class="opening-times-simple">${rangeFields("mon", "Standaardtijden")}</div></section><section class="opening-times-section"><h3>Afwijkende dagen</h3><p class="form-help">Selecteer één of meer dagen met afwijkende tijden.</p><div class="opening-days">${WEEKDAYS.map(([day, label]) => `<label><input type="checkbox" value="${day}" ${customDays.includes(day) ? "checked" : ""}>${label}</label>`).join("")}</div><div class="opening-times-custom"></div></section><div class="dialog-actions"><button type="button" class="button" id="cancel-opening-times">Annuleren</button><button class="button primary">Opslaan</button></div></form>`;
  document.body.append(dialog);
  dialog.showModal();
  const custom = dialog.querySelector(".opening-times-custom"),
    selectedDays = () =>
      [...dialog.querySelectorAll(".opening-days input:checked")].map(
        (input) => input.value,
      ),
    renderCustomDays = () => {
      custom.innerHTML = selectedDays()
        .map(
          (day) =>
            `<fieldset><legend>${WEEKDAYS.find(([key]) => key === day)[1]}</legend>${rangeFields(day, WEEKDAYS.find(([key]) => key === day)[1])}</fieldset>`,
        )
        .join("");
      custom.hidden = !selectedDays().length;
    };
  dialog
    .querySelectorAll(".opening-days input")
    .forEach((input) => input.addEventListener("change", renderCustomDays));
  renderCustomDays();
  dialog.querySelector("#cancel-opening-times").onclick = () => dialog.close();
  dialog.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const values = daypartTimeMap(state.plan),
      standardFields = dialog.querySelectorAll(
        ".opening-times-simple input[data-day]",
      );
    for (const field of standardFields) {
      const part = field.dataset.part;
      for (const [day] of WEEKDAYS)
        values[day][part] =
          field.dataset.edge === "start"
            ? `${field.value}–${values[day][part].split("–")[1]}`
            : `${values[day][part].split("–")[0]}–${field.value}`;
    }
    const fields = dialog.querySelectorAll(
      ".opening-times-custom input[data-day]",
    );
    for (const field of fields) {
      const day = field.dataset.day,
        part = field.dataset.part;
      values[day][part] =
        field.dataset.edge === "start"
          ? `${field.value}–${values[day][part].split("–")[1]}`
          : `${values[day][part].split("–")[0]}–${field.value}`;
    }
    for (const [day] of WEEKDAYS)
      for (const [key] of DAYPARTS)
        if (
          timeToMinutes(values[day][key].split("–")[1]) <=
          timeToMinutes(values[day][key].split("–")[0])
        )
          return toast(
            `${WEEKDAYS.find(([id]) => id === day)[1]}: eindtijd moet na de begintijd liggen.`,
            true,
          );
    state.plan.metadata.daypartTimes = values;
    dialog.close();
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    setStatus("Wijzigingen nog niet opgeslagen", true);
    render();
  };
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
}
function bindPage() {
  document
    .querySelector("#print-button")
    ?.addEventListener("click", () => window.print());
  $("#edit-opening-times")?.addEventListener("click", editOpeningTimes);
  $("#toggle-dayparts")?.addEventListener("click", (event) => {
    const details = [...document.querySelectorAll(".daily-summary")],
      shouldOpen = details.some((detail) => !detail.open);
    details.forEach((detail) => (detail.open = shouldOpen));
    event.currentTarget.textContent = shouldOpen
      ? "Alle dagdelen inklappen"
      : "Alle dagdelen tonen";
    event.currentTarget.setAttribute("aria-expanded", String(shouldOpen));
  });
  document.querySelectorAll(".capacity-info,.filter-info").forEach((button) =>
    button.addEventListener("click", () => {
      const text = button.nextElementSibling,
        expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      text.hidden = expanded;
    }),
  );
  $("#edit-handbook-intro")?.addEventListener("click", editHandbookIntro);
  document.querySelectorAll("[data-view-mode]").forEach((button) =>
    button.addEventListener("click", () => {
      state.mode = button.dataset.viewMode;
      render();
    }),
  );
  $("#date-choice")?.addEventListener("change", (e) => {
    if (!e.target.value || Number.isNaN(parseDate(e.target.value).getTime())) {
      e.target.value = state.date;
      return;
    }
    state.date = e.target.value;
    render();
  });
  $("#week-year")?.addEventListener("change", (e) => {
    state.weekYear = +e.target.value;
    validateWeek();
  });
  $("#week-number")?.addEventListener("change", (e) => {
    state.week = +e.target.value;
    validateWeek();
  });
  $("#add-activity")?.addEventListener("click", () => showForm());
  $("#clear-filters")?.addEventListener("click", () => {
    state.filters = { ...DEFAULT_FILTERS };
    render();
  });
  ["filter-q", "filter-day", "filter-recurrence", "filter-active"].forEach(
    (id) =>
      $("#" + id)?.addEventListener("input", (e) => {
        const key =
          id === "filter-q"
            ? "q"
            : id === "filter-day"
              ? "day"
              : id === "filter-recurrence"
                ? "recurrence"
                : "active";
        state.filters[key] = e.target.value;
        const value = e.target.value;
        render();
        if (id === "filter-q") {
          const input = $("#filter-q");
          input.focus();
          input.setSelectionRange(value.length, value.length);
        }
      }),
  );
  $("#handbook-q")?.addEventListener("input", (e) => {
    document
      .querySelectorAll(".handbook-entry")
      .forEach(
        (x) =>
          (x.hidden = !x.textContent
            .toLowerCase()
            .includes(e.target.value.toLowerCase())),
      );
  });
  document
    .querySelectorAll(".edit")
    .forEach((b) =>
      b.addEventListener("click", () =>
        showForm(state.plan.activities.find((a) => a.id === b.dataset.id)),
      ),
    );
  document
    .querySelectorAll(".copy")
    .forEach((b) =>
      b.addEventListener("click", () => copyActivity(b.dataset.id)),
    );
  document
    .querySelectorAll(".delete")
    .forEach((b) =>
      b.addEventListener("click", () => removeActivity(b.dataset.id)),
    );
  document.querySelectorAll("[data-dropzone]").forEach((z) =>
    z.addEventListener("dragover", (e) => {
      e.preventDefault();
      const target = e.target.closest("[data-id]");
      if (target) target.classList.add("drop-target");
    }),
  );
  document
    .querySelectorAll("[data-dropzone]")
    .forEach((z) =>
      z.addEventListener("dragleave", (e) =>
        e.target.closest("[data-id]")?.classList.remove("drop-target"),
      ),
    );
  document
    .querySelectorAll("[draggable=true]")
    .forEach((c) =>
      c.addEventListener("dragstart", (e) =>
        e.dataTransfer.setData("text/plain", c.dataset.id),
      ),
    );
  document.querySelectorAll("[data-dropzone]").forEach((z) =>
    z.addEventListener("drop", (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain"),
        target = e.target.closest("[data-id]"),
        dropzone = e.currentTarget;
      document
        .querySelectorAll(".drop-target")
        .forEach((x) => x.classList.remove("drop-target"));
      if (id && dropzone.dataset.dropzone) {
        const after =
          target &&
          e.clientY >
            target.getBoundingClientRect().top +
              target.getBoundingClientRect().height / 2;
        reorder(id, target?.dataset.id, after, dropzone.dataset.dropzone);
      }
    }),
  );
}
function validateWeek() {
  if (state.week < 1 || state.week > weeksInYear(state.weekYear)) {
    toast(`Week ${state.week} bestaat niet in ${state.weekYear}.`, true);
    return;
  }
  render();
}
function showForm(existing) {
  const wrap = document.createElement("div");
  wrap.innerHTML = form(existing);
  const d = wrap.firstElementChild,
    monthlyFields = d.querySelector(".monthly-fields"),
    monthlyFieldset = document.createElement("fieldset"),
    monthlyLegend = document.createElement("legend");
  const fieldConfig = {
    name: { label: "Naam", required: true },
    description: {
      label: "Korte beschrijving",
      help: "Deze beschrijving is zichtbaar op de uitgeprinte planning.",
    },
    workInstruction: {
      label: "Werkinstructie",
      help: "Deze instructie wordt opgenomen in de werkinstructies.",
    },
    durationMinutes: {
      label: "Indicatie benodigde tijd (in minuten)",
      required: true,
    },
    deadline: {
      label: "Deadline",
      help: "Het tijdstip waarop deze activiteit uiterlijk afgerond moet zijn.",
    },
    daypart: { label: "Dagdeel", required: true },
    recurrenceType: { label: "Herhaling", required: true },
  };
  for (const [name, config] of Object.entries(fieldConfig)) {
    const input = d.querySelector(`[name="${name}"]`),
      label = input?.closest("label"),
      anchor = input?.parentElement === label ? input : input?.parentElement;
    if (!input || !label) continue;
    const title = document.createElement("span");
    title.className = "field-label";
    while (label.firstChild && label.firstChild !== anchor)
      label.firstChild.remove();
    title.textContent = config.label;
    if (config.required) {
      const mark = document.createElement("span");
      mark.className = "required-mark";
      mark.textContent = "*";
      title.append(mark);
    }
    label.insertBefore(title, anchor);
    if (config.help) {
      const help = document.createElement("small");
      help.className = "field-help";
      help.textContent = config.help;
      label.insertBefore(help, anchor);
    }
  }
  monthlyFieldset.className = "monthly-fields";
  monthlyLegend.textContent = "Maandelijkse herhaling";
  monthlyFieldset.append(monthlyLegend, ...monthlyFields.childNodes);
  monthlyFields.replaceWith(monthlyFieldset);
  d.querySelectorAll(".monthly-fields label").forEach((label) => {
    label.querySelector(".required-mark")?.remove();
    const labelText = label.firstChild,
      heading = document.createElement("span"),
      mark = document.createElement("span");
    heading.className = "field-label";
    mark.className = "required-mark";
    mark.textContent = "*";
    heading.append(labelText, mark);
    label.prepend(heading);
  });
  document.body.append(d);
  d.showModal();
  const f = $("#activity-form"),
    type = f.elements.recurrenceType,
    deadline = f.elements.deadline,
    daypart = f.elements.daypart,
    warning = d.querySelector(".deadline-warning"),
    configuredDay = state.filters.day || DEFAULT_DEADLINE_DAY,
    rangeForDaypart = () => timeValue(state.plan, configuredDay, daypart.value),
    deadlineInRange = () => {
      if (!deadline.value) return true;
      const [start, end] = rangeForDaypart().split("–");
      return (
        timeToMinutes(deadline.value) <= timeToMinutes(end) &&
        timeToMinutes(deadline.value) >= timeToMinutes(start)
      );
    },
    updateDeadlineWarning = () => {
      const outside = !deadlineInRange();
      warning.hidden = !outside;
      warning.textContent = outside
        ? `Let op: ${deadline.value} valt buiten de tijden van het gekozen dagdeel (${rangeForDaypart()}).`
        : "";
    },
    sync = () => {
      const monthly = type.value === "monthly";
      d.querySelector(".weekly-fields").hidden = type.value !== "weekly";
      d.querySelector(".monthly-fields").hidden = !monthly;
      const weekdayInputs = [...d.querySelectorAll('input[name="weekday"]')],
        allDays = d.querySelector('input[name="allDays"]');
      allDays.checked =
        weekdayInputs.length > 0 && weekdayInputs.every((input) => input.checked);
    };
  type.addEventListener("change", sync);
  d.querySelector('input[name="allDays"]').addEventListener("change", (e) => {
    d.querySelectorAll('input[name="weekday"]').forEach(
      (input) => (input.checked = e.target.checked),
    );
  });
  d.querySelectorAll('input[name="weekday"]').forEach((input) => {
    input.addEventListener("change", sync);
  });
  deadline.addEventListener("input", updateDeadlineWarning);
  d.querySelector(".clear-deadline").addEventListener("click", () => {
    deadline.value = "";
    updateDeadlineWarning();
  });
  daypart.addEventListener("change", updateDeadlineWarning);
  sync();
  updateDeadlineWarning();
  $("#cancel-activity").addEventListener("click", () => d.close());
  d.addEventListener("close", () => d.remove(), { once: true });
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(f),
      old = existing,
      recurrence =
        type.value === "weekly"
          ? { type: "weekly", weekdays: fd.getAll("weekday") }
            : {
                type: "monthly",
                occurrence: fd.get("monthOccurrence"),
                weekday: fd.get("monthWeekday"),
              };
    if (type.value === "weekly" && !recurrence.weekdays.length)
      return toast("Kies ten minste één weekdag.", true);
    if (deadline.value && !deadlineInRange())
      toast(
        `Let op: deadline ${deadline.value} valt buiten het gekozen dagdeel.`,
        true,
      );
    const a = {
      id: fd.get("id"),
      active: fd.has("active"),
      loadOnly: fd.has("loadOnly"),
      name: fd.get("name").trim(),
      description: fd.get("description").trim(),
      workInstruction: fd.get("workInstruction").trim(),
      durationMinutes: fd.get("durationMinutes")
        ? +fd.get("durationMinutes")
        : null,
      deadline: fd.get("deadline") || null,
      daypart: fd.get("daypart"),
      sortOrder:
        old && old.daypart === fd.get("daypart")
          ? old.sortOrder
          : Math.max(
              -1,
              ...state.plan.activities
                .filter(
                  (x) => x.daypart === fd.get("daypart") && x.id !== old?.id,
                )
                .map((x) => x.sortOrder),
            ) + 1,
      recurrence,
    };
    const errors = validatePlan({
      ...state.plan,
      activities: old
        ? state.plan.activities.map((x) => (x.id === a.id ? a : x))
        : [...state.plan.activities, a],
    });
    if (errors.length) return toast(errors[0], true);
    if (old)
      state.plan.activities = state.plan.activities.map((x) =>
        x.id === a.id ? a : x,
      );
    else state.plan.activities.push(a);
    renumber(a.daypart);
    d.close();
    setStatus("Wijzigingen nog niet opgeslagen", true);
    render();
  });
}
function renumber(daypart) {
  orderActivities(
    state.plan.activities.filter((a) => a.daypart === daypart),
  ).forEach((a, i) => (a.sortOrder = i));
}
function move(id, direction) {
  const a = state.plan.activities.find((x) => x.id === id),
    list = orderActivities(
      state.plan.activities.filter((x) => x.daypart === a.daypart),
    ),
    i = list.findIndex((x) => x.id === id),
    j = i + direction;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  list.forEach((x, n) => (x.sortOrder = n));
  setStatus("Wijzigingen nog niet opgeslagen", true);
  render();
}
function reorder(id, targetId, after = false, targetDaypart) {
  if (
    !reorderActivities(
      state.plan.activities,
      id,
      targetId,
      after,
      targetDaypart,
    )
  )
    return;
  setStatus("Wijzigingen nog niet opgeslagen", true);
  render();
}
async function removeActivity(id) {
  const a = state.plan.activities.find((x) => x.id === id);
  if (
    !(await confirmDialog(
      `Wil je '${a.name}' echt verwijderen?`,
      "Activiteit verwijderen",
    ))
  )
    return;
  state.plan.activities = state.plan.activities.filter((x) => x.id !== id);
  renumber(a.daypart);
  setStatus("Wijzigingen nog niet opgeslagen", true);
  render();
}
function copyActivity(id) {
  const source = state.plan.activities.find((x) => x.id === id),
    copy = JSON.parse(JSON.stringify(source));
  copy.id = `activity-${Date.now()}`;
  copy.name = `${source.name} (kopie)`;
  copy.sortOrder =
    Math.max(
      -1,
      ...state.plan.activities
        .filter((a) => a.daypart === source.daypart)
        .map((a) => a.sortOrder),
    ) + 1;
  state.plan.activities.push(copy);
  setStatus("Wijzigingen nog niet opgeslagen", true);
  render();
  toast("Activiteit gekopieerd.");
}
async function returnToStart() {
  if (
    state.dirty &&
    !(await confirmDialog(
      "Je hebt nog niet-opgeslagen wijzigingen. Wil je terug naar de start?",
      "Terug naar start",
    ))
  )
    return;
  clearRecovery();
  state.plan = null;
  state.dirty = false;
  state.lastUpdated = null;
  state.status = "Geen planning geopend";
  state.page = "home";
  location.hash = "#home";
  navigate();
}
function loadPlan(plan, status = "Geen wijzigingen", page = "#manage") {
  const errors = validatePlan(plan);
  if (errors.length) {
    toast(`Planning niet geladen: ${errors[0]}`, true);
    return;
  }
  state.plan = JSON.parse(JSON.stringify(plan));
  state.lastUpdated = state.plan.metadata.updatedAt || null;
  setStatus(
    status,
    status === "Nieuwe planning – nog niet opgeslagen" ||
      status === "Herstelversie hersteld",
  );
  location.hash = page;
  navigate();
}
$("#open-plan").onclick = () => $("#file-input").click();
$("#file-input").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    loadPlan(JSON.parse(await file.text()));
  } catch (err) {
    toast(`Bestand kon niet worden gelezen: ${err.message}`, true);
  }
  e.target.value = "";
};
$("#new-plan").onclick = async () => {
  const department = await promptDialog(
    "Voor welke afdeling is deze planning?",
    "",
    "Nieuwe planning",
    "Bijvoorbeeld: AGF",
  );
  if (!department?.trim()) return;
  const trimmedDepartment = department.trim();
  loadPlan(
    blankPlan(`Planning ${trimmedDepartment}`, trimmedDepartment),
    "Nieuwe planning – nog niet opgeslagen",
    "#manage",
  );
};
$("#sample-plan").onclick = () =>
  loadPlan(samplePlan(), "Geen wijzigingen", "#manage");
$("#save-plan").onclick = async () => {
  if (!state.plan) return;
  const now = new Date(),
    updatedAt = now.toISOString(),
    exportPlan = {
      ...state.plan,
      metadata: { ...state.plan.metadata, updatedAt },
    },
    json = JSON.stringify(exportPlan, null, 2),
    pad = (n) => String(n).padStart(2, "0"),
    stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`,
    slug = (value) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-|-$/g, ""),
    titleSlug = slug(state.plan.metadata.title),
    departmentSlug = slug(state.plan.metadata.department),
    planSlug = titleSlug.endsWith(`-${departmentSlug}`)
      ? titleSlug
      : `${titleSlug}-${departmentSlug}`,
    name = `${stamp}-${planSlug}.json`;
  try {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [
          {
            description: "ActiPlan JSON",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      state.plan = exportPlan;
      state.lastUpdated = updatedAt;
      clearRecovery();
      setStatus("Bestand opgeslagen", false);
      toast("Je planning is opgeslagen.");
      return;
    }
    const blob = new Blob([json], { type: "application/json" }),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    state.plan = exportPlan;
    state.lastUpdated = updatedAt;
    clearRecovery();
    setStatus("Download gestart", false);
    toast("Download gestart. Kijk even of het bestand is opgeslagen.");
  } catch (err) {
    if (err.name !== "AbortError") {
      setStatus("Foutmelding", state.dirty);
      toast(`Opslaan lukt niet: ${err.message}`, true);
    }
  }
};
const requestOpen = async () => {
  if (
    state.dirty &&
    !(await confirmDialog(
      "Je hebt nog niet-opgeslagen wijzigingen. Wil je deze planning verlaten?",
      "Planning openen",
    ))
  )
    return;
  $("#file-input").click();
};
const restoreRecovery = async () => {
  let raw;
  try {
    raw = localStorage.getItem(RECOVERY_KEY);
  } catch (err) {
    console.error("Herstelversie lezen lukt niet.", err);
    return false;
  }
  if (!raw) return false;
  try {
    const recovery = JSON.parse(raw),
      savedAt = new Date(recovery.savedAt),
      when = Number.isNaN(savedAt.getTime())
        ? "onbekend"
        : new Intl.DateTimeFormat("nl-NL", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(savedAt),
      restore = await confirmDialog(
        `Er staat een niet-opgeslagen herstelversie van ${when}. Wil je die herstellen?`,
        "Herstelversie gevonden",
      );
    if (!restore) {
      clearRecovery();
      return false;
    }
    loadPlan(
      recovery.plan,
      "Herstelversie hersteld",
      location.hash || "#manage",
    );
    return true;
  } catch (err) {
    clearRecovery();
    console.error("Herstelversie is ongeldig.", err);
    return false;
  }
};
$("#change-plan").onclick = returnToStart;
$("#open-plan").onclick = requestOpen;
window.addEventListener("hashchange", navigate);
window.addEventListener("beforeunload", (e) => {
  if (state.dirty) {
    persistRecovery();
    e.preventDefault();
    e.returnValue = "";
  }
});
(async () => {
  if (!(await restoreRecovery())) navigate();
})();

import {
  samplePlan,
  validatePlan,
  occursOn,
  activitiesForDate,
  dateFromIsoWeek,
  weeksInYear,
  orderActivities,
  reorderActivities,
  recurrenceLabel,
  deadlineWithinDaypart,
  createDaypartTimes,
  formatMinutes,
  dateKey,
  parseDate,
  validDeadline,
  summarizeDay,
} from "../docs/js/core.js";
const results = document.querySelector("#results");
let passed = 0;
function test(name, fn) {
  const li = document.createElement("li");
  try {
    if (fn() === false) throw Error("onverwacht resultaat");
    li.textContent = `✓ ${name}`;
    li.className = "ok";
    passed++;
  } catch (e) {
    li.textContent = `✗ ${name}: ${e.message}`;
    li.className = "fail";
  }
  results.append(li);
}
const plan = samplePlan(),
  day = new Date(2024, 1, 29);
test("voorbeeldplanning is geldig", () => validatePlan(plan).length === 0);
test("ongeldig format wordt geweigerd", () =>
  validatePlan({ ...plan, format: "fout" }).length > 0);
test("dubbele id wordt geweigerd", () =>
  validatePlan({
    ...plan,
    activities: [
      plan.activities[0],
      { ...plan.activities[1], id: plan.activities[0].id },
    ],
  }).some((x) => x.includes("dubbel")));
test("dagelijkse herhaling", () => occursOn(plan.activities[0], day));
test("wekelijkse herhaling", () =>
  occursOn(plan.activities[8], new Date(2024, 1, 26)) &&
  !occursOn(plan.activities[8], new Date(2024, 1, 27)));
test("maanddag 31 werkt in schrikkelmaand", () =>
  occursOn(plan.activities[3], new Date(2024, 1, 29)));
test("inactieve activiteit verschijnt niet", () =>
  !occursOn({ ...plan.activities[0], active: false }, day));
test("activiteiten zijn op dagdeel en sortOrder geordend", () =>
  orderActivities([
    { ...plan.activities[1], sortOrder: 2 },
    { ...plan.activities[0], sortOrder: 0 },
  ])[0].daypart === "before_opening");
test("taak verplaatsen naar ander dagdeel", () => {
  const activities = [
    { id: "a", daypart: "morning", sortOrder: 0 },
    { id: "b", daypart: "morning", sortOrder: 1 },
    { id: "c", daypart: "afternoon", sortOrder: 0 },
  ];
  return (
    reorderActivities(activities, "a", "c", false, "afternoon") &&
    activities.find((a) => a.id === "a").daypart === "afternoon" &&
    activities.filter((a) => a.daypart === "morning").every((a, i) => a.sortOrder === i) &&
    activities.filter((a) => a.daypart === "afternoon").every((a, i) => a.sortOrder === i)
  );
});
test("taak wordt achter doelactiviteit geplaatst", () => {
  const activities = [
    { id: "a", daypart: "morning", sortOrder: 0 },
    { id: "b", daypart: "morning", sortOrder: 1 },
    { id: "c", daypart: "morning", sortOrder: 2 },
  ];
  reorderActivities(activities, "a", "b", true);
  return orderActivities(activities).map((a) => a.id).join(",") === "b,a,c";
});
test("taak verplaatsen naar leeg dagdeel", () => {
  const activities = [
    { id: "a", daypart: "morning", sortOrder: 0 },
    { id: "b", daypart: "afternoon", sortOrder: 0 },
  ];
  return (
    reorderActivities(activities, "a", null, false, "evening") &&
    activities.find((a) => a.id === "a").daypart === "evening" &&
    activities.find((a) => a.id === "a").sortOrder === 0
  );
});
test("dagelijkse herhaling krijgt een label", () =>
  recurrenceLabel({ type: "daily" }) === "Dagen (alle dagen)");
test("dagbelasting wordt per dagdeel uitgesplitst", () => {
  const day = new Date(2026, 10, 9),
    parts = summarizeDay(
      [
        ...plan.activities,
        {
          ...plan.activities[0],
          id: "inactive-long-task",
          active: false,
          durationMinutes: 999,
        },
      ],
      plan.metadata.daypartTimes,
      day,
    );
  return (
    parts.length === 5 &&
    parts.map((part) => [part.count, part.duration]).join("|") ===
      "5,120|6,155|8,205|5,140|7,135" &&
    parts.find((part) => part.key === "morning").capacity === 240 &&
    summarizeDay(
      plan.activities,
      {
        ...plan.metadata.daypartTimes,
        mon: { ...plan.metadata.daypartTimes.mon, morning: "09:00–11:00" },
      },
      day,
    ).find((part) => part.key === "morning").capacity === 120
  );
});
test("ISO week start op maandag", () =>
  dateFromIsoWeek(2024, 1).getDay() === 1);
test("jaar 2020 heeft week 53", () => weeksInYear(2020) === 53);
test("laatste maandelijkse vrijdag wordt herkend", () =>
  occursOn(
    { active: true, recurrence: { type: "monthly", occurrence: "last", weekday: "fri" } },
    new Date(2026, 10, 27),
  ) &&
  !occursOn(
    { active: true, recurrence: { type: "monthly", occurrence: "last", weekday: "fri" } },
    new Date(2026, 10, 20),
  ));
test("vijfde weekdag valt niet onder vierde week", () =>
  !occursOn(
    { active: true, recurrence: { type: "monthly", occurrence: "4", weekday: "mon" } },
    new Date(2024, 3, 29),
  ));
test("deadlinegrenzen worden gecontroleerd", () =>
  validDeadline("00:00") && validDeadline("23:59") &&
  !validDeadline("24:00") && !validDeadline("09:60"));
test("tijdformaat en datumconversie", () =>
  dateKey(parseDate("2026-11-09")) === "2026-11-09" &&
  formatMinutes(0) === "0 minuten" &&
  formatMinutes(1) === "1 minuut" &&
  formatMinutes(60) === "1 uur" &&
  formatMinutes(75) === "1 uur en 15 minuten");
test("standaardtijden bevatten alle weekdagen en dagdelen", () =>
  Object.keys(createDaypartTimes()).length === 7 &&
  Object.values(createDaypartTimes()).every((times) => Object.keys(times).length === 5));
test("daglijst voorkomt dubbele activiteiten", () =>
  new Set(activitiesForDate(plan.activities, day).map((x) => x.id)).size ===
  activitiesForDate(plan.activities, day).length);
test("wekelijkse herhaling krijgt een leesbaar label", () =>
  recurrenceLabel({ type: "weekly", weekdays: ["mon", "thu"] }) ===
  "Dagen (maandag, donderdag)");
test("maandelijkse herhaling krijgt een leesbaar label", () =>
  recurrenceLabel({ type: "monthly", occurrence: "2", weekday: "wed" }) ===
  "Maandelijks (tweede Woensdag)");
test("deadline wordt toegestaan", () =>
  validatePlan({
    ...plan,
    activities: [{ ...plan.activities[0], deadline: "11:00" }],
  }).length === 0);
test("ongeldige deadline wordt geweigerd", () =>
  validatePlan({
    ...plan,
    activities: [{ ...plan.activities[0], deadline: "25:00" }],
  }).some((x) => x.includes("deadline")));
test("korte beschrijving is optioneel", () =>
  validatePlan({
    ...plan,
    activities: [{ ...plan.activities[0], description: "" }],
  }).length === 0);
test("nul minuten is toegestaan", () =>
  validatePlan({
    ...plan,
    activities: [{ ...plan.activities[0], durationMinutes: 0 }],
  }).length === 0);
test("uitvoeringsduur is verplicht", () =>
  validatePlan({
    ...plan,
    activities: [{ ...plan.activities[0], durationMinutes: null }],
  }).some((x) => x.includes("durationMinutes")));
test("activiteit-id is verplicht", () =>
  validatePlan({
    ...plan,
    activities: [{ ...plan.activities[0], id: "" }],
  }).some((x) => x.includes("id ontbreekt")));
test("activiteit-status is verplicht", () =>
  validatePlan({
    ...plan,
    activities: [{ ...plan.activities[0], active: undefined }],
  }).some((x) => x.includes("active moet boolean")));
test("activiteitnaam is verplicht", () =>
  validatePlan({
    ...plan,
    activities: [{ ...plan.activities[0], name: "  " }],
  }).some((x) => x.includes("name moet")));
test("dagdeel is verplicht", () =>
  validatePlan({
    ...plan,
    activities: [{ ...plan.activities[0], daypart: "" }],
  }).some((x) => x.includes("ongeldig dagdeel")));
test("sorteervolgorde is verplicht", () =>
  validatePlan({
    ...plan,
    activities: [{ ...plan.activities[0], sortOrder: undefined }],
  }).some((x) => x.includes("sortOrder moet")));
test("dubbele sorteervolgorde wordt geweigerd", () =>
  validatePlan({
    ...plan,
    activities: [
      plan.activities[0],
      { ...plan.activities[1], sortOrder: plan.activities[0].sortOrder },
    ],
  }).some((x) => x.includes("dezelfde volgorde")));
test("herhaling is verplicht", () =>
  validatePlan({
    ...plan,
    activities: [{ ...plan.activities[0], recurrence: null }],
  }).some((x) => x.includes("ongeldige recurrence")));
test("wekelijkse weekdag is verplicht", () =>
  validatePlan({
    ...plan,
    activities: [
      { ...plan.activities[0], recurrence: { type: "weekly", weekdays: [] } },
    ],
  }).some((x) => x.includes("ongeldige weekdagen")));
test("maandelijkse week en weekdag zijn verplicht", () =>
  validatePlan({
    ...plan,
    activities: [
      {
        ...plan.activities[0],
        recurrence: { type: "monthly", occurrence: "5", weekday: "noday" },
      },
    ],
  }).some((x) => x.includes("maandelijkse herhaling")));
test("deadline binnen dagdeel wordt herkend", () =>
  deadlineWithinDaypart("07:30", "before_opening") &&
  !deadlineWithinDaypart("08:30", "before_opening"));
test("planning kan als JSON worden opgeslagen en geïmporteerd", () =>
  validatePlan(JSON.parse(JSON.stringify(plan))).length === 0);
test("import behoudt deadlines", () => {
  const imported = JSON.parse(
    JSON.stringify({
      ...plan,
      activities: [
        ...plan.activities,
        { ...plan.activities[0], id: "deadline-test", deadline: "11:00" },
      ],
    }),
  );
  return imported.activities.find((a) => a.id === "deadline-test").deadline === "11:00";
});
test("printgegevens bevatten geplande activiteiten", () =>
  activitiesForDate(
    [
      ...plan.activities,
      { ...plan.activities[0], id: "deadline-test", deadline: "11:00" },
    ],
    new Date(2026, 10, 2),
  ).some((a) => a.deadline === "11:00"));
const summary = document.createElement("p");
summary.textContent = `${passed}/${results.children.length} tests geslaagd.`;
document.body.append(summary);

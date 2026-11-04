import {
  samplePlan,
  validatePlan,
  occursOn,
  dateFromIsoWeek,
  weeksInYear,
  orderActivities,
  recurrenceLabel,
} from "../docs/js/core.js";
const plan = samplePlan();
const checks = [
  ["voorbeeldplanning is geldig", validatePlan(plan).length === 0],
  [
    "fout format wordt geweigerd",
    validatePlan({ ...plan, format: "fout" }).length > 0,
  ],
  ["dagelijkse herhaling", occursOn(plan.activities[0], new Date(2024, 1, 29))],
  [
    "maanddag 31 werkt in schrikkeljaar",
    occursOn(plan.activities[3], new Date(2024, 1, 29)),
  ],
  ["voorbeeldplanning bevat 40 taken", plan.activities.length === 40],
  [
    "planning heeft geen losse beschrijving",
    !Object.hasOwn(plan.metadata, "description"),
  ],
  [
    "voorbeeldplanning demonstreert variatie",
    new Set(plan.activities.map((a) => a.daypart)).size === 5 &&
      new Set(plan.activities.map((a) => a.durationMinutes)).size > 1 &&
      plan.activities.some((a) => a.recurrence.type === "monthly") &&
      plan.activities.some((a) => !a.active) &&
      plan.activities.filter((a) => a.deadline).length >= 4 &&
      plan.activities.some((a) => !a.description),
  ],
  ["ISO maandag", dateFromIsoWeek(2024, 1).getDay() === 1],
  ["week 53", weeksInYear(2020) === 53],
  [
    "vaste dagdeelvolgorde",
    orderActivities([
      { ...plan.activities[1], sortOrder: 2 },
      { ...plan.activities[0], sortOrder: 0 },
    ])[0].daypart === "before_opening",
  ],
  [
    "wekelijkse herhaling wordt duidelijk weergegeven",
    recurrenceLabel({ type: "weekly", weekdays: ["mon", "thu"] }) ===
      "Wekelijks (Maandag, Donderdag)",
  ],
  [
    "maandelijkse herhaling wordt duidelijk weergegeven",
    recurrenceLabel({ type: "monthly", occurrence: "2", weekday: "wed" }) ===
      "Maandelijks (tweede Woensdag)",
  ],
  [
    "tweede woensdag wordt herkend",
    occursOn(
      {
        active: true,
        recurrence: { type: "monthly", occurrence: "2", weekday: "wed" },
      },
      new Date(2026, 10, 11),
    ),
  ],
  [
    "laatste woensdag wordt herkend",
    occursOn(
      {
        active: true,
        recurrence: { type: "monthly", occurrence: "last", weekday: "wed" },
      },
      new Date(2026, 10, 25),
    ),
  ],
  [
    "deadline wordt toegestaan",
    validatePlan({
      ...plan,
      activities: [{ ...plan.activities[0], deadline: "11:00" }],
    }).length === 0,
  ],
  [
    "ongeldige deadline wordt geweigerd",
    validatePlan({
      ...plan,
      activities: [{ ...plan.activities[0], deadline: "25:00" }],
    }).some((x) => x.includes("deadline")),
  ],
  [
    "korte beschrijving is optioneel",
    validatePlan({
      ...plan,
      activities: [{ ...plan.activities[0], description: "" }],
    }).length === 0,
  ],
  [
    "uitvoeringsduur is verplicht",
    validatePlan({
      ...plan,
      activities: [{ ...plan.activities[0], durationMinutes: null }],
    }).some((x) => x.includes("durationMinutes")),
  ],
  [
    "activiteit-id is verplicht",
    validatePlan({
      ...plan,
      activities: [{ ...plan.activities[0], id: "" }],
    }).some((x) => x.includes("id ontbreekt")),
  ],
  [
    "activiteit-status is verplicht",
    validatePlan({
      ...plan,
      activities: [{ ...plan.activities[0], active: undefined }],
    }).some((x) => x.includes("active moet boolean")),
  ],
  [
    "activiteitnaam is verplicht",
    validatePlan({
      ...plan,
      activities: [{ ...plan.activities[0], name: "  " }],
    }).some((x) => x.includes("name moet")),
  ],
  [
    "dagdeel is verplicht",
    validatePlan({
      ...plan,
      activities: [{ ...plan.activities[0], daypart: "" }],
    }).some((x) => x.includes("ongeldig dagdeel")),
  ],
  [
    "sorteervolgorde is verplicht",
    validatePlan({
      ...plan,
      activities: [{ ...plan.activities[0], sortOrder: undefined }],
    }).some((x) => x.includes("sortOrder moet")),
  ],
  [
    "herhaling is verplicht",
    validatePlan({
      ...plan,
      activities: [{ ...plan.activities[0], recurrence: null }],
    }).some((x) => x.includes("ongeldige recurrence")),
  ],
  [
    "wekelijkse weekdag is verplicht",
    validatePlan({
      ...plan,
      activities: [
        { ...plan.activities[0], recurrence: { type: "weekly", weekdays: [] } },
      ],
    }).some((x) => x.includes("ongeldige weekdagen")),
  ],
  [
    "maandelijkse week en weekdag zijn verplicht",
    validatePlan({
      ...plan,
      activities: [
        {
          ...plan.activities[0],
          recurrence: { type: "monthly", occurrence: "5", weekday: "noday" },
        },
      ],
    }).some((x) => x.includes("maandelijkse herhaling")),
  ],
  [
    "aangepaste openingstijden zijn geldig",
    validatePlan({
      ...plan,
      metadata: {
        ...plan.metadata,
        daypartTimes: {
          ...plan.metadata.daypartTimes,
          mon: {
            ...plan.metadata.daypartTimes.mon,
            morning: "09:00–13:00",
          },
        },
      },
    }).length === 0,
  ],
  [
    "ongeldige openingstijd wordt geweigerd",
    validatePlan({
      ...plan,
      metadata: {
        ...plan.metadata,
        daypartTimes: { mon: { morning: "13:00–09:00" } },
      },
    }).some((x) => x.includes("begintijd")),
  ],
  [
    "onbekende dagdeelopeningstijd wordt geweigerd",
    validatePlan({
      ...plan,
      metadata: {
        ...plan.metadata,
        daypartTimes: { mon: { night: "22:00–23:00" } },
      },
    }).some((x) => x.includes("onbekend dagdeel")),
  ],
  [
    "dagdelen en handboekintroductie zijn verplicht",
    validatePlan({
      ...plan,
      metadata: {
        ...plan.metadata,
        daypartTimes: undefined,
        handbookIntro: undefined,
      },
    }).length >= 2,
  ],
];
for (const [name, ok] of checks) console.log(`${ok ? "✓" : "✗"} ${name}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);

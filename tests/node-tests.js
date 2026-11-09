import {
  samplePlan,
  validatePlan,
  occursOn,
  dateFromIsoWeek,
  weeksInYear,
  orderActivities,
  reorderActivities,
  recurrenceLabel,
  formatMinutes,
  dateKey,
  parseDate,
  validDeadline,
  createDaypartTimes,
  deadlineWithinDaypart,
  summarizeDay,
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
      new Set(
        plan.activities
          .filter((a) => a.recurrence.type === "monthly")
          .map((a) => `${a.recurrence.occurrence}-${a.recurrence.weekday}`),
      ).size >= 3 &&
      plan.metadata.daypartTimes.wed.morning === "08:30–12:30" &&
      plan.metadata.daypartTimes.sat.before_opening === "06:30–07:30" &&
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
    "verplaatsen naar ander dagdeel",
    (() => {
      const activities = [
        { id: "a", daypart: "morning", sortOrder: 0 },
        { id: "b", daypart: "morning", sortOrder: 1 },
        { id: "c", daypart: "afternoon", sortOrder: 0 },
      ];
      return (
        reorderActivities(activities, "a", "c", false, "afternoon") &&
        activities.find((a) => a.id === "a").daypart === "afternoon" &&
        activities
          .filter((a) => a.daypart === "morning")
          .every((a, i) => a.sortOrder === i) &&
        activities
          .filter((a) => a.daypart === "afternoon")
          .every((a, i) => a.sortOrder === i)
      );
    })(),
  ],
  [
    "verplaatsen achter doelactiviteit",
    (() => {
      const activities = [
        { id: "a", daypart: "morning", sortOrder: 0 },
        { id: "b", daypart: "morning", sortOrder: 1 },
        { id: "c", daypart: "morning", sortOrder: 2 },
      ];
      reorderActivities(activities, "a", "b", true);
      return orderActivities(activities).map((a) => a.id).join(",") === "b,a,c";
    })(),
  ],
  [
    "verplaatsen naar leeg dagdeel",
    (() => {
      const activities = [
        { id: "a", daypart: "morning", sortOrder: 0 },
        { id: "b", daypart: "afternoon", sortOrder: 0 },
      ];
      return (
        reorderActivities(activities, "a", null, false, "evening") &&
        activities.find((a) => a.id === "a").daypart === "evening" &&
        activities.find((a) => a.id === "a").sortOrder === 0
      );
    })(),
  ],
  [
    "ongeldige verplaatsing wordt genegeerd",
    (() => {
      const activities = [{ id: "a", daypart: "morning", sortOrder: 0 }];
      return (
        !reorderActivities(activities, "unknown", null, false, "morning") &&
        activities[0].daypart === "morning"
      );
    })(),
  ],
  [
    "wekelijkse herhaling wordt duidelijk weergegeven",
    recurrenceLabel({ type: "weekly", weekdays: ["mon", "thu"] }) ===
      "Dagen (maandag, donderdag)",
  ],
  [
    "maandelijkse herhaling wordt duidelijk weergegeven",
    recurrenceLabel({ type: "monthly", occurrence: "2", weekday: "wed" }) ===
      "Maandelijks (tweede Woensdag)",
  ],
  ["dagelijkse herhaling krijgt een label", recurrenceLabel({ type: "daily" }) === "Dagen (alle dagen)"],
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
    "dagbelasting wordt per dagdeel uitgesplitst",
    (() => {
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
          { ...plan.metadata.daypartTimes, mon: {
            ...plan.metadata.daypartTimes.mon,
            morning: "09:00–11:00",
          } },
          day,
        ).find((part) => part.key === "morning").capacity === 120
      );
    })(),
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
    "maandelijkse laatste dag wordt herkend",
    occursOn(
      {
        active: true,
        recurrence: { type: "monthly", occurrence: "last", weekday: "fri" },
      },
      new Date(2026, 10, 27),
    ) &&
      !occursOn(
        {
          active: true,
          recurrence: { type: "monthly", occurrence: "last", weekday: "fri" },
        },
        new Date(2026, 10, 20),
      ),
  ],
  [
    "maandelijkse vijfde weekdag bestaat niet",
    !occursOn(
      {
        active: true,
        recurrence: { type: "monthly", occurrence: "4", weekday: "mon" },
      },
      new Date(2024, 3, 29),
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
    "deadlinegrenzen worden gecontroleerd",
    validDeadline("00:00") &&
      validDeadline("23:59") &&
      !validDeadline("24:00") &&
      !validDeadline("09:60"),
  ],
  [
    "tijdformaat en datumconversie",
    dateKey(parseDate("2026-11-09")) === "2026-11-09" &&
      formatMinutes(0) === "0 minuten" &&
      formatMinutes(1) === "1 minuut" &&
      formatMinutes(60) === "1 uur" &&
      formatMinutes(75) === "1 uur en 15 minuten",
  ],
  [
    "standaardtijden bevatten alle weekdagen en dagdelen",
    Object.keys(createDaypartTimes()).length === 7 &&
      Object.values(createDaypartTimes()).every(
        (times) => Object.keys(times).length === 5,
      ),
  ],
  [
    "korte beschrijving is optioneel",
    validatePlan({
      ...plan,
      activities: [{ ...plan.activities[0], description: "" }],
    }).length === 0,
  ],
  [
    "nul minuten is toegestaan",
    validatePlan({
      ...plan,
      activities: [{ ...plan.activities[0], durationMinutes: 0 }],
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
    "dubbele sorteervolgorde wordt geweigerd",
    validatePlan({
      ...plan,
      activities: [
        plan.activities[0],
        { ...plan.activities[1], sortOrder: plan.activities[0].sortOrder },
      ],
    }).some((x) => x.includes("dezelfde volgorde")),
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
    "onbekende activiteitseigenschap wordt geweigerd",
    validatePlan({
      ...plan,
      activities: [{ ...plan.activities[0], unexpected: true }],
    }).some((x) => x.includes("onbekende eigenschap")),
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

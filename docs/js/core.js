export const DAYPARTS = [
  ["before_opening", "Voor opening"],
  ["morning", "Ochtend"],
  ["afternoon", "Middag"],
  ["evening", "Avond"],
  ["after_closing", "Na sluiting"],
];
export const DAYPART_TIMES = {
  before_opening: "07:00–08:00",
  morning: "08:00–12:00",
  afternoon: "12:00–18:00",
  evening: "18:00–21:00",
  after_closing: "21:00–22:00",
};
export const DEFAULT_HANDBOOK_INTRO = [
  "In dit overzicht vind je handige uitleg voor de dagelijkse taken. De instructies helpen om het werk op een vaste, duidelijke en zorgvuldige manier te doen.",
  "Volg de werkwijze en bespreek vragen of afwijkingen met je collega.",
];
export const WEEKDAYS = [
  ["mon", "Maandag"],
  ["tue", "Dinsdag"],
  ["wed", "Woensdag"],
  ["thu", "Donderdag"],
  ["fri", "Vrijdag"],
  ["sat", "Zaterdag"],
  ["sun", "Zondag"],
];
export const MONTHLY_OCCURRENCES = [
  ["1", "eerste"],
  ["2", "tweede"],
  ["3", "derde"],
  ["4", "vierde"],
  ["last", "laatste"],
];
export const createDaypartTimes = () =>
  Object.fromEntries(
    WEEKDAYS.map(([day]) => [
      day,
      Object.fromEntries(
        DAYPARTS.map(([key]) => [key, DAYPART_TIMES[key]]),
      ),
    ]),
  );
export const recurrenceLabel = (recurrence) =>
  recurrence.type === "daily"
    ? "Dagen (alle dagen)"
    : recurrence.type === "weekly"
      ? `Dagen (${recurrence.weekdays.map((day) => WEEKDAYS.find(([key]) => key === day)?.[1].toLowerCase()).join(", ")})`
      : `Maandelijks (${MONTHLY_OCCURRENCES.find(([key]) => key === String(recurrence.occurrence))?.[1] || "onbekend"} ${WEEKDAYS.find(([key]) => key === recurrence.weekday)?.[1] || "onbekende dag"})`;
const DAYPART_KEYS = new Set(DAYPARTS.map((x) => x[0]));
const WEEKDAY_KEYS = new Set(WEEKDAYS.map((x) => x[0]));
const TIME_RANGE_PATTERN =
  /^(?:[01]\d|2[0-3]):[0-5]\d–(?:[01]\d|2[0-3]):[0-5]\d$/;
export const pad = (n) => String(n).padStart(2, "0");
export const dateKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const parseDate = (value) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const formatDate = (date) =>
  new Intl.DateTimeFormat("nl-NL", { dateStyle: "long" }).format(date);
export const formatMinutes = (n) =>
  n == null
    ? ""
    : n < 60
      ? `${n} minuten`
      : `${Math.floor(n / 60)} uur${n % 60 ? ` en ${n % 60} minuten` : ""}`;
export const validDeadline = (value) =>
  value === undefined ||
  value === null ||
  value === "" ||
  /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
export const deadlineWithinDaypart = (deadline, daypart) => {
  if (!deadline || !DAYPART_TIMES[daypart]) return true;
  const [start, end] = DAYPART_TIMES[daypart]
    .split("–")
    .map((value) => value.replace(":", ""));
  const time = deadline.replace(":", "");
  return time >= start && time <= end;
};
export const dayIndex = (date) => (date.getDay() + 6) % 7;
export function isoWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + 3 - dayIndex(d));
  const first = new Date(d.getFullYear(), 0, 4);
  return {
    year: d.getFullYear(),
    week: Math.ceil(((d - first) / 86400000 + dayIndex(first) + 1) / 7),
  };
}
export function weeksInYear(year) {
  return isoWeek(new Date(year, 11, 28)).week;
}
export function dateFromIsoWeek(year, week, offset = 0) {
  const jan4 = new Date(year, 0, 4),
    monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayIndex(jan4) + (week - 1) * 7 + offset);
  return monday;
}
export function occursOn(activity, date) {
  if (!activity.active) return false;
  const r = activity.recurrence,
    weekday = WEEKDAYS[dayIndex(date)][0];
  if (r.type === "daily") return true;
  if (r.type === "weekly") return r.weekdays.includes(weekday);
  if (r.type === "monthly") {
    const occurrence =
      r.occurrence === "last" ? "last" : String(Math.ceil(date.getDate() / 7));
    const lastOfMonth = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
    ).getDate();
    return (
      r.weekday === weekday &&
      occurrence === String(r.occurrence) &&
      (r.occurrence !== "last" || date.getDate() + 7 > lastOfMonth)
    );
  }
  return false;
}
export function orderActivities(activities) {
  return [...activities].sort(
    (a, b) =>
      DAYPARTS.findIndex((x) => x[0] === a.daypart) -
        DAYPARTS.findIndex((x) => x[0] === b.daypart) ||
      a.sortOrder - b.sortOrder,
  );
}
export function reorderActivities(
  activities,
  id,
  targetId,
  after = false,
  targetDaypart,
) {
  const activity = activities.find((x) => x.id === id),
    target = activities.find((x) => x.id === targetId);
  if (!activity || (targetId && (!target || id === targetId))) return false;
  const originalDaypart = activity.daypart,
    daypart = targetDaypart || target?.daypart;
  if (!DAYPART_KEYS.has(daypart)) return false;
  const list = orderActivities(
    activities.filter((x) => x.daypart === daypart && x.id !== id),
  );
  let index = targetId ? list.findIndex((x) => x.id === targetId) : list.length;
  if (targetId && after) index += 1;
  if (targetId && index < 0) return false;
  activity.daypart = daypart;
  list.splice(index, 0, activity);
  list.forEach((x, i) => (x.sortOrder = i));
  if (daypart !== originalDaypart) {
    orderActivities(
      activities.filter((x) => x.daypart === originalDaypart),
    ).forEach((x, i) => (x.sortOrder = i));
  }
  return true;
}
export function activitiesForDate(activities, date) {
  return orderActivities(activities.filter((a) => occursOn(a, date)));
}
export function validatePlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== "object")
    errors.push("Het bestand bevat geen geldig object.");
  if (plan?.format !== "actiplan")
    errors.push("Eigenschap format moet 'actiplan' zijn.");
  if (plan?.schemaVersion !== 1) errors.push("schemaVersion 1 wordt vereist.");
  if (
    !plan?.metadata ||
    typeof plan.metadata.title !== "string" ||
    !plan.metadata.title.trim()
  )
    errors.push("metadata.title ontbreekt of is ongeldig.");
  if (
    !plan?.metadata ||
    typeof plan.metadata.department !== "string" ||
    !plan.metadata.department.trim()
  )
    errors.push("metadata.department ontbreekt of is ongeldig.");
  const daypartTimes = plan?.metadata?.daypartTimes;
  if (
    !daypartTimes ||
    typeof daypartTimes !== "object" ||
    Array.isArray(daypartTimes)
  ) {
    errors.push("metadata.daypartTimes moet een object zijn.");
  } else {
    for (const [day] of WEEKDAYS) {
      const dayTimes = daypartTimes[day];
      if (
        !dayTimes ||
        typeof dayTimes !== "object" ||
        Array.isArray(dayTimes)
      ) {
        errors.push(`metadata.daypartTimes.${day} moet een object zijn.`);
        continue;
      }
      for (const [key] of DAYPARTS) {
        const value = dayTimes[key];
        if (!TIME_RANGE_PATTERN.test(value)) {
          errors.push(
            `metadata.daypartTimes.${day}.${key} moet een geldig tijdsbereik zijn.`,
          );
          continue;
        }
        const [start, end] = value
          .split("–")
          .map((time) =>
            time
              .split(":")
              .reduce((minutes, part) => minutes * 60 + Number(part), 0),
          );
        if (start >= end)
          errors.push(
            `metadata.daypartTimes.${day}.${key} moet een begintijd voor de eindtijd hebben.`,
          );
      }
      for (const key of Object.keys(dayTimes))
        if (!DAYPART_KEYS.has(key))
          errors.push(
            `metadata.daypartTimes.${day} bevat een onbekend dagdeel '${key}'.`,
          );
    }
    for (const day of Object.keys(daypartTimes))
      if (!WEEKDAY_KEYS.has(day))
        errors.push(
          `metadata.daypartTimes bevat een onbekende weekdag '${day}'.`,
        );
  }
  if (
    !Array.isArray(plan?.metadata?.handbookIntro) ||
    !plan.metadata.handbookIntro.length ||
    plan.metadata.handbookIntro.some(
      (paragraph) => typeof paragraph !== "string" || !paragraph.trim(),
    )
  )
    errors.push("metadata.handbookIntro moet minstens één tekstalinea bevatten.");
  if (!Array.isArray(plan?.activities))
    errors.push("activities moet een lijst zijn.");
  const ids = new Set(),
    orders = new Map();
  for (const [i, a] of (plan?.activities || []).entries()) {
    const p = `Activiteit ${i + 1}`;
    if (!a || typeof a !== "object") {
      errors.push(`${p} is ongeldig.`);
      continue;
    }
    if (typeof a.id !== "string" || !a.id.trim())
      errors.push(`${p}: id ontbreekt.`);
    else if (ids.has(a.id)) errors.push(`${p}: id '${a.id}' komt dubbel voor.`);
    else ids.add(a.id);
    if (typeof a.active !== "boolean")
      errors.push(`${p}: active moet boolean zijn.`);
    if (typeof a.name !== "string" || !a.name.trim())
      errors.push(`${p}: name moet een niet-lege tekst zijn.`);
    if (a.description !== undefined && typeof a.description !== "string")
      errors.push(`${p}: description moet tekst zijn.`);
    if (
      a.workInstruction !== undefined &&
      typeof a.workInstruction !== "string"
    )
      errors.push(`${p}: workInstruction moet tekst zijn.`);
    if (!Number.isInteger(a.durationMinutes) || a.durationMinutes <= 0)
      errors.push(`${p}: durationMinutes moet een positief geheel getal zijn.`);
    if (!validDeadline(a.deadline))
      errors.push(`${p}: deadline moet een tijdstip in UU:MM zijn.`);
    if (!DAYPART_KEYS.has(a.daypart)) errors.push(`${p}: ongeldig dagdeel.`);
    if (!Number.isInteger(a.sortOrder) || a.sortOrder < 0)
      errors.push(`${p}: sortOrder moet een niet-negatief geheel getal zijn.`);
    const group = orders.get(a.daypart) || new Set();
    if (group.has(a.sortOrder))
      errors.push(
        `${p}: deze activiteit heeft binnen het gekozen dagdeel dezelfde volgorde als een andere activiteit. Wijzig het dagdeel of de volgorde.`,
      );
    group.add(a.sortOrder);
    orders.set(a.daypart, group);
    const r = a.recurrence;
    if (
      !r ||
      typeof r !== "object" ||
      !["daily", "weekly", "monthly"].includes(r.type)
    )
      errors.push(`${p}: ongeldige recurrence.`);
    else if (
      r.type === "weekly" &&
      (!Array.isArray(r.weekdays) ||
        !r.weekdays.length ||
        r.weekdays.some((x) => !WEEKDAY_KEYS.has(x)))
    )
      errors.push(`${p}: ongeldige weekdagen.`);
    else if (
      r.type === "monthly" &&
      (!["1", "2", "3", "4", "last"].includes(String(r.occurrence)) ||
        !WEEKDAY_KEYS.has(r.weekday))
    )
      errors.push(
        `${p}: maandelijkse herhaling moet een geldige weekdag en week van de maand hebben.`,
      );
    const known = [
      "id",
      "active",
      "name",
      "description",
      "workInstruction",
      "durationMinutes",
      "deadline",
      "daypart",
      "sortOrder",
      "recurrence",
    ];
    for (const key of Object.keys(a))
      if (!known.includes(key))
        errors.push(`${p}: onbekende eigenschap '${key}'.`);
  }
  return errors;
}
export const blankPlan = (title, department) => ({
  format: "actiplan",
  schemaVersion: 1,
  metadata: {
    title,
    department,
    daypartTimes: createDaypartTimes(),
    handbookIntro: [...DEFAULT_HANDBOOK_INTRO],
  },
  activities: [],
});
export const samplePlan = () => {
  const seeds = [
    [
      "Koelcel en temperatuur controleren",
      "before_opening",
      15,
      "07:15",
      "daily",
      true,
    ],
    [
      "Levering lossen en controleren",
      "before_opening",
      45,
      "07:30",
      "daily",
      true,
    ],
    [
      "Kratten en emballage sorteren",
      "before_opening",
      20,
      null,
      "daily",
      true,
    ],
    ["Winkelpresentatie nalopen", "before_opening", 25, null, "daily", true],
    ["Aardappelen en uien aanvullen", "morning", 30, null, "daily", true],
    ["Vers fruit spiegelen", "morning", 30, "09:00", "daily", true],
    ["Groenten bijvullen", "morning", 30, null, "daily", true],
    ["Derving registreren", "morning", 15, null, "daily", true],
    [
      "Prijskaartjes controleren",
      "morning",
      20,
      null,
      { type: "weekly", weekdays: ["mon", "thu"] },
      true,
    ],
    [
      "Biologische producten controleren",
      "morning",
      25,
      null,
      { type: "weekly", weekdays: ["tue", "fri"] },
      true,
    ],
    ["Bestellijst voor morgen maken", "morning", 30, null, "daily", true],
    [
      "Actie-eiland opbouwen",
      "morning",
      45,
      null,
      { type: "weekly", weekdays: ["wed", "sat"] },
      true,
    ],
    ["Kwaliteitsronde AGF uitvoeren", "afternoon", 30, "13:00", "daily", true],
    [
      "Fruit snijden voor proeverij",
      "afternoon",
      30,
      null,
      { type: "weekly", weekdays: ["fri", "sat"] },
      true,
    ],
    ["Kruiden en kiemgroenten verzorgen", "afternoon", 20, null, "daily", true],
    ["Panklare groenten controleren", "afternoon", 25, null, "daily", true],
    ["Magazijn netjes houden", "afternoon", 30, null, "daily", true],
    ["Aanvullen tijdens piekmoment", "afternoon", 45, null, "daily", true],
    [
      "Klantvraag over herkomst beantwoorden",
      "afternoon",
      15,
      null,
      "daily",
      true,
    ],
    [
      "Voorraadverschillen noteren",
      "afternoon",
      20,
      null,
      { type: "weekly", weekdays: ["mon", "wed", "fri"] },
      true,
    ],
    ["Avondaanvulling uitvoeren", "evening", 45, "18:00", "daily", true],
    ["Fruit en groenten roteren", "evening", 30, null, "daily", true],
    ["Beschadigde producten verwijderen", "evening", 20, null, "daily", true],
    ["Koeling opnieuw spiegelen", "evening", 30, null, "daily", true],
    [
      "Actiepresentatie bijwerken",
      "evening",
      25,
      null,
      { type: "weekly", weekdays: ["thu", "sat"] },
      true,
    ],
    ["Overdracht aan sluitdienst maken", "evening", 15, null, "daily", true],
    ["Laatste kwaliteitscontrole", "after_closing", 20, null, "daily", true],
    ["Koelcel afsluiten", "after_closing", 15, null, "daily", true],
    [
      "Kratten klaarzetten voor retour",
      "after_closing",
      20,
      null,
      "daily",
      true,
    ],
    [
      "Afval en organische resten afvoeren",
      "after_closing",
      20,
      null,
      "daily",
      true,
    ],
    ["AGF-afdeling afsluiten", "after_closing", 15, "21:30", "daily", true],
    [
      "Weekvoorraad tellen",
      "after_closing",
      45,
      null,
      { type: "weekly", weekdays: ["sat"] },
      true,
    ],
    [
      "Bestelhoeveelheden evalueren",
      "after_closing",
      30,
      null,
      { type: "weekly", weekdays: ["mon", "thu"] },
      true,
    ],
    [
      "Maandelijkse derving analyseren",
      "after_closing",
      60,
      null,
      { type: "monthly", occurrence: "last", weekday: "fri" },
      true,
    ],
    [
      "Leveranciersafspraken controleren",
      "before_opening",
      30,
      null,
      { type: "monthly", occurrence: "1", weekday: "tue" },
      true,
    ],
    [
      "Seizoenspresentatie voorbereiden",
      "morning",
      45,
      null,
      { type: "weekly", weekdays: ["sat"] },
      false,
    ],
    ["Dagstart met AGF-team", "before_opening", 15, null, "daily", true],
    [
      "Promotiemateriaal ophangen",
      "morning",
      20,
      null,
      { type: "monthly", occurrence: "2", weekday: "wed" },
      true,
    ],
    ["Buitenpresentatie nalopen", "afternoon", 20, null, "daily", true],
    ["Afsluitcontrole emballage", "after_closing", 15, null, "daily", true],
  ];
  const daypartOrders = new Map(DAYPARTS.map(([key]) => [key, 0]));
  const activities = seeds.map(
    ([name, daypart, durationMinutes, deadline, recurrence, active], index) => {
      const sortOrder = daypartOrders.get(daypart);
      daypartOrders.set(daypart, sortOrder + 1);
      const recurrenceValue =
        typeof recurrence === "object"
          ? recurrence
          : recurrence === "weekly"
            ? { type: "weekly", weekdays: ["mon", "wed", "fri"] }
            : { type: "daily" };
      return {
        id: `example-${String(index + 1).padStart(3, "0")}`,
        active,
        name,
        ...(index % 6 !== 2
          ? {
              description: `Voer ${name.toLowerCase()} uit volgens de afgesproken werkwijze.`,
            }
          : {}),
        ...(index % 5 !== 3
          ? {
              workInstruction:
                "Controleer de taak zorgvuldig en registreer bijzonderheden volgens de afdelingsafspraken.",
            }
          : {}),
        durationMinutes,
        ...(deadline ? { deadline } : {}),
        daypart,
        sortOrder,
        recurrence: recurrenceValue,
      };
    },
  );
  const daypartTimes = createDaypartTimes();
  return {
    format: "actiplan",
    schemaVersion: 1,
    metadata: {
      title: "Voorbeeldplanning AGF-afdeling",
      department: "Supermarkt De Groene Hoek",
      daypartTimes: {
        ...daypartTimes,
        wed: {
          ...daypartTimes.wed,
          morning: "08:30–12:30",
          afternoon: "12:30–18:30",
        },
        sat: {
          ...daypartTimes.sat,
          before_opening: "06:30–07:30",
          evening: "17:00–20:00",
        },
      },
      handbookIntro: [...DEFAULT_HANDBOOK_INTRO],
    },
    activities,
  };
};

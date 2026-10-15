// Every user-facing string lives here. tests/copy.test.ts scans this file for banned phrasing.
// Wording rules: see CLAUDE.md "Wording" (wellness wording only, no dosing advice).

import type { Metric } from "@/lib/analysis/types";

const n1 = (x: number) => x.toFixed(1);
const listJoin = (parts: string[]) =>
  parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

export const strings = {
  appName: "GLP-1 Start Guide",
  footer: "For general wellness and education. Not medical advice.",
  prescriber: "If something here concerns you, it may be worth raising with your prescriber.",

  metrics: {
    restingHr: { name: "Resting heart rate", unit: "bpm", sentenceUnit: "bpm" },
    hrvMs: { name: "HRV", unit: "ms", sentenceUnit: "ms" },
    recovery: { name: "Recovery", unit: "%", sentenceUnit: "points" },
    sleepPerformance: { name: "Sleep performance", unit: "%", sentenceUnit: "points" },
    respiratoryRate: { name: "Respiratory rate", unit: "rpm", sentenceUnit: "rpm" },
    skinTempC: { name: "Skin temperature", unit: "°C", sentenceUnit: "°C" },
    strain: { name: "Strain", unit: "", sentenceUnit: "" },
  } satisfies Record<Metric, { name: string; unit: string; sentenceUnit: string }>,

  drugs: { semaglutide: "Semaglutide", tirzepatide: "Tirzepatide" },
  injectionTimes: { morning: "Morning", evening: "Evening" },
  weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],

  connection: {
    checking: "Checking your WHOOP connection…",
    connected: "Connected to WHOOP",
    notConnected: "Not connected",
    connect: "Connect your WHOOP",
    disconnect: "Disconnect",
    failed: "Couldn't connect to WHOOP. Please try again.",
  },

  nav: {
    week: "Week",
    since: "Since first dose",
    method: "Method",
    setup: "Setup",
    exitDemo: "Exit demo",
    syntheticBadge: "Synthetic member",
    refresh: "Refresh data",
    refreshing: "Refreshing…",
  },

  landing: {
    oneLiner:
      "See how your resting heart rate, HRV, recovery and sleep move across each weekly GLP-1 injection, compared with your own usual week before you started.",
    tryDemo: "Try the demo",
    connect: "Connect your WHOOP (invite only)",
    howItWorks: "How it works",
  },

  demo: {
    title: "Try the demo",
    intro: "Pick a synthetic member. Everything on these screens is made up, so you can explore without a WHOOP account.",
    open: "Open →",
    personas: {
      A: {
        title: "Member A: a weekly pattern",
        body: (drug: string, weekday: string) =>
          `${drug}, injected on ${weekday}s. Built with a within-week pattern after each injection, plus a slow rise in resting heart rate.`,
      },
      B: {
        title: "Member B: no pattern",
        body: (drug: string, weekday: string) =>
          `${drug}, injected on ${weekday}s. Built with no drug-related pattern at all, to show what "nothing here" looks like.`,
      },
      C: {
        title: "Member C: the weekday trap",
        body: (drug: string, weekday: string, habitNight: string) =>
          `${drug}, injected on ${weekday}s. A habit every ${habitNight} night shifts the next morning, before and after starting. Toggle Raw and Adjusted on the Week page to see it appear and disappear.`,
      },
    },
  },

  notices: {
    loading: "Loading your WHOOP data…",
    loadingDemo: "Loading the synthetic member…",
    calculating: "Calculating…",
    notConnected: {
      title: "Connect your WHOOP to see your own weeks",
      body: "Or try the demo with a synthetic member.",
    },
    noInputs: {
      title: "Add your injection details",
      body: "Your first dose date and injection day are needed to line up your weeks.",
      action: "Go to setup",
    },
    notEnoughPreDrug: {
      title: "Not enough data from before your first dose",
      body: (minPerWeekday: number, weeks: number | null) =>
        `This view needs at least ${minPerWeekday} mornings for each weekday ${weeks === null ? "before" : `in the ${weeks} weeks before`} your first dose, to know your usual week.`,
    },
    notEnoughCycles: {
      title: (have: number, need: number) => `${have} of ${need} injection weeks so far`,
      body: "The week view appears once there are enough complete injection weeks to compare.",
    },
    error: {
      title: "Couldn't load your WHOOP data",
      body: (status: number) => `The request failed with status ${status}. Try Refresh data.`,
    },
  },

  week: {
    title: "Your injection week",
    intro: "How each morning after your injection compares with the rest of that week.",
    toggleAdjusted: "Adjusted for your usual week",
    toggleRaw: "Raw",
    toggleLabel: "View",
    relativeNote:
      "The shape is relative to your own weekly average, so the seven days balance out to zero. It shows when in the week things move, not your overall level.",
    adjustedNote: "Adjusted: each morning is compared with your usual for that weekday before you started.",
    rawNote: "Raw: not adjusted for your usual weekday rhythm. Compare with Adjusted to see whether a pattern is just your usual week.",
    dayZero: (offsetDays: number, time: "morning" | "evening") =>
      offsetDays === 1
        ? "Day 0 is the first morning after your injection."
        : time === "morning"
          ? "Day 0 is the morning of your injection day."
          : "Day 0 is the morning of your injection day, before the evening dose.",
    cycles: (n: number) => `Based on ${n} injection weeks.`,
    clearExplainer: (days: number, metrics: number, levelPct: string) =>
      `A day is marked "clear" only if it passes a stricter test than the 95% band, to allow for ${days * metrics} checks at once (${days} days × ${metrics} metrics, ${levelPct}% level).`,
    legend: "Dot: average for that day. Bar: 95% band. Filled dot: clear. Dashed line: your weekly average.",
    dayLabel: (d: number) => `Day ${d}`,
    clearMark: "clear",
    bandLabel: "95% band",
    tooltip: {
      estimate: "Average",
      band: "95% band",
      clear: "Clear",
      notClear: "Not clear",
    },
    summaryTitle: "Summary",
    heading: (unit: string) => `${unit} vs your weekly average`,
    table: {
      caption: (metricName: string) => `${metricName} by day since injection`,
      day: "Day",
      average: "Average",
      band: "95% band",
      clear: "Clear",
      yes: "Yes",
      no: "No",
    },
  },

  summary: {
    nothingClear: "No clear pattern beyond your usual week.",
    rawPrefix: "Raw view, not adjusted for your usual weekday rhythm.",
    dayPart: (d: number, size: number, unit: string, above: boolean) =>
      `${n1(size)} ${unit} ${above ? "above" : "below"} on day ${d}`,
    metricLine: (metricName: string, parts: string[], otherDaysExist: boolean) =>
      `${metricName} averages ${listJoin(parts)}, compared with your weekly average.${otherDaysExist ? " No clear change on the other days." : ""}`,
    metricNone: (metricName: string) => `${metricName}: no clear change on any day.`,
    metricNotEnough: (metricName: string) => `${metricName}: not enough data yet.`,
  },

  since: {
    title: "Since your first dose",
    intro: (days: number) =>
      `Your ${days}-day average compared with your usual before you started, matched by weekday. Zero means no change from your usual.`,
    otherChanges:
      "Changes here can also come from anything else that changed since your start date, such as season, training or sleep habits.",
    beforeFirstDose: "before first dose",
    afterFirstDose: "since first dose",
    legend: "Gray: before first dose. Blue: since first dose. Dashed line: your pre-drug usual.",
    doseStep: (mg: number) => `${mg} mg`,
    doseStepsNote: "Dashed lines mark each dose step.",
    heading: (unit: string) => `${unit} vs your usual`,
    latestLevel: (metricName: string, date: string, value: string) =>
      `${metricName}: latest rolling level on ${date} is ${value} compared with your usual.`,
    labelBand: (low: number, high: number) =>
      `The drug label reports an average resting heart rate increase of ${low} to ${high} bpm across trial participants. The shaded band shows that range. It is a trial average, not a target for you.`,
    labelSource: "Source:",
    whoopStudy: (members: number, rhr: number, hrv: number) =>
      `In a WHOOP study of ${members} members using GLP-1 medications, resting heart rate averaged ${rhr} bpm higher and HRV ${Math.abs(hrv)} ms lower.`,
    ownBaselineOnly: "HRV, recovery and sleep are compared with your own baseline only.",
    tooltipDate: "Date",
    tooltipValue: "Rolling level",
    tooltipDays: (n: number) => `${n} mornings in window`,
  },

  setup: {
    title: "Your injection details",
    intro: "Saved only in this browser. Used to line up your WHOOP data with your injection weeks.",
    drug: "Medication",
    firstDose: "First dose date",
    injectionTime: "Usual injection time",
    weekdaySchedule: "Injection day",
    weekdayFrom: "From",
    weekdayDay: "Day",
    addWeekdayChange: "Add a change of injection day",
    missed: "Missed injections",
    addMissed: "Add a missed date",
    moved: "Moved injections",
    movedScheduled: "Planned date",
    movedActual: "Actual date",
    addMoved: "Add a moved injection",
    doseSteps: "Dose steps",
    doseDate: "Date",
    doseMg: "mg",
    addDoseStep: "Add a dose step",
    remove: "Remove",
    save: "Save",
    saved: "Saved.",
    clear: "Clear saved details",
    cleared: "Cleared.",
    storageUnavailable: "This browser isn't allowing local storage, so details can't be saved.",
    demoMode: {
      title: "Setup is for your own data",
      body: "Demo members come with their injection details already filled in. Exit the demo to enter yours.",
    },
    errors: {
      required: "Please fill in the first dose date and injection day.",
      date: "Dates need to look like 2026-03-04.",
      mg: "Each dose step needs an amount above zero.",
      firstWeekday: "The first injection day must match the weekday of your first dose date.",
      startingDose: "Please add your starting dose. Its date is filled in from your first dose date.",
    },
  },

  method: {
    title: "Method and limits",
    intro:
      "How the app turns daily WHOOP numbers into a picture of your injection week, how it was checked, and what it can't tell you.",
    stepsTitle: "The steps",
    steps: [
      "Your usual week: for each weekday, the average of your mornings in the weeks before your first dose.",
      "Adjust: each morning minus your usual for that weekday, so a regular Monday dip doesn't look like an injection effect.",
      "Line up injection weeks: day 0 is set by your injection time, and each week runs to the next injection. Weeks with a missed, moved or changed injection day are left out, as are weeks with too few mornings.",
      "Center each week: subtract that week's own average, which removes slow drift such as weight change, dose level or season.",
      "Average across weeks: the result for each day is the mean over your injection weeks, with a band from resampling whole weeks.",
      "Clear or not: a day is called clear only if a stricter interval, which allows for the many days and metrics checked, excludes zero.",
    ],
    selfTestsTitle: "Self-tests",
    selfTestsIntro:
      "The analysis is checked on synthetic members whose answers are known in advance. These results are computed by the app's own code.",
    selfTests: {
      planted: (worst: string, tolerance: string) =>
        `Planted pattern: on Member A, the recovered shape is within ${worst} × the day-to-day noise of the planted one on its worst day (allowed: ${tolerance} ×).`,
      null: (clear: number, runs: number, maxPct: number) =>
        `No effect: Member B showed a clear pattern in ${clear} of ${runs} simulated runs (allowed: up to ${maxPct}%).`,
      placebo: (clear: number, runs: number, maxPct: number) =>
        `Placebo date: Member B's data before starting, with a fake start date, showed a clear pattern in ${clear} of ${runs} runs (allowed: up to ${maxPct}%).`,
      trap: (d: number, rawClear: boolean, adjustedClear: boolean) =>
        `Weekday trap: Member C's weekly habit ${rawClear ? "shows" : "does not show"} as clear on day ${d} in the raw view, and ${adjustedClear ? "still shows" : "disappears"} once adjusted.`,
      pass: "Pass",
      fail: "Fail",
    },
    mdeTitle: "Smallest change this analysis can detect for one person",
    mdeIntro: (runs: number, cycles: number, weeks: number) =>
      `Simulated on ${runs.toLocaleString("en-US")} runs of a member with no drug effect, about ${cycles} injection weeks and ${weeks} pre-drug weeks. A smaller change on a given day may be real but won't be called clear.`,
    mdeColumns: {
      metric: "Metric",
      noise: "Day-to-day noise",
      half: "Detected about half the time",
      most: "Detected 4 in 5 times",
    },
    intervalTitle: "Why this interval",
    intervalBody: [
      "The first approach, percentile intervals from resampling, was slightly too narrow with few injection weeks. At the strict level needed for many checks, that let Member B show false clear patterns in 14 of 100 runs, and 31 of 100 with a placebo date.",
      "The app now builds a t interval from the resampled spread, with degrees of freedom set by the scarcer of injection weeks and pre-drug weeks. False clear patterns fell to about 1 in 100. A more lenient option reached the 10 in 100 limit with only 8 weeks of data, while the app allows as few as 6.",
      "For a health-facing tool, a false clear pattern is worse than a missed one, so the stricter interval was chosen. It costs some sensitivity.",
    ],
    limitsTitle: "Known limits",
    limits: [
      "One person's data: a few dozen injection weeks can only reveal fairly large within-week changes (see the table above).",
      "This shows patterns that line up with your injection days. It cannot show what produced them.",
      "WHOOP's API has no medication data, so injection dates come from what you enter in Setup.",
      "Your usual week is learned from the weeks before your first dose. If your routine changed when you started, the comparison shifts too.",
      "The demo members are synthetic. Their patterns were planted to test the method, not taken from real people.",
    ],
    sourcesTitle: "Sources",
    whoopApi: "WHOOP developer documentation",
  },
} as const;

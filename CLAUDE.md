# GLP-1 Start Guide

A Next.js web app that shows how a WHOOP member's resting heart rate, HRV, recovery and sleep move across each weekly GLP-1 injection cycle (semaglutide or tirzepatide), adjusted for the member's own weekly rhythm before the drug. It is a portfolio piece for a Business Analyst role on WHOOP's healthcare product team, so correctness, honesty about uncertainty, and clean analysis code matter more than visual flash.

Owner: Prakhar (pharmacist, health informatics). Build phases and acceptance checks are in `PROMPTS.md`.

Next.js version-specific guidance: see AGENTS.md.

## Hard rules (never break these)

1. **Never hardcode or guess analysis parameters.** Every value that changes results lives in `src/config/analysis.ts` or `src/config/personas.ts` and starts as `null`. If you need a value that isn't set, stop and ask Prakhar. Do not pick a "reasonable default."
2. **No storage of WHOOP data.** No database, no files, no KV, no caching beyond the single request. Every fetch to WHOOP uses `cache: 'no-store'`; routes that touch WHOOP export `dynamic = 'force-dynamic'` and respond with `Cache-Control: no-store`. WHOOP's API terms forbid databases or permanent copies of WHOOP data.
3. **Never log WHOOP response bodies or tokens.** Log status codes and endpoint names only.
4. **Client secret stays server-side.** Read `WHOOP_CLIENT_SECRET` only in route handlers or server-only modules. Never prefix it with `NEXT_PUBLIC_`.
5. **No language model sees member data.** The app never sends member data to any AI API. You (Claude Code) must not call `/api/whoop/days`, open `/debug`, or read files in `notebook/data/export/` beyond their header line. Prakhar runs anything that touches his real data.
6. **Wellness wording only.** All user-facing text lives in `src/copy/strings.ts`. A test fails on banned phrasing (see "Wording"). No cause-and-effect claims, no dosing advice, no "normal/abnormal/safe/dangerous."
7. **Synthetic data is always labeled.** Every screen showing a demo member shows a "Synthetic member" badge. Synthetic files live only under `src/data/personas/` and `notebook/data/synthetic/`, and each includes `"synthetic": true`.
8. **Don't invent facts.** If a WHOOP field name, CSV column or library API is uncertain, check the docs or the installed package and ask rather than assume. If anything here conflicts with the WHOOP docs, stop and tell Prakhar.

## Stack

- Next.js (App Router, TypeScript, `src/` directory), Tailwind CSS
- Recharts for charts
- `iron-session` (v8 or later) for an encrypted httpOnly session cookie holding tokens. Follow the installed version's docs for App Router usage (in recent Next.js, `cookies()` is async).
- Vitest for unit tests (`vitest run`, never watch mode in scripts), `tsx` to run TypeScript scripts
- Notebook: Python 3 in a project `.venv` with DuckDB, pandas, matplotlib, ipykernel and nbstripout, run as a Jupyter notebook in VS Code
- Deploy: Vercel

## Layout

```
src/
  app/
    page.tsx                  landing
    demo/page.tsx             pick a synthetic member
    setup/page.tsx            member inputs (localStorage)
    week/page.tsx             injection-week view
    since/page.tsx            long view since first dose
    method/page.tsx           method and limits
    debug/page.tsx            dev only; 404 in production
    api/auth/login/route.ts
    api/auth/callback/route.ts
    api/auth/logout/route.ts
    api/whoop/days/route.ts   fetch + normalize, returns DailyRow[]
  lib/
    whoop/oauth.ts            authorize URL, code exchange, refresh
    whoop/client.ts           paginated GET with backoff on 429
    whoop/normalize.ts        join sleep + recovery + cycle into DailyRow
    analysis/types.ts
    analysis/weekday.ts       pre-drug weekday means
    analysis/adjust.ts        a_t = x_t - pre-drug mean for that weekday
    analysis/cycles.ts        injection dates, cycles, day-since-injection, centering
    analysis/profile.ts       P(d) with uncertainty
    analysis/longView.ts      rolling level vs baseline, dose-step markers
    analysis/summary.ts       plain-language result using copy strings
    session.ts
  config/
    analysis.ts               AnalysisConfig, every value null until Prakhar sets it
    personas.ts               PersonaConfig, every value null until Prakhar sets it
    errors.ts                 ConfigNotSetError, requireConfig()
  copy/strings.ts             every user-facing string
  data/
    labelRanges.ts            cited label facts (below)
    personas/                 generated synthetic JSON
scripts/
  generate-personas.ts
  export-engine-results.ts
notebook/
  analysis.ipynb
  sql/                        .sql files used by the notebook
  data/synthetic/             generated CSVs, inputs JSON, engine results
  data/export/                Prakhar's own WHOOP export (gitignored)
tests/
```

Client pages that use localStorage (`setup`, `week`, `since`, `demo`) are client components that read it inside `useEffect` with try/catch, and show a loading state until mounted.

## Environment variables (`.env.local`, never committed)

```
WHOOP_CLIENT_ID=
WHOOP_CLIENT_SECRET=
WHOOP_REDIRECT_URI=http://localhost:3000/api/auth/callback
SESSION_SECRET=            # 32+ random characters
```

`.gitignore` must include `.env*.local`, `.venv/`, `notebook/data/export/`, and any downloaded WHOOP CSV.

## WHOOP API facts (from developer.whoop.com, Oct 2026)

- Authorize: `https://api.prod.whoop.com/oauth/oauth2/auth` with `client_id`, `redirect_uri`, `response_type=code`, `scope` (space-separated), `state` (at least 8 characters; generate 32 random characters, store in an httpOnly cookie with `sameSite: 'lax'`, verify on callback).
- Scopes: `offline read:recovery read:cycles read:sleep`. `offline` is required to get a refresh token.
- Token endpoint: `POST https://api.prod.whoop.com/oauth/oauth2/token`.
  - Code exchange: `grant_type=authorization_code`, `code`, `client_id`, `client_secret`, `redirect_uri`. WHOOP's docs don't state the body format; a working public script uses `application/x-www-form-urlencoded`.
  - Refresh: `grant_type=refresh_token`, `refresh_token`, `client_id`, `client_secret`, `scope=offline` (docs show a JSON body).
  - If one format is rejected, try the other and report the status code.
- Access tokens last about an hour (`expires_in`, sample 3600). Refreshing invalidates the old token, so save the newest refresh token in the session. Refresh only inside route handlers (Server Components can't set cookies), at most once per request.
- Data base URL: `https://api.prod.whoop.com/developer`
  - `GET /v2/cycle`: `id`, `start`, `end`, `timezone_offset` (e.g. `-05:00`), `score_state`, `score.strain`
  - `GET /v2/recovery`: `cycle_id`, `sleep_id`, `score_state`, `score.recovery_score`, `score.resting_heart_rate`, `score.hrv_rmssd_milli`, `score.spo2_percentage`, `score.skin_temp_celsius`, `score.user_calibrating`
  - `GET /v2/activity/sleep`: `id`, `cycle_id`, `start`, `end`, `timezone_offset`, `nap`, `score_state`, `score.sleep_performance_percentage`, `score.respiratory_rate`, `score.stage_summary`
  - Collection params: `start`, `end` (ISO date-time), `limit` (max 25), `nextToken`. Response: `records`, `next_token`.
- Rate limits: 100 requests/minute, 10,000/day. Back off on 429.
- New apps allow 10 connected members (sandbox). Reviewers use demo mode.
- The API exposes no Journal, medications, intraday heart rate, blood pressure or menstrual data.

## Daily row (the one shape everything uses)

```ts
type DailyRow = {
  date: string;              // local YYYY-MM-DD of the main sleep's END (wake morning), shifted by that sleep's timezone_offset
  cycleId: number | string;
  restingHr: number | null;  // recovery.score.resting_heart_rate
  hrvMs: number | null;      // recovery.score.hrv_rmssd_milli
  recovery: number | null;   // recovery.score.recovery_score
  sleepPerformance: number | null;
  respiratoryRate: number | null;
  skinTempC: number | null;
  strain: number | null;     // from the cycle that starts with this sleep
  calibrating: boolean;
};
```

Why wake date: WHOOP cycles begin at sleep onset, so using `cycle.start` puts late bedtimes on the wrong date and can give one date two rows. The row is dated to the morning the recovery describes. Rules: join recovery and the main (non-nap) sleep on `cycle_id`; any record whose `score_state` is not `SCORED` contributes `null`; if two rows land on one date, flag it in tests rather than silently merging. Handling of calibration rows follows `config.calibratingRule`.

## Analysis spec

Every analysis function takes `cfg: AnalysisConfig` as an argument and calls `requireConfig(cfg, 'key')` for each value it needs. Pages pass the real config; tests pass copies.

Member inputs (stored in localStorage): drug (`semaglutide` | `tirzepatide`, weekly injectables only), first dose date, injection weekday with dated changes, dates of missed or moved injections, usual injection time (`morning` | `evening`), dose steps (date, mg).

1. **Pre-drug weekday means.** For each metric, the mean for each weekday over the pre-drug window (`cfg.preDrugWindow`). Require `cfg.minPreDrugWeeksPerWeekday` observations per weekday, otherwise report "not enough pre-drug data".
2. **Adjusted value.** `a_t = x_t - preMean[weekday(t)]`.
3. **Injection dates and cycles.** Injection dates come from the weekday schedule, minus dates marked missed and with moved dates replaced. Each cycle runs from one injection to the next. Assign each post-drug day a day-since-injection `d`. Which morning is `d = 0` depends on injection time (`cfg.dayZeroRule`). Cycles that aren't 7 days long follow `cfg.irregularCycleRule`; missed injections follow `cfg.missedInjectionRule`. Apply `cfg.excludeWeeksAfterStart`, `cfg.excludeWeeksAfterDoseStep` and `cfg.minDaysPerCycle`.
4. **Within-cycle centering.** `s_t = a_t - mean(a over the same cycle)`. This removes drift that is roughly constant within a cycle (weight loss, dose level, season). A linear trend still leaves a small tilt of about slope × (d − 3). The result `P(d)` is a relative shape that averages to zero across the week, not a level.
5. **Profile.** `P(d) = mean of s_t over cycles with that d`, with uncertainty from `cfg.uncertaintyMethod`. Whatever the method, treat cycles (not days) as the unit, and propagate the error in the pre-drug weekday means, which is shared by every cycle because `d` and weekday are aligned. Show the number of cycles. Only show when cycles >= `cfg.minCycles`.
6. **"Clear pattern" rule.** From `cfg.clearPatternRule`. Otherwise the summary says there is no clear pattern beyond the usual week.
7. **Long view.** Rolling mean of `a_t` (window `cfg.rollingWindowDays`) since the first dose, with dose steps marked. Resting HR only: draw the label's reported trial-average change as a reference band, captioned as a trial average. HRV is compared with the member's own baseline only.
8. **Raw view.** Raw means steps 3 to 6 run on `x_t` instead of `a_t`. The week page can show raw next to adjusted to demonstrate the weekday trap.

### Self-tests (`tests/analysis.test.ts`)

Test parameters (seeds, placebo offset, tolerances, acceptable false-pattern rate) come from `src/config/personas.ts`; never pick them yourself.

- **Planted pattern:** persona A's planted within-week profile (specified as mean-zero) is recovered within `personas.recoveryTolerance`.
- **Null:** persona B (no drug effect), over `personas.testSeeds` seeds, reports a clear pattern no more often than `personas.maxFalsePatternRate`.
- **Weekday trap:** persona C has a pre-existing weekly habit and no drug effect. In the raw view, a clear pattern appears at the `d` that falls on the habit's morning (computed from persona C's config and `cfg.dayZeroRule`). In the adjusted view, no clear pattern appears.
- **Placebo date:** on persona B's pre-drug data with a fake start date `personas.placeboStartOffsetWeeks` after the start of its history, over `personas.testSeeds` seeds, the false-pattern rate is at most `personas.maxFalsePatternRate`. Persona history must cover the pre-drug window plus the placebo window.
- **Config guard:** each analysis entry point throws `ConfigNotSetError` when passed a config copy with a needed key set to `null`.

## Label facts (`src/data/labelRanges.ts`, cited in the UI)

- Tirzepatide (Zepbound label, revised Aug 2026): mean heart rate increase of 1 to 3 bpm across trial participants; elimination half-life about 5 to 6 days. https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=487cd7e7-434c-4925-99fa-aa80b1cc776b
- Semaglutide (Wegovy label): mean resting heart rate increase of 1 to 4 bpm (section 5.9, via https://medlibrary.org/lib/rx/meds/wegovy/page/4/); elimination half-life about 1 week (FDA label, Mar 2024, https://www.accessdata.fda.gov/drugsatfda_docs/label/2024/215256s011lbl.pdf).
- WHOOP member study (n = 132): resting HR +3 bpm, HRV −6 ms on GLP-1. Show as text only, not as a band. https://www.whoop.com/us/en/thelocker/understanding-glp-1-therapies-through-whoop/

## Wording

Allowed patterns:
- "averages X above your usual for those weekdays"
- "No clear pattern beyond your usual week."
- "The drug label reports an average resting heart rate increase of X to Y bpm across trial participants."
- "If something here concerns you, it may be worth raising with your prescriber." (the only prescriber line)
- Refer to dose increases as "after a dose step."

The copy test scans `src/copy/strings.ts` and `src/data/labelRanges.ts` with these case-insensitive regexes. Word boundaries let "because" or "treatment" pass:

```
\bcaus(e|es|ed|ing)\b    \bdiagnos\w*    \btreat(s|ed|ing)?\b
\bnormal\b    \babnormal\b    \bsafe(ly)?\b    \bdangerous\b
side effects? detected    \byou should\b    (adjust|increase|decrease|change|skip|delay) (your|a|the) dose
```

Footer on every page: "For general wellness and education. Not medical advice."

## Working style

- Start each phase in plan mode, propose the plan, wait for approval.
- Write pure analysis functions with unit tests before wiring UI.
- Small commits, at least one per phase, with clear messages.
- When a phase's check passes, say so and list anything skipped.
- If a test fails because a config value looks wrong, show the numbers and ask. Never change config values yourself.

## Commands

- `npm run dev` (localhost:3000)
- `npm test` (`vitest run`)
- `npm run personas` (`tsx scripts/generate-personas.ts`)
- `npm run export-results` (`tsx scripts/export-engine-results.ts`)
- `npm run lint`

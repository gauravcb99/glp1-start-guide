# GLP-1 Start Guide: build prompts for Claude Code

Paste one phase at a time into the Claude Code panel in VS Code. Each prompt starts with `/plan`, so Claude Code proposes a plan first. Read it, push back if it guesses a value or skips a rule, then approve. When the phase's check passes, commit.

## Start here (once)

1. **Tools.** In Terminal: `node -v` should print v20 or later (otherwise install Node LTS from nodejs.org), and `python3 --version` should work. In VS Code (1.94 or later), press Cmd+Shift+X, search "Claude Code", install, and sign in. Also install the "Jupyter" and "Python" extensions.
2. **Folder.** Create `~/Projects/glp1-start-guide`, put `CLAUDE.md` and this `PROMPTS.md` in it, and open it in VS Code (File > Open Folder).
3. **Claude Code.** Open any file, then click the Claude Code spark icon at the top right of the editor. If `/plan` isn't recognized, switch to Plan mode from the mode indicator under the prompt box and paste the prompt without `/plan`.
4. **Git.** In the VS Code terminal (Ctrl+`), run `git init`.
5. **WHOOP app.** Have your developer app's client ID and secret ready (developer-dashboard.whoop.com). You paste them into `.env.local` yourself. Never paste the secret into the chat.

---

## Phase 0: scaffold

```
/plan Read CLAUDE.md fully. Phase 0: scaffold the project in this folder.
- Run `npx create-next-app@latest --help` first to confirm the flags, then scaffold non-interactively into ./tmp-app with TypeScript, ESLint, Tailwind, App Router, src directory, npm, import alias "@/*", and no git init (for example: npx create-next-app@latest tmp-app --ts --eslint --tailwind --app --src-dir --use-npm --import-alias "@/*" --disable-git --yes). Move everything, including dotfiles, into this folder without overwriting CLAUDE.md or PROMPTS.md, then delete tmp-app.
- Add vitest, tsx, recharts and iron-session. Add one passing sample test.
- npm scripts: "test": "vitest run", "personas": "tsx scripts/generate-personas.ts", "export-results": "tsx scripts/export-engine-results.ts", plus the default lint script.
- Create the folder layout from CLAUDE.md with empty, typed module stubs.
- Create src/config/analysis.ts (AnalysisConfig) and src/config/personas.ts (PersonaConfig) with every key listed in PROMPTS.md "Fill the config" typed and set to null. Add ConfigNotSetError and requireConfig(cfg, key).
- Create .env.local.example with the four variables and empty values. Update .gitignore per CLAUDE.md.
Do not implement features. Do not choose any parameter values.
```

**Check:** `npm run dev` shows a page at localhost:3000. `npm test` passes and exits. Run `touch .env.local && git status`: `.env.local` is not listed.

---

## Phase 1: WHOOP sign-in

First copy `.env.local.example` to `.env.local` and fill in your client ID, secret, redirect URI, and a SESSION_SECRET from `openssl rand -base64 32`.

```
/plan Phase 1: WHOOP OAuth, following "WHOOP API facts" and the hard rules in CLAUDE.md.
- /api/auth/login: generate a 32-character random state, store it in an httpOnly cookie with sameSite 'lax', redirect to the WHOOP authorize URL with scope "offline read:recovery read:cycles read:sleep".
- /api/auth/callback: verify state, exchange the code for tokens, store access token, refresh token and expiry in an encrypted iron-session cookie (check the installed iron-session version's App Router usage). Redirect to /setup.
- A server-only getAccessToken() used only inside route handlers. It refreshes when the token is close to expiry, saves the newest refresh token, and refreshes at most once per request.
- /api/auth/logout clears the session.
- A "Connected to WHOOP" / "Not connected" indicator on the landing page, fed by a small /api/auth/status route.
- Log only status codes, never tokens or bodies.
- Unit-test the authorize URL builder and the state check.
If the token endpoint rejects the body format, tell me the status code and try the other format described in CLAUDE.md.
```

**Check:** You click "Connect your WHOOP", approve on WHOOP, and land on `/setup` showing "Connected." It still works after the access token's hour is up.

---

## Phase 2: fetch and normalize

```
/plan Phase 2: fetch and normalize WHOOP data into DailyRow exactly as defined in CLAUDE.md (dated by the main sleep's wake morning).
- lib/whoop/client.ts: paginated GET (limit 25, follow next_token), every fetch with cache: 'no-store', retry with backoff on 429, otherwise fail with the status code.
- lib/whoop/normalize.ts: join non-nap sleep, recovery and cycle on cycle id; date from the sleep's end plus its timezone_offset; null for anything not SCORED; flag duplicate dates.
- /api/whoop/days?start=...&end=...: requires a session, export dynamic = 'force-dynamic', return DailyRow[] with Cache-Control: no-store. Nothing is written anywhere.
- A /debug page listing the rows in a table, returning 404 in production builds.
- Unit tests for normalize with small fixtures shaped like the WHOOP docs examples and made-up values: a bedtime after midnight, a timezone change, a nap, an unscored recovery, a missing sleep.
How far back to fetch comes from config.historyDaysToFetch; if it is null, ask me.
Do not call /api/whoop/days or open /debug yourself. I'll check them in my browser and tell you what I see.
```

**Check:** In your browser, `/debug` shows one row per morning. Spot-check five days against the WHOOP app (resting HR, HRV, recovery). Naps don't appear as days. A late bedtime doesn't create a duplicate date.

---

## Fill the config (before phases 3 and 4)

Open `src/config/analysis.ts` and `src/config/personas.ts` and set each value yourself. To have Claude Code explain a key without choosing, use the prompt at the end of this section.

**Analysis keys and options**

| Key | What it controls | Options to weigh |
| --- | --- | --- |
| `preDrugWindow` | Days before the first dose used for weekday means | All available history, or the last 8 or 12 weeks; longer is steadier, shorter reflects current habits |
| `minPreDrugWeeksPerWeekday` | Minimum observations per weekday | For example 4, 6 or 8 |
| `minCycles` | Cycles needed before the week view appears | For example 4, 6 or 8; an earlier review suggested at least 6 |
| `excludeWeeksAfterStart` | Weeks skipped right after the first dose | 0 keeps everything; more shows the steady state |
| `excludeWeeksAfterDoseStep` | Weeks skipped after each dose step | Same tradeoff |
| `dayZeroRule` | Which morning counts as d = 0 for morning vs evening injections | Morning dose: that day's recovery is pre-dose |
| `minDaysPerCycle` | Days with data for a cycle to count | Stricter is cleaner but loses cycles |
| `irregularCycleRule` | Cycles not 7 days long (weekday changes) | Drop them, or keep with d up to the actual length |
| `missedInjectionRule` | What a missed dose does to cycles | Drop the affected cycle, or extend it |
| `calibratingRule` | WHOOP calibration days | Exclude, or keep |
| `uncertaintyMethod` | Interval around P(d) | Bootstrap over cycles, or standard error over cycles |
| `clearPatternRule` | When the app says "clear pattern" | For example, an interval at some day excluding zero; consider how many days and metrics are tested |
| `metricsShown` | Metrics in the week view | Resting HR, HRV, recovery, sleep performance; optionally respiratory rate, skin temperature |
| `rollingWindowDays` | Long-view smoothing | For example 7, 14 or 28 |
| `historyDaysToFetch` | Days pulled from WHOOP | Must cover the pre-drug window plus the period since starting |

**Persona keys:** history length; first-dose date offset; injection weekday and time; persona A's planted within-week profile (mean-zero) per metric; long-run resting HR change (ground it in the label ranges and WHOOP's study); persona C's weekly habit (which night, which metrics, how big); noise level per metric; random seed; `testSeeds`; `placeboStartOffsetWeeks`; `maxFalsePatternRate`; `recoveryTolerance`.

```
List every key in src/config/analysis.ts and src/config/personas.ts that is still null. For each, explain in two or three sentences what it controls and the tradeoffs among the options in PROMPTS.md. Do not set any values.
```

---

## Phase 3: synthetic demo members

```
/plan Phase 3: scripts/generate-personas.ts, driven only by src/config/personas.ts (throw ConfigNotSetError for any null).
- Persona A: planted mean-zero within-week pattern after the first dose, plus the configured long-run resting HR change.
- Persona B: no drug effect at all.
- Persona C: a weekly habit (configured night and size) present both before and after the first dose, and no drug effect.
- Each persona: DailyRow[] plus member inputs (drug, first dose, injection weekday and time, missed or moved dates, dose steps). Seeded random generator so output is reproducible; support generating with other seeds for the tests.
- Write JSON to src/data/personas/. Write <persona>.csv and <persona>_inputs.json to notebook/data/synthetic/. Every file includes "synthetic": true or a synthetic column.
```

**Check:** `npm run personas` produces the files. Running it twice gives identical output.

---

## Phase 4: analysis engine

```
/plan Phase 4: implement lib/analysis per the "Analysis spec" in CLAUDE.md as pure functions with no React. Every function takes cfg: AnalysisConfig and uses requireConfig.
Write tests/analysis.test.ts with all five self-tests in CLAUDE.md (planted pattern, null, weekday trap, placebo date, config guard), using test parameters from src/config/personas.ts. Add unit tests for weekday means, centering, day-zero assignment for morning and evening injections, irregular cycles, missed injections and partial cycles.
Add scripts/export-engine-results.ts that writes persona A's weekday means, cycle counts and P(d) point estimates to notebook/data/synthetic/engine_results.json.
If a test fails because a config value seems wrong, show me the numbers and ask. Do not change the config yourself.
```

**Check:** `npm test` is green. Ask Claude Code to print persona C's raw and adjusted P(d) side by side: the habit shows up raw and disappears adjusted.

---

## Phase 5: screens

```
/plan Phase 5: build the screens in CLAUDE.md's layout with Tailwind and Recharts.
- Landing: one sentence, "Try the demo", "Connect your WHOOP (invite only)".
- Demo: choose persona A, B or C; "Synthetic member" badge on every screen in demo mode.
- Setup: member inputs form (live mode), saved to localStorage, read in useEffect.
- Week: d = 0 to 6 for each metric in config.metricsShown, point plus uncertainty band, cycle count, raw versus adjusted toggle, a note that the shape is relative to the member's own weekly average, and the plain-language summary from lib/analysis/summary.ts.
- Since: rolling level versus pre-drug baseline, dose steps marked; on resting HR only, a reference band for the label's trial-average change, captioned as such, with the citation.
- Method: the steps, the self-tests, the known limits, and sources.
- All text from src/copy/strings.ts. tests/copy.test.ts applies the banned regexes in CLAUDE.md to strings.ts and labelRanges.ts. Footer on every page.
- Friendly states for: not connected, no inputs yet, not enough pre-drug data, fewer than config.minCycles cycles.
Clean and readable on a laptop and a phone.
```

**Check:** In an incognito window, the demo works end to end with no sign-in. `npm test` is green, including the copy test. Persona C's toggle visibly removes the fake pattern on the habit's morning.

---

## Phase 6: SQL notebook

Before this phase, set up Python in the VS Code terminal:

```
python3 -m venv .venv
.venv/bin/pip install duckdb pandas matplotlib ipykernel nbstripout
.venv/bin/nbstripout --install
```

Then unzip your WHOOP data export into `notebook/data/export/` (gitignored), and select the `.venv` kernel in the notebook.

```
/plan Phase 6: notebook/analysis.ipynb with Python, DuckDB, pandas and matplotlib.
- Print only the header line of each CSV in notebook/data/export/ (for example with head -1) and ask me to confirm how the columns map to DailyRow fields. Do not read any data rows from my export and do not guess column names.
- Put the SQL in notebook/sql/*.sql: daily table, pre-drug weekday means, adjusted values, injection cycles and day-since-injection (from <persona>_inputs.json), within-cycle centering, and the profile.
- A params cell that mirrors src/config/analysis.ts; ask me if anything differs.
- Run it on the persona A, B and C CSVs.
- Cross-check persona A against notebook/data/synthetic/engine_results.json: weekday means, cycle counts and P(d) point estimates should match to rounding. Compare intervals only if the uncertainty method is deterministic.
- Write the cells that run on my own export with a placebo first-dose date as a parameter, but do not run them. I'll run them.
- A markdown cell at the top explaining the method in plain language.
```

**Check:** The cross-check table matches. You run the export cells yourself: your data with a placebo date shows no clear pattern. `git diff` shows no notebook outputs (nbstripout).

---

## Phase 7: deploy

```
/plan Phase 7: deploy to Vercel.
- Walk me through pushing this repo to a new private GitHub repo and importing it in Vercel (or using the Vercel CLI).
- List the environment variables to set in Vercel, with WHOOP_REDIRECT_URI set to the production callback URL.
- Remind me to add that production redirect URI in the WHOOP developer dashboard.
- Confirm /debug returns 404 in production and that WHOOP routes are dynamic with no-store.
```

**Check:** The production demo works in incognito on your phone. Sign-in works on production with your WHOOP account.

---

## Phase 8: polish

```
/plan Phase 8: polish for reviewers.
- README: what it does, the method, the self-tests, limits, how to run locally, and that demo data is synthetic.
- Check every page against the hard rules in CLAUDE.md and list any violations.
- Review the copy for clarity: a WHOOP product manager should understand each screen in ten seconds.
- Accessibility basics: color contrast, chart labels, keyboard navigation.
```

**Check:** Read the README cold. Watch someone unfamiliar use the demo for two minutes without help.

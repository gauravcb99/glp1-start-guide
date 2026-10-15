# GLP-1 Start Guide

GLP-1 Start Guide shows a WHOOP member how their resting heart rate, HRV, recovery and sleep performance move across each weekly semaglutide or tirzepatide injection, compared with their own usual week before they started. It calls a within-week pattern "clear" only when it passes a strict test, and says plainly when there is no clear pattern.

**Live demo (synthetic member, no WHOOP account needed):** https://glp1-start-guide-ten.vercel.app/?demo=a

The app has three screens:

- **Week** shows the average shape of an injection week, day 0 to day 6, with a raw vs adjusted toggle.
- **Since first dose** shows the long-run level compared with the member's pre-drug usual, with dose steps marked.
- **Method** explains the method, the self-test results and the limits.

The demo members are synthetic and are labeled as such on every screen.

## The method

These are the same steps as the Method page. The text is generated from `src/copy/strings.ts`.

<!-- method-steps:start -->
1. Your usual week: for each weekday, the average of your mornings in the weeks before your first dose.
2. Adjust: each morning minus your usual for that weekday, so a regular Monday dip doesn't look like an injection effect.
3. Line up injection weeks: day 0 is set by your injection time, and each week runs to the next injection. Weeks with a missed, moved or changed injection day are left out, as are weeks with too few mornings.
4. Center each week: subtract that week's own average, which removes slow drift such as weight change, dose level or season.
5. Average across weeks: the result for each day is the mean over your injection weeks, with a band from resampling whole weeks.
6. Clear or not: a day is called clear only if a stricter interval, which allows for the many days and metrics checked, excludes zero.
<!-- method-steps:end -->

Every value that changes results (pre-drug window, minimum weeks, day-0 rule, interval method and others) lives in `src/config/analysis.ts`. The analysis is also re-implemented in SQL in `notebook/analysis.ipynb`, and that version matches the TypeScript engine on synthetic member A to within 1e-14.

## Self-tests and detection limits

The analysis is checked on synthetic members whose answers are known in advance:

- **A** has a planted weekly pattern.
- **B** has no drug effect.
- **C** has a weekday habit and no drug effect.

The lines and the table below are generated from `src/data/methodResults.json`. `npm run method-results` produces that file with the app's own engine and config, so none of the numbers are typed by hand.

<!-- method-results:start -->
- **Pass:** Planted pattern: on Member A, the recovered shape is within 0.61 × the day-to-day noise of the planted one on its worst day (allowed: 1.0 ×).
- **Pass:** No effect: Member B showed a clear pattern in 1 of 100 simulated runs (allowed: up to 10%).
- **Pass:** Placebo date: Member B's data before starting, with a fake start date, showed a clear pattern in 1 of 100 runs (allowed: up to 10%).
- **Pass:** Weekday trap: Member C's weekly habit shows as clear on day 0 in the raw view, and disappears once adjusted.

**Smallest change this analysis can detect for one person.** Simulated on 2,000 runs of a member with no drug effect, about 30 injection weeks and 12 pre-drug weeks. A smaller change on a given day may be real but won't be called clear.

| Metric | Day-to-day noise | Detected about half the time | Detected 4 in 5 times |
| --- | --- | --- | --- |
| Resting heart rate | 3.0 bpm | 4.0 bpm | 4.8 bpm |
| HRV | 10.0 ms | 13.3 ms | 16.2 ms |
| Recovery | 12.0 points | 15.9 points | 19.3 points |
| Sleep performance | 8.0 points | 10.7 points | 13.0 points |
<!-- method-results:end -->

## Why this interval

The full comparison is in [docs/methods-intervals.md](docs/methods-intervals.md).

- **Why it's sensitive.** "Clear" is tested at a Bonferroni-corrected level, 1 − 0.05 / (7 days × 4 metrics) ≈ 99.82%, about 3.1 standard errors into the tail. At that depth, an interval that is only slightly too narrow produces many false alarms.
- **The first method was too narrow.** A percentile interval from a bootstrap over injection weeks and pre-drug weeks got the spread about right but had short tails with few weeks. Member B, who has no drug effect, showed a false clear pattern in 14 of 100 runs, and in 31 of 100 with a placebo start date. The limit is 10.
- **The chosen method.** The app builds a t interval from the bootstrap standard error, with degrees of freedom from the scarcer unit: min(injection weeks, pre-drug weeks) − 1. False clear patterns dropped to 1 in 100 in both cases.
- **The alternative.** Welch–Satterthwaite degrees of freedom reached the 10-in-100 limit at 8 injection weeks, and the app allows as few as 6.
- **The trade-off.** A false "clear pattern" is worse than a missed one for a health-facing tool, so the stricter interval was chosen. It costs some sensitivity.

## Placebo check on one real member

On the author's own WHOOP data with a pretend first-dose date (23 injection weeks), the adjusted view found no clear days. The raw view found 5: resting heart rate on days 0, 2 and 4, and HRV and recovery on day 4, all from the author's usual weekly routine. Over the same period, the Since start view showed resting heart rate well below its pre-start usual for months, a larger shift than the label's whole 1 to 4 bpm range, with no drug involved.

## Known limits

These are the limits listed on the Method page:

<!-- method-limits:start -->
- One person's data: a few dozen injection weeks can only reveal fairly large within-week changes (see the table above).
- This shows patterns that line up with your injection days. It cannot show what produced them.
- WHOOP's API has no medication data, so injection dates come from what you enter in Setup.
- Your usual week is learned from the weeks before your first dose. If your routine changed when you started, the comparison shifts too.
- The demo members are synthetic. Their patterns were planted to test the method, not taken from real people.
<!-- method-limits:end -->

One more limit applies to real WHOOP connections: **two open tabs can disconnect the member.**

- **The setup.** WHOOP access tokens last about an hour. The server refreshes a token when it is within 5 minutes of expiry, at most once per request (`src/lib/session.ts`). Refreshing invalidates the old refresh token, so the server saves the new one in the encrypted session cookie.
- **Within one tab, it's handled.** Requests to WHOOP-backed routes run one at a time (`src/lib/whoop/browserQueue.ts`), so each request carries the cookie the previous response saved.
- **Across tabs, it isn't.** If two tabs send a request in the same refresh window, both can present the same refresh token. The second refresh then uses a token that's already been replaced.
- **What happens next.** If WHOOP rejects it with 400 or 401, the route clears the session cookie, which disconnects the member in every tab, and they have to connect again. Other failures return 502 and keep the session.

## Run locally

Requirements: Node.js and npm. For the notebook, you also need Python 3.

```bash
npm install
npm run dev        # https://localhost:3000 (self-signed certificate)
npm test           # vitest, including the copy wording guard and the README check
npm run lint
```

The demo (`/demo`, or any page with `?demo=a`, `b` or `c`) needs no environment variables and no WHOOP account. All demo data is synthetic: it's generated by `npm run personas` and marked `"synthetic": true`.

To connect a real WHOOP account, create `.env.local` (see `.env.local.example`) with these variables:

- `WHOOP_CLIENT_ID`
- `WHOOP_CLIENT_SECRET`
- `WHOOP_REDIRECT_URI`
- `SESSION_SECRET` (32 or more random characters)

To regenerate the published results, run these:

- `npm run method-results`: self-tests and the detection table.
- `npm run readme`: fills the generated blocks in this README.
- `npm run export-results`: engine output for the notebook cross-check.

## Privacy

**WHOOP data is never stored.** There is no database, file or server cache. Every request to WHOOP uses `cache: 'no-store'`, and every route that touches WHOOP responds with `Cache-Control: no-store`. The browser keeps fetched rows in memory only for the session, and they are gone on reload. This follows WHOOP's API terms, which forbid databases or permanent copies of WHOOP data.

**No AI services.** The app never sends member data to any AI or language-model service. Server logs record endpoint names and status codes only, never response bodies or tokens.

**What the browser saves:**

- **Setup details, in localStorage.** These are the injection details the member enters in Setup: medication, first dose date, injection day and any changes to it, missed or moved injection dates, usual injection time, and dose steps. They never leave the browser, and Setup has a button to clear them.
- **A session cookie.** It's encrypted and httpOnly, and it holds the WHOOP access and refresh tokens. The WHOOP client secret stays on the server.
- **A short-lived login cookie.** It holds the `state` value used to verify the WHOOP login callback.

The app is for general wellness and education, and it isn't medical advice.

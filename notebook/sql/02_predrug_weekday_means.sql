-- Step 1: pre-drug mean per metric and weekday (0 = Sunday, as getUTCDay()).
-- usable applies calibratingRule and keeps the metrics shown.
CREATE OR REPLACE TABLE usable AS
SELECT *
FROM daily
WHERE list_contains($metrics, metric)
  AND NOT (calibrating AND $calibrating_rule = 'exclude');

-- Window start: lastWeeks counts whole weeks back from the first dose; "all" rounds the
-- available pre-drug span up to whole weeks, as weekday.ts does.
CREATE OR REPLACE TABLE predrug_window AS
SELECT
    CAST($first_dose AS DATE) - 7 * CAST(
        CASE
            WHEN $window_kind = 'lastWeeks' THEN $window_weeks
            ELSE coalesce(ceil(datediff('day', min(date), CAST($first_dose AS DATE)) / 7), 0)
        END AS INTEGER) AS window_start
FROM usable
WHERE date < CAST($first_dose AS DATE);

CREATE OR REPLACE TABLE predrug_means AS
WITH vals AS (
    SELECT u.metric, dayofweek(u.date) AS weekday, u.value
    FROM usable u, predrug_window w
    WHERE u.date >= w.window_start
      AND u.date < CAST($first_dose AS DATE)
      AND u.value IS NOT NULL
),
grid AS (
    SELECT m.metric, r.range AS weekday
    FROM (SELECT DISTINCT metric FROM usable) m, range(7) r
)
SELECT g.metric, g.weekday, avg(v.value) AS mean, count(v.value) AS n
FROM grid g
LEFT JOIN vals v ON v.metric = g.metric AND v.weekday = g.weekday
GROUP BY ALL;

CREATE OR REPLACE TABLE predrug_status AS
SELECT metric, min(n) >= $min_per_weekday AS ok
FROM predrug_means
GROUP BY metric;

-- Step 3: injection dates, cycles and day-since-injection, mirroring cycles.ts.
-- Inputs come from tables the notebook registers: inj_segments(from_date, weekday),
-- inj_missed(date), inj_moved(scheduled, actual), dose_steps(date, mg).

-- Scheduled dates through the last usable date (null days count, as in the engine).
CREATE OR REPLACE TABLE injections AS
WITH through AS (
    SELECT coalesce(max(date), CAST($first_dose AS DATE)) AS through_date FROM usable
),
seg AS (
    SELECT
        greatest(from_date, CAST($first_dose AS DATE)) AS seg_start,
        weekday,
        lead(from_date) OVER (ORDER BY from_date) AS seg_end
    FROM inj_segments
),
scheduled AS (
    SELECT CAST(g.generate_series AS DATE) AS date
    FROM seg, through,
        generate_series(CAST(seg.seg_start AS TIMESTAMP), CAST(through.through_date AS TIMESTAMP), INTERVAL 1 DAY) g
    WHERE dayofweek(g.generate_series) = seg.weekday
      AND (seg.seg_end IS NULL OR CAST(g.generate_series AS DATE) < seg.seg_end)
),
dates AS (
    SELECT DISTINCT coalesce(mv.actual, s.date) AS date
    FROM scheduled s
    LEFT JOIN inj_moved mv ON mv.scheduled = s.date
    WHERE s.date NOT IN (SELECT date FROM inj_missed)
)
SELECT d.date AS injection_date, lead(d.date) OVER (ORDER BY d.date) AS next_date
FROM dates d, through t
WHERE d.date <= t.through_date;

-- One row per injection. The last cycle is nominally 7 days.
-- Drop reasons are checked in the engine's order: missed injection, irregular length, exclusion window.
CREATE OR REPLACE TABLE cycles AS
WITH c AS (
    SELECT injection_date, coalesce(next_date, injection_date + 7) AS next_date
    FROM injections
)
SELECT
    injection_date,
    next_date,
    injection_date + CAST($day_zero_offset AS INTEGER) AS day_zero,
    CASE
        WHEN EXISTS (SELECT 1 FROM inj_missed m WHERE m.date > c.injection_date AND m.date < c.next_date)
            THEN 'missedInjection'
        WHEN datediff('day', injection_date, next_date) <> 7
            THEN 'irregular'
        WHEN datediff('day', CAST($first_dose AS DATE), injection_date) BETWEEN 0 AND 7 * $exclude_after_start - 1
            OR EXISTS (
                SELECT 1 FROM dose_steps s
                WHERE datediff('day', s.date, c.injection_date) BETWEEN 0 AND 7 * $exclude_after_step - 1
            )
            THEN 'excluded'
    END AS drop_reason
FROM c;

-- Days with a value in each kept cycle, per metric; cycles with too few days are dropped.
CREATE OR REPLACE TABLE cycle_days AS
WITH days AS (
    SELECT c.injection_date, r.range AS d, c.day_zero + CAST(r.range AS INTEGER) AS date
    FROM cycles c, range(7) r
    WHERE c.drop_reason IS NULL
)
SELECT a.metric, days.injection_date, days.d, days.date, dayofweek(days.date) AS weekday, a.a
FROM days
JOIN adjusted a ON a.date = days.date
WHERE a.a IS NOT NULL
QUALIFY count(*) OVER (PARTITION BY a.metric, days.injection_date) >= $min_days;

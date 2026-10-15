-- Step 2: a_t = x_t - pre-drug mean for that weekday. The raw view (step 8) keeps x_t.
-- The adjusted view needs an ok baseline for the metric; otherwise the metric has no rows.
CREATE OR REPLACE TABLE adjusted AS
SELECT
    u.date,
    u.metric,
    u.value AS x,
    CASE WHEN $view = 'raw' THEN u.value ELSE u.value - m.mean END AS a
FROM usable u
JOIN predrug_means m ON m.metric = u.metric AND m.weekday = dayofweek(u.date)
JOIN predrug_status s ON s.metric = u.metric
WHERE $view = 'raw' OR s.ok;

-- Step 4: s_t = a_t - mean of a over the same cycle (per metric).
CREATE OR REPLACE TABLE centered AS
SELECT *, a - avg(a) OVER (PARTITION BY metric, injection_date) AS s
FROM cycle_days;

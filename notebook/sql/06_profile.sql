-- Step 5 (point estimates only): P(d) = mean of s over cycles with that d.
-- Intervals and the clear-pattern rule need the bootstrap and stay in the engine.
CREATE OR REPLACE TABLE profile AS
WITH grid AS (
    SELECT m.metric, r.range AS d
    FROM (SELECT DISTINCT metric FROM usable) m, range(7) r
)
SELECT g.metric, g.d, avg(c.s) AS estimate, count(c.s) AS n_cycles_at_d
FROM grid g
LEFT JOIN centered c ON c.metric = g.metric AND c.d = g.d
GROUP BY ALL;

CREATE OR REPLACE TABLE profile_status AS
WITH n AS (
    SELECT m.metric, count(DISTINCT c.injection_date) AS cycles
    FROM (SELECT DISTINCT metric FROM usable) m
    LEFT JOIN centered c ON c.metric = m.metric
    GROUP BY m.metric
)
SELECT
    n.metric,
    n.cycles,
    CASE
        WHEN $view = 'adjusted' AND NOT s.ok THEN 'notEnoughPreDrugData'
        WHEN n.cycles < $min_cycles THEN 'notEnoughCycles'
        ELSE 'ok'
    END AS status
FROM n
JOIN predrug_status s ON s.metric = n.metric;

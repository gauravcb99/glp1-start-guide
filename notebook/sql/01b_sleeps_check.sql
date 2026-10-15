-- Cross-check the cycles file's main sleep against sleeps.csv rows with Nap = false. Counts only.
CREATE OR REPLACE TABLE sleeps_check AS
WITH main_sleeps AS (
    SELECT "Cycle start time" AS cycle_id, CAST("Wake onset" AS TIMESTAMP) AS wake
    FROM read_csv($sleeps_path, header = true, all_varchar = true)
    WHERE "Nap" = 'false'
),
per_cycle AS (
    SELECT
        c.cycle_id,
        c.wake AS cycles_wake,
        count(s.cycle_id) AS main_sleeps,
        bool_or(s.wake = c.wake) AS wake_matches
    FROM export_cycles c
    LEFT JOIN main_sleeps s ON s.cycle_id = c.cycle_id
    WHERE c.wake IS NOT NULL
    GROUP BY ALL
)
SELECT
    count(*) FILTER (WHERE main_sleeps = 0) AS cycles_with_no_main_sleep,
    count(*) FILTER (WHERE main_sleeps > 1) AS cycles_with_several_main_sleeps,
    count(*) FILTER (WHERE main_sleeps >= 1 AND NOT wake_matches) AS cycles_with_wake_mismatch,
    (SELECT count(*) FROM main_sleeps WHERE cycle_id NOT IN (SELECT cycle_id FROM export_cycles)) AS main_sleeps_without_cycle
FROM per_cycle;

-- Step 0 (synthetic): a persona CSV as one long table, one row per (wake date, metric).
-- Null values are kept so the last data date matches the engine's (it counts null days too).
CREATE OR REPLACE TABLE daily AS
SELECT date, cycle_id, calibrating, metric, value
FROM (
    SELECT
        CAST(date AS DATE) AS date,
        cycleId AS cycle_id,
        CAST(calibrating AS BOOLEAN) AS calibrating,
        CAST(restingHr AS DOUBLE) AS restingHr,
        CAST(hrvMs AS DOUBLE) AS hrvMs,
        CAST(recovery AS DOUBLE) AS recovery,
        CAST(sleepPerformance AS DOUBLE) AS sleepPerformance,
        CAST(respiratoryRate AS DOUBLE) AS respiratoryRate,
        CAST(skinTempC AS DOUBLE) AS skinTempC,
        CAST(strain AS DOUBLE) AS strain
    FROM read_csv($path, header = true, all_varchar = true)
)
UNPIVOT INCLUDE NULLS (
    value FOR metric IN (restingHr, hrvMs, recovery, sleepPerformance, respiratoryRate, skinTempC, strain)
);

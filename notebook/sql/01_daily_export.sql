-- Step 0 (Gaurav's WHOOP export): physiological_cycles.csv to the same long daily table.
-- Mapping confirmed by Gaurav 2026-10-14. "Wake onset" is read as local clock time
-- (see the notebook for the evidence); export_checks confirms the date would be the same if it were UTC.
CREATE OR REPLACE TABLE export_cycles AS
SELECT
    "Cycle start time" AS cycle_id,
    CAST("Wake onset" AS TIMESTAMP) AS wake,
    "Cycle timezone" AS tz,
    "Cycle end time" AS cycle_end,
    CAST("Resting heart rate (bpm)" AS DOUBLE) AS restingHr,
    CAST("Heart rate variability (ms)" AS DOUBLE) AS hrvMs,
    CAST("Recovery score %" AS DOUBLE) AS recovery,
    CAST("Sleep performance %" AS DOUBLE) AS sleepPerformance,
    CAST("Respiratory rate (rpm)" AS DOUBLE) AS respiratoryRate,
    CAST("Skin temp (celsius)" AS DOUBLE) AS skinTempC,
    CAST("Day Strain" AS DOUBLE) AS strain
FROM read_csv($cycles_path, header = true, all_varchar = true);

-- Minutes east of UTC from "UTC-04:00"; any other format stops the run.
CREATE OR REPLACE TABLE export_checks AS
WITH parsed AS (
    SELECT
        wake,
        CASE
            WHEN regexp_full_match(tz, 'UTC[+-][0-9]{2}:[0-9]{2}') THEN
                (CASE WHEN substr(tz, 4, 1) = '-' THEN -1 ELSE 1 END)
                * (CAST(substr(tz, 5, 2) AS INTEGER) * 60 + CAST(substr(tz, 8, 2) AS INTEGER))
            ELSE error('Unrecognised Cycle timezone format')
        END AS offset_min
    FROM export_cycles
    WHERE wake IS NOT NULL
)
SELECT
    (SELECT count(*) FROM export_cycles) AS cycles_in_file,
    (SELECT count(*) FROM export_cycles WHERE wake IS NULL) AS cycles_without_wake,
    count(*) FILTER (
        WHERE CAST(wake AS DATE) <> CAST(wake + to_minutes(offset_min) AS DATE)
    ) AS dates_that_differ_if_utc
FROM parsed;

-- Strain is null while the cycle is still in progress (no end time), as in normalize.ts.
CREATE OR REPLACE TABLE daily AS
SELECT date, cycle_id, calibrating, metric, value
FROM (
    SELECT
        CAST(wake AS DATE) AS date,
        cycle_id,
        CAST(wake AS DATE) BETWEEN CAST($calibrating_from AS DATE) AND CAST($calibrating_to AS DATE) AS calibrating,
        restingHr,
        hrvMs,
        recovery,
        sleepPerformance,
        respiratoryRate,
        skinTempC,
        CASE WHEN cycle_end IS NULL THEN NULL ELSE strain END AS strain
    FROM export_cycles
    WHERE wake IS NOT NULL
)
UNPIVOT INCLUDE NULLS (
    value FOR metric IN (restingHr, hrvMs, recovery, sleepPerformance, respiratoryRate, skinTempC, strain)
);

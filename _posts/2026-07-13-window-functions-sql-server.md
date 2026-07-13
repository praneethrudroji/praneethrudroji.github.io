---
title: Window Functions in SQL Server - From ROW_NUMBER to Frames Without the Confusion
description: ROW_NUMBER dedup, running totals, LAG/LEAD, gaps and islands, and the ROWS vs RANGE trap - window functions in SQL Server without the confusion.
date: 2026-07-13 11:00 +0530
categories: [backend, sql]
tags: [sql, sql server, window functions, tsql, performance, queries]
---

## Aggregate-like power without collapsing the rows

`GROUP BY` answers "what's the total per customer?" by *collapsing* rows - you get one row per customer and lose the detail. The questions it can't answer cleanly are the ones that need **both** the detail rows *and* something computed across their neighbors: "each order, alongside that customer's running total," "the latest row per device," "how does this month compare to last month." Window functions compute over a set of related rows (**the window**) while every input row survives to the output. Once the OVER clause clicks, a whole family of gnarly self-join queries becomes one readable statement.

## The OVER clause: three parts, each optional

```sql
function() OVER (
    PARTITION BY <restart the calculation per group>
    ORDER BY     <ordering within the partition>
    ROWS/RANGE   <frame: which neighbors to include>
)
```

- **PARTITION BY** is "GROUP BY without collapsing" - the function computes independently per partition.
- **ORDER BY** gives the window a sequence - required for ranking and offset functions, and it's what turns an aggregate into a *running* aggregate.
- **The frame** narrows the window further relative to the current row ("the preceding 6 rows," "everything so far"). Only aggregates and FIRST_VALUE/LAST_VALUE use frames; this is also where the one genuinely nasty default hides (below).

## Ranking: and the killer app, dedup-keep-latest

`ROW_NUMBER` (unique sequence), `RANK` (ties share a rank, gaps follow), `DENSE_RANK` (ties share, no gaps), `NTILE(n)` (buckets). The pattern you'll use for the rest of your career - **newest row per key**:

```sql
WITH Ranked AS (
    SELECT d.*,
           ROW_NUMBER() OVER (PARTITION BY DeviceId
                              ORDER BY ReadingAt DESC, ReadingId DESC) AS rn
    FROM dbo.DeviceReadings d
)
SELECT * FROM Ranked WHERE rn = 1;
```

Latest reading per device, latest status per order, current address per customer - all this one shape. Notes that separate the pros:

- **Deterministic tiebreaker** in the ORDER BY (`ReadingId DESC`), same determinism discipline as keyset pagination - without it, ties pick arbitrarily and results differ between runs.
- The window function must live in a CTE/derived table because **you can't put it in WHERE** (logical processing order: window functions evaluate with SELECT, after WHERE).
- The same pattern with `WHERE rn > 1` feeding a DELETE is the standard **duplicate-row cleanup** - dedup a table in one statement, choosing exactly which copy survives.

`RANK` vs `ROW_NUMBER` matters exactly when ties are real: "top 3 salaries per department" with RANK returns 4 people if two tie for third - usually what the business meant.

## Running and windowed aggregates

Any aggregate becomes windowed:

```sql
SELECT OrderId, CustomerId, OrderDate, TotalAmount,
       SUM(TotalAmount) OVER (PARTITION BY CustomerId ORDER BY OrderDate, OrderId
                              ROWS UNBOUNDED PRECEDING)              AS running_total,
       SUM(TotalAmount) OVER (PARTITION BY CustomerId)               AS customer_total,
       TotalAmount * 100.0
         / SUM(TotalAmount) OVER (PARTITION BY CustomerId)           AS pct_of_customer
FROM dbo.Orders;
```

Three windows, one pass over the data, detail preserved - the `pct_of_total` line alone replaces a join back to a grouped subquery that every reporting codebase accumulates. Moving averages are just a bounded frame:

```sql
AVG(TotalAmount) OVER (PARTITION BY CustomerId ORDER BY OrderDate
                       ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)   -- 7-row moving avg
```

### The ROWS vs RANGE trap (read this twice)

When you write `ORDER BY ... ` in a window and *omit* the frame, the default is **`RANGE UNBOUNDED PRECEDING`** - not ROWS. Two problems:

1. **Correctness**: RANGE defines the frame by *value*, so all rows tied on the ORDER BY value are included together. A running total over dates with duplicate dates gives every same-date row the *same* subtotal - the "running total that jumps in steps" bug that looks like corrupted data.
2. **Performance**: RANGE frames can't use the optimized in-memory window spool - they spill to a tempdb worktable. The exact same query with `ROWS` is routinely several times faster.

Habit: **for any ordered window aggregate, write the ROWS frame explicitly.** `ROWS UNBOUNDED PRECEDING` for running totals, bounded ROWS for moving windows. Reserve RANGE for the rare case where by-value framing is genuinely the requirement.

Related landmine: `LAST_VALUE(...) OVER (ORDER BY ...)` with the default frame ends at CURRENT ROW - so "last value" returns *the current row's value*, mystifying everyone who tries it. You want `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING` - or usually, just use `MAX`/`FIRST_VALUE` with reversed order.

## LAG/LEAD: comparing a row to its neighbors

Offset functions read other rows in the partition without self-joins:

```sql
SELECT MonthStart, Revenue,
       LAG(Revenue, 1)  OVER (ORDER BY MonthStart)                    AS prev_month,
       Revenue - LAG(Revenue, 1, 0) OVER (ORDER BY MonthStart)        AS mom_change,
       (Revenue - LAG(Revenue) OVER (ORDER BY MonthStart)) * 100.0
         / NULLIF(LAG(Revenue) OVER (ORDER BY MonthStart), 0)         AS mom_pct
FROM dbo.MonthlyRevenue;
```

The third argument is the default for edge rows (`LAG(Revenue, 1, 0)`), sparing the ISNULL wrapping. Month-over-month, time-between-events (`DATEDIFF(MINUTE, LAG(EventAt) OVER (...), EventAt)`), detecting value changes - all one function.

And LAG unlocks the classic interview-hard problem, **gaps and islands** - collapsing consecutive runs (sessions from clickstream, streaks, continuous sensor states) into ranges:

```sql
WITH Flagged AS (
    SELECT *, CASE WHEN Status = LAG(Status) OVER (PARTITION BY DeviceId ORDER BY ReadingAt)
                   THEN 0 ELSE 1 END AS is_start
    FROM dbo.DeviceReadings
),
Grouped AS (
    SELECT *, SUM(is_start) OVER (PARTITION BY DeviceId ORDER BY ReadingAt
                                  ROWS UNBOUNDED PRECEDING) AS island_id
    FROM Flagged
)
SELECT DeviceId, Status, island_id,
       MIN(ReadingAt) AS started, MAX(ReadingAt) AS ended, COUNT(*) AS readings
FROM Grouped
GROUP BY DeviceId, Status, island_id;
```

Flag where runs start (LAG), running-sum the flags into island numbers (windowed SUM), group. Three moves, memorize them - the pattern transfers to dozens of "consecutive anything" problems.

## Performance: windows want order

The plan cost of window functions is dominated by one thing: obtaining rows **sorted by `PARTITION BY` columns, then `ORDER BY` columns**. If no index provides that order, you get a Sort operator - and large sorts spill to tempdb (watch for spill warnings in the plan). The supporting-index recipe is the **POC pattern** - key on **P**artition then **O**rder columns, INCLUDE the **C**overed payload:

```sql
-- For: ROW_NUMBER() OVER (PARTITION BY DeviceId ORDER BY ReadingAt DESC) ... SELECT Status, Value
CREATE INDEX IX_Readings_POC ON dbo.DeviceReadings (DeviceId, ReadingAt DESC)
    INCLUDE (Status, Value);
```

With the POC index the plan streams: seek/scan in order → Segment → windowed compute, no Sort at all - covering-index economics applied to windows. Further notes: multiple window functions **sharing the same PARTITION BY/ORDER BY** are computed together (one sort), while each *distinct* window spec can add its own sort - align your windows when you can. Batch mode on columnstore executes window aggregates dramatically faster on analytic volumes - window-heavy reporting is one of the best arguments for a columnstore on the reporting copy.

For top-N-per-group specifically, at high row counts also consider `CROSS APPLY (SELECT TOP 1 ... ORDER BY ...)` - with the right index it can beat ROW_NUMBER by seeking per group instead of numbering everything. Test both; the winner depends on group count vs rows per group.

## Takeaways

- Windows = aggregate-like computation with rows preserved; PARTITION restarts it, ORDER sequences it, the frame bounds it.
- ROW_NUMBER-then-filter is the latest-per-key and dedup workhorse; always add a deterministic tiebreaker.
- Write ROWS frames explicitly - the RANGE default is a correctness *and* performance trap, and LAST_VALUE's default frame is a lie.
- LAG + running SUM = gaps and islands; POC indexes make windows stream instead of sort.

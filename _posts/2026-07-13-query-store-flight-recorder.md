---
title: Query Store - The Flight Recorder That Answers "What Changed?"
date: 2026-07-13 09:00 +0530
categories: [backend, sql]
tags: [sql, sql server, query store, performance, execution plans, plan forcing]
---

## The question performance tools couldn't answer

"The app got slow yesterday around 3 PM. Nothing was deployed. What happened?"

Before Query Store, honestly answering that required luck: the plan cache only shows *current* plans (and forgets everything on restart or memory pressure), so the plan that was running fine Tuesday is simply gone by the time you investigate Thursday. Query Store fixes this by persisting query texts, plans, and runtime statistics **into the user database itself** - a flight recorder that survives restarts, failovers, and plan cache flushes. If the execution plans post taught you to read a plan and the parameter sniffing post taught you why plans go bad, Query Store is how you catch it happening in your actual production history.

## Turning it on properly

On by default for new databases since SQL Server 2022 (and always-on in Azure SQL). For older instances:

```sql
ALTER DATABASE MyDb SET QUERY_STORE = ON (
    OPERATION_MODE = READ_WRITE,
    QUERY_CAPTURE_MODE = AUTO,          -- skip trivial/ad-hoc noise (default in 2019+)
    MAX_STORAGE_SIZE_MB = 1024,
    STALE_QUERY_THRESHOLD_DAYS = 30,
    INTERVAL_LENGTH_MINUTES = 60,       -- stats aggregation granularity
    SIZE_BASED_CLEANUP_MODE = AUTO
);
```

The settings that actually matter:

- **QUERY_CAPTURE_MODE = AUTO**, not ALL - ALL on an ad-hoc-heavy workload floods the store with single-use queries until it fills, flips to READ_ONLY, and silently stops recording. AUTO captures queries with meaningful frequency/cost.
- **MAX_STORAGE_SIZE_MB** sized generously (1-2 GB is cheap insurance on a serious database). When full → READ_ONLY → your flight recorder is off exactly when you need it. Monitor `sys.database_query_store_options` for `actual_state_desc` vs `desired_state_desc` drift.
- **INTERVAL_LENGTH_MINUTES** is your time resolution: 60 for general use; 15 while actively hunting a problem window.

## The core mental model: queries have many plans over time

Query Store's schema is three ideas: a **query** (normalized text) can have multiple **plans** over its life, and each plan has **runtime stats** (duration, CPU, reads, executions) per time interval. Nearly everything useful is a question over that model:

```sql
-- Which queries regressed: compare avg duration across two windows
SELECT q.query_id,
       qt.query_sql_text,
       p.plan_id,
       rs.avg_duration / 1000.0 AS avg_ms,
       rs.count_executions,
       rsi.start_time
FROM sys.query_store_query q
JOIN sys.query_store_query_text qt ON qt.query_text_id = q.query_text_id
JOIN sys.query_store_plan p ON p.query_id = q.query_id
JOIN sys.query_store_runtime_stats rs ON rs.plan_id = p.plan_id
JOIN sys.query_store_runtime_stats_interval rsi
     ON rsi.runtime_stats_interval_id = rs.runtime_stats_interval_id
WHERE rsi.start_time > DATEADD(DAY, -2, SYSUTCDATETIME())
ORDER BY rs.avg_duration DESC;
```

In practice you'll live in the SSMS reports under the database's **Query Store** folder: *Regressed Queries* (the "what changed" report - queries whose recent performance degraded vs history), *Top Resource Consuming Queries*, and *Queries With Forced Plans*. Each shows the plan timeline: dots per plan per interval, so a query that flipped from a good plan to a bad one displays as two colored bands with an obvious break - usually at exactly 3 PM yesterday.

## Diagnosing the classic incident: plan regression

The plan-flip story almost always reads the same way: statistics update or plan-cache eviction triggers a recompile; the recompile happens to sniff an unrepresentative parameter (parameter sniffing post); the new plan is terrible for the common case. Query Store shows both plans side by side with their per-plan stats - the old plan averaging 40ms across 2M executions, the new one averaging 9 seconds across 50k. You can open each plan's XML right from the store and diff the shapes (seek+loop vs scan+hash, the usual suspects).

At that point you have two roads:

**Road 1 - fix the cause**: everything from the sniffing post applies (RECOMPILE, OPTIMIZE FOR, index changes, rewriting the predicate). Correct, durable, requires a code/index change and a deploy.

**Road 2 - force the good plan, right now:**

```sql
EXEC sp_query_store_force_plan @query_id = 4123, @plan_id = 217;
-- later, to release:
EXEC sp_query_store_unforce_plan @query_id = 4123, @plan_id = 217;
```

Forcing pins the optimizer to the chosen plan for that query. It's the correct **incident response**: sub-minute mitigation, no deploy, reversible. It is the wrong **permanent state**, for three reasons: the forced plan can go stale as data grows (the plan that's right today is the scan you're preventing next year); forcing fails silently if the schema changes underneath it (dropped index → `last_force_failure_reason` in `sys.query_store_plan`, query silently reverts to optimizer choice); and every forced plan is an undocumented behavioral override the next engineer won't know exists. Treat the *Queries With Forced Plans* report as a to-do list of unfixed root causes, and review it monthly.

SQL Server 2022's **CE feedback / plan correction** features automate a version of this - `AUTOMATIC_TUNING (FORCE_LAST_GOOD_PLAN = ON)` detects regressions and force-reverts automatically, then *un*-forces if it doesn't help. Genuinely useful, with the same caveat: it's mitigation on autopilot, not root-cause repair.

## The features people miss

**Wait statistics per query** (2017+): `sys.query_store_wait_stats` categorizes what each plan *waited on* (CPU, lock, latch, network, memory) per interval. This closes the classic gap - server-wide wait stats tell you the instance waited on locks; Query Store tells you *which query* did. A query whose duration regressed but whose CPU didn't, with lock waits climbing, points at blocking (locking post), not at the plan.

**Query Store hints** (2022+): apply a hint *without touching code* - the vendor-app scenario:

```sql
EXEC sys.sp_query_store_set_hints @query_id = 4123,
     @query_hints = N'OPTION (RECOMPILE)';
```

This is how you apply the parameter-sniffing fixes to a query you can't edit - cleaner and more targeted than plan guides ever were.

**A/B measurement for your own tuning**: because stats are bucketed by interval, "deploy index Tuesday 14:00, compare the query's avg reads before/after" is a simple query rather than a guess. Query Store turns index tuning (covering-indexes post) from faith into measurement.

**Compatibility-level upgrades**: the canonical safe upgrade dance - turn on Query Store, run at the old compat level for a couple of representative weeks, flip compat level, run the Regressed Queries report, force old plans for the few regressions while you fix them properly. This is the officially recommended path for major version/CE upgrades and it works.

## Operational hygiene

- Watch state: `SELECT actual_state_desc, current_storage_size_mb, max_storage_size_mb FROM sys.database_query_store_options;` - alert on READ_ONLY.
- The store adds small write overhead (usually negligible; capture mode AUTO keeps it that way). If you ever must, `OPERATION_MODE = READ_ONLY` keeps history queryable while pausing collection.
- Cleanup is automatic (stale threshold + size-based), but forced plans are exempt from cleanup - another reason to keep the forced list short.
- Query Store data lives in the database → it's in your backups → your performance history participates in restores. Handy for post-incident forensics on a restored copy.

## Takeaways

- Query Store persists plans + stats + waits over time in the database, answering "what changed and when" with data instead of archaeology.
- The Regressed Queries report plus per-plan timelines makes plan flips (usually parameter sniffing) visually obvious.
- Plan forcing is a superb painkiller and a poor cure - force to stop the bleeding, then fix the cause and unforce; audit the forced list.
- Per-query wait stats and Query Store hints solve problems (blocking attribution, unhintable vendor code) nothing else solves cleanly.

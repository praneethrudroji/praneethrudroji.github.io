---
layout: post
title: Change Data Capture in SQL Server - How It Works and When to Use It
date: 2026-07-11 10:00 +0530
categories: [backend, sql]
tags: [cdc, sql server, data engineering, etl, change data capture]
---

## The problem CDC solves

You need to know when rows in a table change - not just the current state, but the fact that an update happened, what changed, and in what order - so a downstream system (a data warehouse, a search index, a cache, another service) can react to it. The naive answers all have real costs: polling with a `LastModified` column misses deletes and can't tell you what actually changed; triggers add write-path latency and are easy to forget when someone alters the schema; application-level event publishing means every write path in every service has to remember to publish, and eventually one won't.

Change Data Capture (CDC) in SQL Server takes a different approach: it reads the transaction log directly. Every insert, update, and delete is already recorded there for durability and replication purposes; CDC just exposes that stream as queryable change tables, without touching your write path at all.

## How it actually works

CDC has two moving pieces, both driven by SQL Server Agent jobs:

- **Capture job** - reads the transaction log asynchronously and writes matching changes into a system-generated change table (named `cdc.<schema>_<table>_CT`).
- **Cleanup job** - deletes change table rows older than the configured retention period (three days, by default) so the change tables don't grow forever.

Because the capture job reads the log rather than intercepting the write, there's no synchronous overhead added to the transaction that made the change - the cost shows up later, asynchronously, as log-reader activity. That's the core tradeoff versus a trigger: no write-path latency, but the change data isn't available *instantly* - there's a small lag while the capture job catches up to the log.

## Enabling it

CDC needs to be turned on at the database level first, then per table:

```sql
USE SalesDb;
EXEC sys.sp_cdc_enable_db;

EXEC sys.sp_cdc_enable_table
    @source_schema = N'dbo',
    @source_name   = N'Orders',
    @role_name      = NULL,          -- NULL means no extra gating role
    @capture_instance = N'dbo_Orders',
    @supports_net_changes = 1;       -- enables the "net changes" functions below
```

This creates the change table, a capture instance, and the Agent jobs. Note the Agent dependency: CDC does nothing on an instance where SQL Server Agent isn't running, which trips people up in dev environments where Agent is often disabled, and matters on Azure SQL Database specifically, where CDC exists but is managed differently (no user-visible Agent jobs - Azure automates the equivalent).

## Reading the changes

Two function families cover most use cases. `cdc.fn_cdc_get_all_changes_<capture_instance>` returns every individual change (every update as its own row, in log order) between two log sequence numbers (LSNs):

```sql
DECLARE @from_lsn BINARY(10) = sys.fn_cdc_get_min_lsn('dbo_Orders');
DECLARE @to_lsn   BINARY(10) = sys.fn_cdc_get_max_lsn();

SELECT __$operation, __$update_mask, *
FROM cdc.fn_cdc_get_all_changes_dbo_Orders(@from_lsn, @to_lsn, 'all');
```

`__$operation` tells you what happened: `1` = delete, `2` = insert, `3` = update (before image), `4` = update (after image). For updates you get both the before and after row, which triggers-based approaches often don't give you cleanly.

`cdc.fn_cdc_get_net_changes_<capture_instance>` collapses multiple changes to the same row within the LSN range into a single net result - useful when a downstream sync job only cares about the latest state, not every intermediate update. It requires `@supports_net_changes = 1` at setup time and a primary key (or unique index) on the source table.

## A practical sync pattern

A common consumer pattern: a job runs on a schedule, stores the last processed LSN somewhere durable (a small tracking table, not in memory), and pulls only what's new each run:

```sql
CREATE TABLE CdcSyncState (
    CaptureInstance VARCHAR(100) PRIMARY KEY,
    LastLsn         BINARY(10) NOT NULL
);

-- each run:
DECLARE @from_lsn BINARY(10) =
    (SELECT LastLsn FROM CdcSyncState WHERE CaptureInstance = 'dbo_Orders');
DECLARE @to_lsn BINARY(10) = sys.fn_cdc_get_max_lsn();

SELECT * FROM cdc.fn_cdc_get_all_changes_dbo_Orders(@from_lsn, @to_lsn, 'all');

UPDATE CdcSyncState SET LastLsn = @to_lsn WHERE CaptureInstance = 'dbo_Orders';
```

This is essentially what tools like Azure Data Factory's CDC connector, Debezium's SQL Server connector, or a hand-rolled ETL job are doing under the hood - the difference is mostly how they store checkpoint state and handle failure/retry, not the underlying mechanism.

## Where it breaks down

- **Retention vs consumer downtime.** If a downstream consumer is down longer than the cleanup job's retention window, those changes are gone - there's no replay from before the retention cutoff. For anything business-critical, either extend retention or make sure the consumer's downtime alerting is tighter than the retention period.
- **Schema changes.** Adding a column to the source table doesn't automatically appear in the existing capture instance. You either accept that the change table has a stale schema until you re-run `sp_cdc_enable_table` with a new capture instance name, or plan schema changes around it. SQL Server supports up to two active capture instances per table specifically to make this transition possible without a gap.
- **It's not free.** The capture job adds continuous log-reader load, and the change tables consume storage that scales with write volume and retention. On a high-write table, this is a real capacity planning input, not an afterthought.
- **It's SQL Server-specific.** If the downstream system needs a provider-agnostic change stream (say, you're also capturing changes from Postgres or MySQL), a log-based CDC platform like Debezium normalizes across engines - native SQL Server CDC only solves it for SQL Server.

## When to reach for it

CDC is a strong fit when you need reliable, ordered change history out of SQL Server without adding write-path overhead, and you already have infrastructure to poll/consume the change tables on a schedule. It's a poor fit as the *only* mechanism for something latency-sensitive (it's near-real-time, not synchronous), and it's not a substitute for an outbox pattern if you need transactional guarantees that a business event and a state change commit together - CDC only tells you the state changed, not why.

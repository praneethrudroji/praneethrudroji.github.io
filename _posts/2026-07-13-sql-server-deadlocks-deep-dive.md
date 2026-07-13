---
title: SQL Server Deadlocks - Reading the Deadlock Graph and Designing Them Away
date: 2026-07-13 08:00 +0530
categories: [backend, sql]
tags: [sql, sql server, deadlocks, locking, concurrency, performance]
---

## Error 1205 is not random bad luck

"Transaction (Process ID 87) was deadlocked on lock resources with another process and has been chosen as the deadlock victim. Rerun the transaction."

Most teams treat this error as weather - unpredictable, retry and move on. But a deadlock is a *specific, reconstructible event*: two (or more) sessions each holding a lock the other needs, forming a cycle that can never resolve on its own. SQL Server's deadlock monitor detects the cycle (checking roughly every 5 seconds), picks the victim - by default the session cheapest to roll back - and kills it. Every deadlock has an exact cause, the cause is recorded, and almost all of them belong to a handful of patterns you can design away. This post picks up where the locking and isolation levels post left off.

## Step 1: get the deadlock graph (it's already being captured)

You don't need to enable anything. Since SQL Server 2012, the always-on **system_health** Extended Events session records every deadlock:

```sql
SELECT CAST(event_data AS XML) AS DeadlockGraph
FROM (
    SELECT CAST(target_data AS XML) AS td
    FROM sys.dm_xe_session_targets st
    JOIN sys.dm_xe_sessions s ON s.address = st.event_session_address
    WHERE s.name = 'system_health' AND st.target_name = 'ring_buffer'
) AS src
CROSS APPLY td.nodes('//RingBufferTarget/event[@name="xml_deadlock_report"]') AS q(ev)
CROSS APPLY (SELECT ev.query('.') AS event_data) AS d;
```

The ring buffer wraps, so on a busy system also check the `system_health` event *files*, or create a dedicated XE session capturing `xml_deadlock_report` to files if deadlocks are frequent enough to investigate over time. In SSMS, opening the XML as a deadlock file (.xdl) renders the visual graph - the ovals-and-arrows picture.

## Step 2: read the graph like a story

Every deadlock graph has the same anatomy, and reading it is a fixed procedure:

- **process-list**: the sessions involved. For each: the `inputbuf` (the SQL it was running - your first clue), the isolation level, and the `waitresource`.
- **resource-list**: the locked objects. Each resource shows its **owner** (who holds the lock, and in what mode) and its **waiter** (who's blocked wanting it, and in what mode).
- The deadlock *is* the cycle: Process A owns resource 1 and waits on resource 2; Process B owns resource 2 and waits on resource 1.

The questions to answer, in order:

1. **What objects?** Resources are listed as `keylock`/`pagelock`/`objectlock` with an `hobtid` - join to `sys.partitions` to name the index: 

```sql
SELECT o.name AS table_name, i.name AS index_name
FROM sys.partitions p
JOIN sys.objects o ON o.object_id = p.object_id
JOIN sys.indexes i ON i.object_id = p.object_id AND i.index_id = p.index_id
WHERE p.hobt_id = 72057594043105280;   -- from the graph
```

2. **What lock modes?** `X` waiting on `S`, `U` on `U`, `RangeS-S` - the modes identify the pattern (below).
3. **What statements?** The inputbuf shows the *current* statement, but the lock being *held* was often taken by an **earlier statement in the same transaction** - this is the single most confusing thing about deadlock graphs. The held lock tells you what the transaction did before; the wait tells you what it's doing now. Reconstruct the transaction's full sequence from your code, not just the inputbuf.

## Step 3: match it to a pattern

Four patterns cover the overwhelming majority of real deadlocks.

### Pattern 1: opposite-order access

Transaction A updates `Orders` then `Customers`; transaction B updates `Customers` then `Orders`. Each grabs its first X lock, then waits forever for the other's. The graph shows two `X` owners each waiting for the other's keylock on the *other* table.

**Fix**: a consistent access order across all code paths - alphabetical, dependency order, whatever, as long as it's a documented convention. This is the deadlock everyone knows about; it's less common in practice than the next three.

### Pattern 2: reader-writer on the same rows (lock escalation of the mind)

Session A: `UPDATE Orders SET ... WHERE OrderId = 5` (holds X on the row). Session B: a reporting query scanning `Orders` at read committed - it acquired S locks and now waits behind A's X. Meanwhile A's *next* statement needs a page B has S-locked (scans hold locks briefly but a big scan holds *something* at all times). Cycle.

**Fix**: this is precisely the reader/writer contention **RCSI eliminates** (locking post) - readers use row versions, take no S locks, and stop participating in these cycles at all. Enabling read committed snapshot removes a whole class of deadlocks in one setting. Alternatively, make the reader's scan a seek with a proper index, shrinking its lock footprint to nearly nothing.

### Pattern 3: the key lookup deadlock (the sneaky one)

Session A updates a row via the **clustered index** (X on clustered key), and the update touches an indexed column, so it also needs to update the **nonclustered index** (X on NC key). Session B is running a SELECT that seeks the **nonclustered index** (S on NC key) and then does a **key lookup** to the clustered index (needs S on clustered key). A holds clustered, wants NC; B holds NC, wants clustered. Textbook cycle - between an UPDATE and a *plain SELECT*, no transaction weirdness required, and it strikes randomly under concurrency.

You recognize it in the graph: two keylocks on **the same table, different indexes** (one clustered, one nonclustered), with a SELECT as one participant.

**Fix**: make the nonclustered index **covering** for that SELECT (covering-indexes post) - no lookup, no second lock, no cycle. RCSI also dissolves it (the reader stops locking). This pattern alone justifies re-reading your deadlock graphs after "harmless" index changes.

### Pattern 4: serializable range locks and upsert collisions

Two sessions run the same upsert for a row that doesn't exist yet. Under `HOLDLOCK`/serializable (as the upserts post prescribes), each takes a **RangeS-S** or RangeI-N lock on the gap; both then try to convert/insert, each blocked by the other's range lock. Graph signature: `RangeS-S` owners waiting on each other. The same shape appears with foreign key checks under serializable, and with `IF EXISTS ... INSERT` code even at read committed (as a duplicate-key race instead - pick your failure).

**Fix**: acquire the *exclusive-intent* lock up front - `UPDLOCK` with the serializable hint (`WITH (UPDLOCK, SERIALIZABLE)`), exactly as the upsert patterns post shows. U locks are incompatible with each other, so the second session waits *before* the cycle forms, serializing the upserts cleanly rather than deadlocking them.

### Honorable mention: the unindexed foreign key

Deleting a parent row requires checking the child table for references; without an index on the FK column, that check **scans the child table**, locking far more than one key and colliding with concurrent child-table work. If your graph shows a delete on a parent participating with wide locks on a child table - index the foreign key. (This also speeds the delete up dramatically; FK columns should be indexed by default.)

## Step 4: reduce, then tolerate

Design measures, roughly in order of leverage:

1. **RCSI** - removes readers from cycles wholesale (mind the version-store/tempdb cost and the queue-claim caveats from the locking post).
2. **Index for seeks and coverage** - smaller lock footprints, no key lookups; patterns 2 and 3 mostly evaporate.
3. **Short transactions** - fewer locks held, held briefly; never hold a transaction across app-side work (same rule as the locking post, doubled).
4. **Consistent access ordering** and **UPDLOCK-first upserts** for the write-write patterns.
5. **Touch fewer rows per statement** - batch big updates (1,000-5,000 rows per transaction); this also dodges lock escalation to table level, which turns polite row conflicts into table-sized deadlocks.

And then tolerance: some residual deadlock rate on a busy OLTP system is normal, and error 1205 is **explicitly retriable** - the victim was rolled back cleanly. Wire 1205 into your transient-error retry policy (retries post; EF Core's `EnableRetryOnFailure` already includes it) with a small backoff and jitter. Retry is the correct *last* layer - after design fixes, not instead of them: a deadlock rate that climbs with load is a design problem wearing a retry-shaped bandage.

## A worked read-through

Graph excerpt (abbreviated): Process 1 inputbuf `UPDATE Orders SET Status=... WHERE OrderId=@p`, owns keylock on `PK_Orders` (X), waits on keylock `IX_Orders_Status` (X). Process 2 inputbuf `SELECT OrderId, CustomerId FROM Orders WHERE Status='Open'`, owns keylock `IX_Orders_Status` (S), waits on `PK_Orders` (S).

Diagnosis in one breath: same table, two indexes, a SELECT holding the nonclustered and wanting the clustered - **pattern 3, key lookup deadlock**. Fix: `CREATE INDEX IX_Orders_Status ON Orders(Status) INCLUDE (CustomerId)` - the SELECT is covered, the lookup and the deadlock cease to exist. Verify by re-checking system_health a week later.

## Takeaways

- Deadlocks are recorded automatically in system_health - every 1205 has a readable autopsy.
- Read the graph as owner/waiter cycles; remember held locks came from *earlier statements* in the transaction.
- Four patterns explain nearly everything: opposite order, reader-writer, key lookup, and range-lock upserts - each with a specific, known fix.
- RCSI and covering indexes prevent whole categories; retry on 1205 handles the civilized remainder.

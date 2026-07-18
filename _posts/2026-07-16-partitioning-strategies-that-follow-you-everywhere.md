---
title: Partitioning - The Decision That Follows You Everywhere
description: "Kafka topics, SQL Server partitioned tables, DynamoDB and Cosmos DB partition keys - one underlying problem. Hash vs range, hot keys and skew, why resharding is always painful, and how to pick keys you will not regret."
date: 2026-07-16 08:00 +0530
categories: [backend, data engineering]
tags: [partitioning, sharding, kafka, sql server, dynamodb, cosmos db, scalability, data engineering, hot partitions]
mermaid: true
---

## One problem in four costumes

At some scale, every system hits the same wall: the data or the traffic no longer fits one machine, one log, or one B-tree. The answer is always the same move - **pick a key, split the data by it, spread the pieces** - and the same three questions follow you regardless of which technology you are holding:

1. **Which key?** It determines what stays together (and therefore what stays ordered, transactional, or cheap to query).
2. **Hash or range?** It determines the trade between balanced load and locality.
3. **What happens when you got it wrong?** Because resharding is painful everywhere, and the pain is proportional to how late you discover it.

I have made this decision in Kafka topics, SQL Server tables, and cloud NoSQL stores, and the transferable insight is that it is *one* decision. Learn its shape once and every "choose your partition key" wizard stops being mysterious.

## The two splitting strategies

**Hash partitioning**: `partition = hash(key) mod N`. Keys spray uniformly, so load balances well - and locality dies. Adjacent keys land on different partitions, so range queries ("orders from last week") must fan out to every partition. This is Kafka's default partitioner, DynamoDB's only mode, and Cosmos DB's only mode.

**Range partitioning**: contiguous key ranges per partition - January here, February there. Range queries touch few partitions and old ranges age out cleanly - and *current* activity concentrates in the newest range. Partition by date and today's partition takes 100% of the writes; you built a hot spot by design. This is SQL Server table partitioning's mode, and also how HBase/Bigtable-style stores and most manual sharding schemes work.

The rule of thumb: **hash for write scaling, range for time-ordered data you query and purge by range.** Most real systems use both at once - hash across nodes, range within a node - which is exactly what a Kafka topic (hashed) full of time-ordered segments (ranged) is.

## Kafka: the key is an ordering contract

In Kafka ([primer here](/posts/kafka-for-engineers-who-know-databases/)), the partition key buys you per-key ordering and costs you repartitioning flexibility:

- Same key → same partition → strict order. Key by the identifier whose event sequence must be preserved (`OrderId`, `CampaignId`), nothing else.
- `hash mod N` means **changing N reassigns keys**. Messages for `campaign-7` before the change sit in partition 2; after, they arrive in partition 9. Any consumer relying on per-key order across that boundary is broken. Partition counts are effectively write-once; provision headroom up front (partitions are cheap when idle - err high).
- **Skew is measured in traffic, not keys.** The hash balances key *counts* beautifully while one whale key melts a single partition.

Ad-tech made me respect that last point. Impression events keyed by advertiser: thousands of advertisers, perfectly reasonable - until one holiday campaign from one retailer is 25% of all traffic. Their partition's consumer lags hours behind while eleven others idle at 4% CPU. Adding consumers does nothing (one partition still goes to one consumer). The fixes, in the order to try them:

1. **Question the ordering requirement.** Often order only matters per *smaller* entity. Key by `campaign` instead of `advertiser`, or `user` instead of `campaign` - the finest key whose ordering you truly need.
2. **Salt the whales.** For known-hot keys, append a small random suffix (`bigco-0` ... `bigco-7`) to spread them over 8 partitions, and either tolerate cross-shard disorder for that key or re-sequence downstream. Targeted salting beats salting everything - every consumer pays the reassembly cost for salted keys.
3. **Two-tier topics.** Route whales to a dedicated topic with its own scaling. Crude, effective, easy to reason about at 2 a.m.

## SQL Server: partitioning is for management, not speed

SQL Server table partitioning is range partitioning inside one server, and the first thing to internalize is what it is *for*. Teams reach for it hoping queries get faster; mostly they do not (a good index on an unpartitioned table serves point queries just as well, and partition elimination only helps queries that filter on the partition key). What partitioning transforms is **data lifecycle management** on big tables.

The canonical setup for an events/facts table, monthly by date:

```sql
CREATE PARTITION FUNCTION pf_MonthlyDate (date)
    AS RANGE RIGHT FOR VALUES ('2026-05-01', '2026-06-01', '2026-07-01');

CREATE PARTITION SCHEME ps_MonthlyDate
    AS PARTITION pf_MonthlyDate ALL TO ([PRIMARY]);

CREATE TABLE dbo.AdEvents (
    EventDate   date            NOT NULL,
    EventId     bigint IDENTITY NOT NULL,
    CampaignId  int             NOT NULL,
    Payload     nvarchar(400)   NULL,
    CONSTRAINT PK_AdEvents PRIMARY KEY CLUSTERED (EventDate, EventId)
) ON ps_MonthlyDate (EventDate);
```

The payoff is **partition switching**. Deleting a month from a billion-row table with `DELETE WHERE EventDate < ...` is hours of log growth, lock escalation, and replication lag - I have watched it take a system down. Switching that month's partition out is a **metadata operation**:

```sql
ALTER TABLE dbo.AdEvents SWITCH PARTITION 1 TO dbo.AdEvents_Archive;
TRUNCATE TABLE dbo.AdEvents_Archive;   -- instant, minimally logged
```

Milliseconds, regardless of row count. The sliding-window pattern - split a new empty partition ahead of time, switch the oldest out on schedule - turns retention on huge tables from a recurring incident into a maintenance job. That, plus per-partition index rebuilds and piecemeal restores, is the honest sales pitch. (If your goal is *query* speed, you want better indexes - start with [execution plans](/posts/reading-sql-execution-plans/).)

Two traps: every unique index must include the partitioning column (which is why `EventDate` leads the primary key above - it changes your key design), and `RANGE RIGHT` vs `RANGE LEFT` off-by-ones put boundary rows in the wrong partition, discovered only when a switch fails a constraint check. Always test the window-slide procedure against a copy with real boundary data.

## DynamoDB and Cosmos DB: physics with a price tag

Cloud NoSQL makes the partitioning contract explicit, because you pay for violating it. Both DynamoDB and Cosmos DB hash your chosen partition key across physical storage slices, and both cap what one slice can do - DynamoDB at 1,000 write units and 3,000 read units per second per partition, Cosmos at 10,000 Request Units ([RU](/glossary/#ru)) per second per physical partition. Provision a Cosmos container to 50,000 RU/s across 10 physical partitions and a hot key still gets only its partition's 5,000 - you are throttled at 10% utilization, and paying for the idle 90%.

So key design has one commandment: **high cardinality, evenly spread access, and known at read time**:

- `TenantId` alone fails when one tenant is 30% of traffic (whales again). `TenantId + '#' + UserId` as a synthetic key spreads it - at the cost of "all data for tenant" becoming a fan-out query. That trade (write spread vs read locality) *is* the design decision; make it consciously per access pattern.
- Time-based keys (`2026-07-16` as partition key) are the classic self-inflicted wound: all of today's traffic on one partition, yesterday's capacity stranded. Write-shard it (`2026-07-16#03` with a bounded suffix you fan in at read time) or rethink the model.
- "Known at read time" is the quiet one: if a common lookup does not know the partition key, it is a cross-partition query. Occasional analytics can eat that; a hot path cannot. Sometimes the answer is storing the item twice under two key shapes - denormalization is not a sin here, it is the pricing model speaking.

Different consoles, same whale problem as Kafka, same synthetic-key salting fix. That is the "one problem, four costumes" thesis paying out.

## Resharding: the bill for guessing wrong

Every system above makes splits cheap and *re*-splits expensive, because moving data while serving traffic is inherently hard:

- **Kafka**: adding partitions breaks key affinity (the `mod N` problem); the clean fix is a new topic with the target count and a migration of producers, then consumers - a project, not a setting.
- **SQL Server**: splitting a *populated* partition is a size-of-data operation with heavy locking; the sliding-window discipline exists precisely so you only ever split empty ones.
- **DynamoDB/Cosmos**: the platform splits physical partitions for you (that part is genuinely managed), but it can never fix a bad *logical* key - hot keys stay hot through every split, and changing the key means writing a new table/container and backfilling it.

Consistent hashing - the ring scheme memcached/Cassandra popularized, where adding a node moves only ~1/N of keys instead of nearly all of them - softens the movement cost when you run your own sharding layer. It does not soften the key-choice cost. Nothing does.

Which yields the actual lessons:

1. **Spend the design time on the key, not the count.** Counts have workarounds (headroom, managed splits). Keys have migrations. List the top access patterns and the ordering/transaction requirements first, and derive the key - never the reverse.
2. **Model the whales before they arrive.** Ask "what if one key is 25% of traffic?" at design review. If the answer is a shrug, you have scheduled a future incident. Skew, not average load, is what kills partitioned systems.
3. **Keep a paved road to re-key.** Event-sourced or CDC-fed systems ([Debezium pipelines](/posts/streaming-sql-server-cdc-into-kafka-debezium/) included) can rebuild any store under a new key by replay. That capability converts "resharding migration" from a bespoke crisis into a big batch job - one more reason the log-centric architecture earns its complexity.

Partitioning is a one-way door with a long hallway: you can walk through it confidently, but you will walk past the consequences for years. Choose the key like it is permanent - because for practical purposes, it is.

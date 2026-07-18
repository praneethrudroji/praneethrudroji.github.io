---
title: Series
icon: fas fa-layer-group
order: 6
---

Reverse-chronological order is how blogs work, but it's a terrible way to *learn*. This page puts the posts in reading order.

## SQL Server performance, from the ground up

Start here if you want the full arc: how data is stored, how queries execute, why they slow down, and how to catch regressions in production.

1. [What is Clustered vs Non-Clustered Index?](/posts/what-is-clustered-vs-non-clustered-index/) - how SQL Server physically stores and finds rows, and what a covering index is.
2. [Reading SQL Execution Plans](/posts/reading-sql-execution-plans/) - the core skill everything else builds on: what the optimizer decided and how to read it.
3. [Sargability and Implicit Conversions](/posts/sargability-implicit-conversions/) - why the index you built isn't being used, including the .NET-specific nvarchar trap.
4. [Query Store - The Flight Recorder](/posts/query-store-flight-recorder/) - catching plan regressions in production history instead of guessing.
5. [SQL Server Isolation Levels](/posts/sql-server-isolation-levels-concurrency-anomalies/) - dirty reads, phantom reads, and lost updates with runnable two-session proofs, plus RCSI vs SNAPSHOT.
6. [SQL Server Deadlocks Deep Dive](/posts/sql-server-deadlocks-deep-dive/) - reading deadlock graphs and designing the four common patterns away.

## T-SQL worth knowing cold

- [Window Functions in SQL Server](/posts/window-functions-sql-server/) - ROW_NUMBER dedup, running totals, gaps and islands, and the ROWS vs RANGE trap.

## Kafka and event streaming

Read in order: the mental model, then the code, then the pipeline that feeds it from your database.

1. [Kafka for Engineers Who Know Databases](/posts/kafka-for-engineers-who-know-databases/) - the log vs queue distinction, partitions, consumer groups, and replication, built up from the transaction log you already know.
2. [Kafka Delivery Semantics in .NET](/posts/kafka-delivery-semantics-dotnet/) - at-least-once done right with Confluent.Kafka, and what exactly-once actually means.
3. [Streaming SQL Server Changes into Kafka with Debezium](/posts/streaming-sql-server-cdc-into-kafka-debezium/) - CDC and Kafka joined in production: snapshots, tombstones, schema evolution.

## Data-intensive systems

How to design for data volume - each stands alone, but they reference each other.

1. [Change Data Capture in SQL Server](/posts/change-data-capture-in-sql-server/) - how CDC works under the hood and when to use it.
2. [Partitioning - The Decision That Follows You Everywhere](/posts/partitioning-strategies-that-follow-you-everywhere/) - one problem across Kafka, SQL Server tables, and DynamoDB/Cosmos: keys, skew, hot partitions, resharding.
3. [Consistent Hashing](/posts/consistent-hashing/) - the ring algorithm behind partitioning that survives nodes joining and leaving without reshuffling everything.
4. [Processing 100 Million Rows a Night](/posts/processing-100-million-rows-a-night/) - keyset chunking, watermarks, SqlBulkCopy, and backpressure with bounded channels.

## Storage engines and distributed consensus

The internals underneath the databases and message brokers everything else in this list depends on.

1. [B-Trees vs LSM-Trees](/posts/btrees-vs-lsm-trees/) - why SQL Server mutates pages in place and Kafka/Cassandra only ever append, and what that costs each of them.
2. [Distributed Consensus and Raft](/posts/distributed-consensus-raft/) - how a cluster agrees on one truth, and where Kafka's KRaft and etcd already rely on it.

## Caching and rate limiting

1. [Caching Strategies](/posts/caching-strategies-cache-aside-write-through/) - cache-aside vs write-through vs write-behind, and the thundering herd that undoes all three.
2. [Rate Limiting Algorithms](/posts/rate-limiting-token-bucket-sliding-window/) - fixed window, sliding window, token bucket, and leaky bucket, with the distributed-counter race condition.

## Microservices in production

1. [Microservice Boundaries](/posts/microservice-boundaries-data-ownership/) - data ownership, the distributed monolith, sagas, and the case for the modular monolith.
2. [The Outbox Pattern End-to-End](/posts/outbox-pattern-end-to-end/) - the dual-write problem and its fix; the plumbing every event-driven service needs.
3. [CQRS and Event Sourcing](/posts/cqrs-event-sourcing/) - two distinct patterns people conflate, and why event sourcing is not "outbox with extra steps".
4. [Timeouts, Retries, and Circuit Breakers](/posts/timeouts-retries-circuit-breakers-dotnet/) - resilience as a system, with Polly v8, and the outages resilience code causes.
5. [Choosing a Cloud Messaging Backbone](/posts/choosing-a-cloud-messaging-backbone/) - Service Bus, Event Hubs, SQS/SNS, or Kafka: the queue-vs-log question that decides it.
6. [Distributed Tracing with OpenTelemetry](/posts/distributed-tracing-opentelemetry-dotnet/) - finding which of N services added the latency, span by span, instead of grepping timestamps.

## .NET in production

1. [Async/Await Pitfalls in C#](/posts/async-await-pitfalls-in-csharp/) - deadlocks, ConfigureAwait, async void, and fire-and-forget.
2. [C# Concurrency Primitives](/posts/csharp-concurrency-primitives/) - lock, SemaphoreSlim, Channel, and Interlocked, and how to actually pick the right one.
3. [Connection Pooling Deep Dive](/posts/connection-pooling-deep-dive-dotnet-sql-server/) - how SqlClient's pool really works, and the four real causes of pool-exhaustion timeouts.
4. [.NET Garbage Collection Internals](/posts/dotnet-garbage-collection-internals/) - Gen0/1/2, the Large Object Heap, and why a leak-free API still has latency spikes.
5. [Authentication in ASP.NET Core](/posts/authentication-aspnet-core/) - cookies, JWTs, and OIDC without the hand-waving.
6. [The Outbox Pattern End-to-End](/posts/outbox-pattern-end-to-end/) - reliable events from .NET and SQL Server, dual-write problem included.

## Ad tech

- [Real-Time Bidding](/posts/real-time-bidding-programmatic-ad-auctions/) - how a programmatic ad auction runs an entire distributed fan-out, scoring, and auction in under 100ms.

## Algorithms

- [Dynamic Programming - Unique Paths](/posts/dynamic-programming-unique-paths/) - from brute-force recursion to bottom-up DP.

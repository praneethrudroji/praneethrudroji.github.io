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
5. [SQL Server Deadlocks Deep Dive](/posts/sql-server-deadlocks-deep-dive/) - reading deadlock graphs and designing the four common patterns away.

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
3. [Processing 100 Million Rows a Night](/posts/processing-100-million-rows-a-night/) - keyset chunking, watermarks, SqlBulkCopy, and backpressure with bounded channels.

## Microservices in production

1. [Microservice Boundaries](/posts/microservice-boundaries-data-ownership/) - data ownership, the distributed monolith, sagas, and the case for the modular monolith.
2. [The Outbox Pattern End-to-End](/posts/outbox-pattern-end-to-end/) - the dual-write problem and its fix; the plumbing every event-driven service needs.
3. [Timeouts, Retries, and Circuit Breakers](/posts/timeouts-retries-circuit-breakers-dotnet/) - resilience as a system, with Polly v8, and the outages resilience code causes.
4. [Choosing a Cloud Messaging Backbone](/posts/choosing-a-cloud-messaging-backbone/) - Service Bus, Event Hubs, SQS/SNS, or Kafka: the queue-vs-log question that decides it.

## .NET in production

1. [Async/Await Pitfalls in C#](/posts/async-await-pitfalls-in-csharp/) - deadlocks, ConfigureAwait, async void, and fire-and-forget.
2. [Authentication in ASP.NET Core](/posts/authentication-aspnet-core/) - cookies, JWTs, and OIDC without the hand-waving.
3. [The Outbox Pattern End-to-End](/posts/outbox-pattern-end-to-end/) - reliable events from .NET and SQL Server, dual-write problem included.

## Algorithms

- [Dynamic Programming - Unique Paths](/posts/dynamic-programming-unique-paths/) - from brute-force recursion to bottom-up DP.

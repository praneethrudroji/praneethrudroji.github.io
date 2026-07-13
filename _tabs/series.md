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

## Data engineering

- [Change Data Capture in SQL Server](/posts/change-data-capture-in-sql-server/) - how CDC works under the hood and when to use it.

## .NET in production

1. [Async/Await Pitfalls in C#](/posts/async-await-pitfalls-in-csharp/) - deadlocks, ConfigureAwait, async void, and fire-and-forget.
2. [Authentication in ASP.NET Core](/posts/authentication-aspnet-core/) - cookies, JWTs, and OIDC without the hand-waving.
3. [The Outbox Pattern End-to-End](/posts/outbox-pattern-end-to-end/) - reliable events from .NET and SQL Server, dual-write problem included.

## Algorithms

- [Dynamic Programming - Unique Paths](/posts/dynamic-programming-unique-paths/) - from brute-force recursion to bottom-up DP.

---
title: Sargability and Implicit Conversions - The Silent Index Killers in .NET + SQL Server Apps
date: 2026-07-13 10:00 +0530
categories: [backend, sql]
tags: [sql, sql server, performance, indexes, sargability, implicit conversion, .net]
---

## The index exists, the plan scans anyway

You built the covering index. Statistics are fresh. And the plan still shows a scan reading ten million rows to return twelve. Before blaming the optimizer, look at the predicate - because the most common cause is a `WHERE` clause the optimizer *cannot* turn into a seek, no matter what indexes exist. That property has a name: **sargability** (Search ARGument-able), and non-sargable predicates are endemic in .NET codebases for one sneaky reason we'll get to (it involves nvarchar, and it's probably in your code right now).

## What makes a predicate seekable

A B-tree index is a sorted structure. A seek is possible only when the predicate describes a **contiguous range of the sorted key values**: `Column = value`, `Column > value`, `Column BETWEEN a AND b`, `Column LIKE 'abc%'` (a prefix is a range). The moment the predicate applies a **function or expression to the column**, the stored key values no longer correspond directly to what's being compared - SQL Server must compute the expression *per row*, which means touching every row: a scan, by construction.

The rule in one line: **transform the parameter, never the column.**

```sql
-- NON-SARGABLE: function wraps the column -> scan + per-row computation
WHERE YEAR(OrderDate) = 2026
WHERE CONVERT(date, CreatedAtUtc) = @day
WHERE UPPER(Email) = UPPER(@email)
WHERE LEFT(Sku, 3) = 'ABC'
WHERE ISNULL(Status, 'None') = @status
WHERE DATEDIFF(DAY, OrderDate, GETDATE()) < 30

-- SARGABLE REWRITES: same logic, expressed as ranges on the raw column
WHERE OrderDate >= '2026-01-01' AND OrderDate < '2027-01-01'
WHERE CreatedAtUtc >= @dayStart AND CreatedAtUtc < @dayEnd     -- datetime post's rule
WHERE Email = @email        -- case-insensitive collation already handles case
WHERE Sku LIKE 'ABC%'       -- prefix LIKE seeks; '%ABC' cannot
WHERE (Status = @status OR (Status IS NULL AND @status = 'None'))
WHERE OrderDate > DATEADD(DAY, -30, GETDATE())                 -- function on the CONSTANT is fine
```

Note the `DATEDIFF` fix: functions applied to *constants and parameters* are computed once and are perfectly sargable - the ban is only on wrapping the column. And the `UPPER` example carries a .NET-specific lesson: if your column's collation is case-insensitive (the SQL Server default `_CI_` collations), `Email = @email` is already case-insensitive - the `UPPER()` wrapper people add "for safety" does nothing except destroy the seek.

## The .NET shop's #1 silent scan: nvarchar parameter vs varchar column

Here's the one worth checking in your codebase today. Your table:

```sql
CREATE TABLE dbo.Customers (
    CustomerCode VARCHAR(20) NOT NULL,   -- varchar
    ...
    INDEX IX_Customers_Code (CustomerCode)
);
```

Your .NET code (ADO.NET, Dapper, or older EF configurations):

```csharp
cmd.Parameters.AddWithValue("@code", customerCode);   // C# string -> NVARCHAR by default
```

.NET strings are UTF-16, so `AddWithValue` sends the parameter as **nvarchar**. Now SQL Server must compare `varchar` column against `nvarchar` parameter, and by data type precedence, **nvarchar wins - the *column* gets implicitly converted**:

```
WHERE CONVERT_IMPLICIT(nvarchar(20), CustomerCode) = @code
```

A function wrapped around the column - by the type system, invisibly, with your query text looking perfectly innocent. Result: full index scan, per-row conversion, on every call, of a query that "obviously" should seek. (The precise behavior depends on collation - under Windows collations you may get a still-costly range scan rather than a full scan - but the damage and the fix are the same.) This single pattern is responsible for a startling share of "SQL Server is slow" tickets in .NET shops.

Fixes:

```csharp
// Explicit type, correct length - the professional habit
cmd.Parameters.Add("@code", SqlDbType.VarChar, 20).Value = customerCode;

// Dapper
new { code = new DbString { Value = customerCode, IsAnsi = true, Length = 20 } }

// EF Core: declare the column so EF sends the right type
builder.Property(c => c.CustomerCode).HasColumnType("varchar(20)");   // or .IsUnicode(false)
```

Or eliminate the class of problem: standardize new schemas on `nvarchar` so .NET's default matches (a storage-size trade-off you make once, deliberately). Related habit from the same family: `AddWithValue` also *infers length from the value*, so `@name = "Bob"` arrives as nvarchar(3) - producing a different plan-cache entry per distinct length and polluting the cache. Explicit types and lengths fix both problems at once.

The same conversion trap fires wherever types mismatch across a comparison or join: `varchar` OrderNumber joined to `int` (numeric wins → column converted, plus runtime errors lurking when a non-numeric value appears), dates stored as strings compared to datetime, and `sql_variant` anywhere near a predicate.

## Finding these in the wild

You don't have to audit by eye - the engine tells on itself:

1. **Plan warnings**: implicit conversions that affect seek selection stamp a **yellow-triangle warning** on the plan root - `Type conversion in expression (CONVERT_IMPLICIT(...)) may affect "Cardinality Estimate"/"Seek Plan"`. In the execution-plans-post workflow, checking root-operator warnings should be step one.
2. **Plan cache sweep** for CONVERT_IMPLICIT on your hot queries:

```sql
SELECT TOP 50 qs.total_worker_time, qs.execution_count, st.text
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp
WHERE CAST(qp.query_plan AS NVARCHAR(MAX)) LIKE '%CONVERT_IMPLICIT%'
ORDER BY qs.total_worker_time DESC;
```

3. **Residual predicates**: in the plan, a seek whose *Predicate* (not Seek Predicate) carries the real filter means rows were seeked broadly and filtered after - the non-sargable part demoted to a residual. Estimated-vs-actual row gaps on such operators tie back to the statistics post: the optimizer can't estimate through most column-wrapped functions, so bad cardinality compounds the scan.

## When you can't rewrite: make the expression indexable

Sometimes the expression *is* the business logic. Then persist it and index it - the same computed-column technique from the JSON post:

```sql
ALTER TABLE dbo.Orders ADD OrderYear AS YEAR(OrderDate);           -- deterministic -> indexable
CREATE INDEX IX_Orders_Year ON dbo.Orders (OrderYear);
-- WHERE YEAR(OrderDate) = 2026 now matches the computed column and seeks
```

The optimizer matches the original expression to the computed column automatically (keep session SET options standard). For case-normalized searches on a case-sensitive collation, a persisted `UPPER(Email)` column with an index is the honest version of the UPPER-both-sides anti-pattern. `LIKE '%term%'` searching - unfixable by any B-tree rewrite - graduates to **full-text indexing**, which is its own future post.

Two more patterns in the sargability family worth recognizing:

- **The OR that kills a seek**: `WHERE Status = @s OR CustomerId = @c` can't use one index for both branches; the optimizer sometimes builds an index-union, but the reliable rewrite is `UNION ALL` of two seekable queries (dedup as needed).
- **The optional-filter catch-all**: `WHERE (@name IS NULL OR Name = @name) AND ...` - non-sargable *and* unsniffable; the fixes live in the parameter sniffing post (RECOMPILE or dynamic SQL).

## Takeaways

- A predicate seeks only if it describes a range of raw key values: transform parameters, never columns.
- The nvarchar-parameter-vs-varchar-column implicit conversion is the .NET ecosystem's most common invisible scan - fix parameter types explicitly or align schema and code on nvarchar.
- The engine flags the crime: plan warnings and CONVERT_IMPLICIT in the cache are your audit trail.
- Business-logic expressions become sargable via persisted computed columns; `%term%` search means full-text, not LIKE.

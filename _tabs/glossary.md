---
title: Glossary
icon: fas fa-spell-check
order: 7
---

Every abbreviation used on this blog, spelled out with a plain-English one-liner.
Posts link here the first time a term appears, so you can jump in mid-series
without a decoder ring.

## SQL Server

| Abbreviation | Full form | What it means |
| :-- | :-- | :-- |
| **CDC**{: #cdc } | Change Data Capture | Built-in SQL Server feature that records every insert, update, and delete on a table by reading the transaction log, so other systems can consume the changes later. |
| **CE**{: #ce } | Cardinality Estimator | The part of the query optimizer that guesses how many rows each step of a query will produce; bad guesses lead to bad plans. |
| **CTE**{: #cte } | Common Table Expression | The `WITH name AS (...)` block that names a subquery so the main query can read from it like a table. |
| **DMV**{: #dmv } | Dynamic Management View | System views (names start with `sys.dm_`) that expose what the server is doing right now - running queries, waits, memory, locks. |
| **FK**{: #fk } | Foreign Key | A column that points at another table's key, with a constraint that keeps the reference valid. |
| **HOBT**{: #hobt } | Heap Or B-Tree | Internal name for one physical structure storing a table or index; deadlock graphs identify locked objects by their `hobt_id`. |
| **LSN**{: #lsn } | Log Sequence Number | The position stamp of a record in the transaction log; CDC uses LSN ranges to say "give me changes between here and here". |
| **NC**{: #nc } | Nonclustered (index) | A separate index structure that points back at the table rows, as opposed to the clustered index which *is* the table. |
| **OLTP**{: #oltp } | Online Transaction Processing | The workload style of a live application database: many small, quick reads and writes from concurrent users. |
| **POC pattern**{: #poc } | Partition, Order, Covered | The recipe for indexing window functions: key the index on the Partition columns, then the Order columns, and INCLUDE the Covered payload. |
| **PK**{: #pk } | Primary Key | The column(s) that uniquely identify a row; in SQL Server the primary key is the clustered index by default. |
| **RCSI**{: #rcsi } | Read Committed Snapshot Isolation | A database setting where readers see a recent committed copy of each row instead of taking shared locks, so readers and writers stop blocking each other. |
| **SARGable**{: #sargable } | Search ARGument able | A predicate written so the optimizer can use an index seek for it - e.g. `WHERE OrderDate >= @d`, not `WHERE YEAR(OrderDate) = 2026`. |
| **S / U / X locks**{: #lock-modes } | Shared / Update / Exclusive locks | The three lock modes that matter for deadlocks: Shared for reading, Exclusive for writing, Update for "reading with intent to write". Explained visually in the [deadlocks post](/posts/sql-server-deadlocks-deep-dive/). |
| **SSMS**{: #ssms } | SQL Server Management Studio | Microsoft's desktop tool for querying and managing SQL Server. |
| **TDS**{: #tds } | Tabular Data Stream | The wire protocol clients use to talk to SQL Server; `SqlBulkCopy` is fast because it uses the protocol's dedicated bulk-load mode. |
| **XE**{: #xe } | Extended Events | SQL Server's lightweight tracing framework; the always-on `system_health` session is an Extended Events session. |

## Distributed systems and messaging

| Abbreviation | Full form | What it means |
| :-- | :-- | :-- |
| **DLQ**{: #dlq } | Dead-Letter Queue | The parking lot for messages that repeatedly fail processing, so one poison message cannot block the queue; you monitor it and decide each message's fate. |
| **EOS**{: #eos } | Exactly-Once Semantics | Kafka's transactional guarantee that a consume-transform-produce step either fully happens or fully does not - within Kafka; it does not extend to your database or other side effects. |
| **ISR**{: #isr } | In-Sync Replicas | The set of a Kafka partition's replicas that are fully caught up with the leader; `acks=all` waits for exactly this set, which is why its size matters. |
| **RU**{: #ru } | Request Unit | Azure Cosmos DB's currency of throughput; every read and write costs RUs, and each physical partition has a fixed share of the container's provisioned RU/s. |
| **TTL**{: #ttl } | Time To Live | An expiry attached to a cache entry, message, or record, after which the system deletes it automatically. |

## .NET and web

| Abbreviation | Full form | What it means |
| :-- | :-- | :-- |
| **BFF**{: #bff } | Backend For Frontend | A small server-side app that sits between a browser app and your APIs, holding tokens server-side so the browser never sees them. |
| **CSRF**{: #csrf } | Cross-Site Request Forgery | An attack where another site tricks a logged-in browser into sending a request to your app; mitigated with anti-forgery tokens and SameSite cookies. |
| **EF Core**{: #ef-core } | Entity Framework Core | Microsoft's object-relational mapper for .NET - it translates C# LINQ queries into SQL. |
| **JWT**{: #jwt } | JSON Web Token | A signed, self-contained token carrying claims about a user; APIs validate the signature instead of holding session state. |
| **MFA**{: #mfa } | Multi-Factor Authentication | Requiring a second proof (authenticator app, hardware key) beyond the password. |
| **MQ**{: #mq } | Message Queue | Middleware (RabbitMQ, Azure Service Bus) that stores messages so producers and consumers do not have to be online at the same time. |
| **OIDC**{: #oidc } | OpenID Connect | The standard login protocol built on OAuth 2.0; what "sign in with..." flows and identity providers speak. |
| **ORM**{: #orm } | Object-Relational Mapper | A library that maps database rows to objects in code, like Entity Framework Core or Dapper. |
| **PKCE**{: #pkce } | Proof Key for Code Exchange | An OAuth extension that stops stolen authorization codes from being replayed; pronounced "pixy". |
| **RS256**{: #rs256 } | RSA + SHA-256 signature | An asymmetric token-signing algorithm: the identity provider signs with a private key, your API verifies with the public key. |
| **SPA**{: #spa } | Single-Page Application | A browser app (React, Angular, Blazor WebAssembly) that talks to APIs instead of reloading pages from a server. |
| **WPF**{: #wpf } | Windows Presentation Foundation | Microsoft's desktop UI framework for Windows applications. |
| **XSS**{: #xss } | Cross-Site Scripting | An attack that injects script into your page; any token readable by JavaScript can be stolen through it. |

## General

| Abbreviation | Full form | What it means |
| :-- | :-- | :-- |
| **API**{: #api } | Application Programming Interface | The surface a program exposes for other programs to call; on this blog usually an HTTP service. |
| **CPU**{: #cpu } | Central Processing Unit | The processor; "CPU time" in query stats is time spent actually computing, as opposed to waiting. |
| **DB**{: #db } | Database | Shorthand for the database or database server. |
| **DP**{: #dp } | Dynamic Programming | An algorithm technique that solves a problem by combining answers to overlapping subproblems, storing each answer once. |
| **IO**{: #io } | Input/Output | Reads and writes against disk or network; "logical reads" in SQL Server are IO against cached pages. |
| **UI**{: #ui } | User Interface | The part of an application a person sees and interacts with. |

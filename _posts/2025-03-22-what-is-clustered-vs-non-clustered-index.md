---
layout: post
title: What is Clustered vs Non-Clustered Index?
description: Clustered vs non-clustered indexes in SQL Server explained - how each stores data, when key lookups hurt, and how INCLUDE columns make an index covering.
date: 2025-03-22 00:38 +0530
categories: [backend, sql]
tags: [indexes, databases, sql, performance, optimization, clustered index, non-clustered index]
---

{%
  include embed/audio.html
  src='assets/media/Clustered vs. Non-Clustered Index_ Understanding Database Indexes.wav'
  title='Clustered vs Non-Clustered Indexes Audio'
%}

## The question I get asked most in code review

Almost every time I review a migration that adds an index, someone asks the same thing: "should this be clustered or non-clustered?" It's a fair question, because the two behave very differently, and picking wrong either wastes space or makes a common query slower than it needs to be. Here's how I think about it.

### Clustered index: the table's actual sort order

A clustered index isn't really a separate structure sitting next to your table. It *is* your table, stored in the order of whatever column you clustered on. Think of a phone book: the entries aren't in a list somewhere pointing at names scattered around town, the phone book itself is sorted by last name. That's what a clustered index does to your data.

Because the data can only be physically sorted one way at a time, a table gets exactly one clustered index. You don't get to choose two.

Say you have an `Employees` table with a clustered index on `EmployeeID`. The rows are physically stored in that order:

| EmployeeID | FirstName | LastName | Department |
| ---------- | --------- | -------- | ---------- |
| 1          | Alice     | Smith    | HR         |
| 2          | Bob       | Johnson  | IT         |
| 3          | Charlie   | Brown    | Finance    |

Ask for `WHERE EmployeeID BETWEEN 1 AND 3` and the engine just reads three consecutive rows off disk. No hunting around. That's why clustered indexes are the natural fit for range queries and for anything sorted by `ORDER BY` on that column.

### Non-clustered index: a lookup table pointing back at the real data

A non-clustered index doesn't touch the physical order of the table at all. It's a separate, smaller structure that stores just the indexed column (sorted) plus a pointer back to where the full row actually lives. It's closer to the index at the back of a textbook: the index tells you which page to flip to, but the actual content is still living on that page, not inside the index.

Because it's a separate structure and doesn't dictate table order, you can have as many non-clustered indexes as you need. That makes them the right tool for exact-match lookups and searches on columns that aren't the table's natural sort order.

Take the same `Employees` table, now with a non-clustered index on `LastName`:

**Non-Clustered Index on `LastName`**

| LastName | Pointer to EmployeeID |
| -------- | --------------------- |
| Brown    | 3                     |
| Johnson  | 2                     |
| Smith    | 1                     |

Query `WHERE LastName = 'Smith'` and the engine does two things: it finds `Smith` in this small sorted index and reads off the pointer (`EmployeeID = 1`), then it goes back to the actual table to fetch the rest of that row. That second hop - going from the index back to the table - is called a key lookup, and it's the thing that gets expensive if you're doing it for thousands of rows at once.

### The two side by side

| Feature               | Clustered Index                                | Non-Clustered Index                                        |
| --------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| **Physical Order**    | Data is stored in the same order as the index. | Data is stored separately; index points to the data.       |
| **Number of Indexes** | Only one per table.                            | Multiple indexes allowed.                                  |
| **Use Case**          | Best for range queries (e.g., `BETWEEN`).      | Best for exact lookups (e.g., `WHERE LastName = 'Smith'`). |

### What happens if a table has no clustered index at all

This is the part that surprised me the first time I ran into it. If you never create a clustered index, SQL Server doesn't leave the table "unsorted but otherwise normal." It stores the rows in what's called a heap: an unordered pile of rows, referenced by an internal row ID rather than by any column of yours.

**Heap File for `Employees` Table**

| Row ID | EmployeeID | FirstName | LastName | Department |
| ------ | ---------- | --------- | -------- | ---------- |
| 1      | 2          | Bob       | Johnson  | IT         |
| 2      | 1          | Alice     | Smith    | HR         |
| 3      | 3          | Charlie   | Brown    | Finance    |

A non-clustered index on a heap points at those row IDs instead of at a clustering key:

| LastName | Pointer (Row ID) |
| -------- | ---------------- |
| Brown    | 3                |
| Johnson  | 1                |
| Smith    | 2                |

It works, but in practice I almost always want a clustered index (usually on an identity or a sequential key) rather than leaving a table as a heap. Heaps have their own maintenance quirks that are outside the scope of this post, but as a rule of thumb: give your tables a clustered index unless you have a specific reason not to.

### Once a clustered index exists, non-clustered indexes point at it

Add a clustered index on `EmployeeID` and now every non-clustered index on that table stores the clustering key instead of a row ID:

**Clustered Index on `EmployeeID`**

| EmployeeID | FirstName | LastName | Department |
| ---------- | --------- | -------- | ---------- |
| 1          | Alice     | Smith    | HR         |
| 2          | Bob       | Johnson  | IT         |
| 3          | Charlie   | Brown    | Finance    |

**Non-Clustered Index on `LastName`**

| LastName | Clustered Key (EmployeeID) |
| -------- | -------------------------- |
| Brown    | 3                          |
| Johnson  | 2                          |
| Smith    | 1                          |

This is worth remembering when you're choosing a clustering key: every non-clustered index on the table carries a copy of it. A wide or ever-changing clustering key makes every other index on the table bigger and slower to maintain, which is part of why a narrow, ever-increasing key (like an identity column) is usually the safe default.

### The trick that skips the key lookup entirely: covering indexes

Remember that key lookup I mentioned, the extra hop from the non-clustered index back to the table? There's a way to avoid it. If a non-clustered index already contains every column a query needs, the engine never has to go back to the table at all. That's called a covering index.

You build one by adding extra columns to the index purely so it can answer a specific query on its own, usually via `INCLUDE`. It costs you some duplicated storage, but for a query you run constantly, that trade is usually worth it.

**Non-Clustered Index on `LastName`, Including `Department`**

| LastName | Department | Pointer (Row ID) |
| -------- | ---------- | ---------------- |
| Brown    | Finance    | 3                |
| Johnson  | IT         | 1                |
| Smith    | HR         | 2                |

Now `SELECT Department FROM Employees WHERE LastName = 'Smith'` never has to touch the actual table. Everything the query needs - the filter column and the column being selected - already lives in the index.

### Where I land

If I had to boil this down to the rule I actually use: reach for a clustered index when a table is commonly scanned by range or sorted a particular way, and it should exist on almost every table you write to. Reach for non-clustered indexes for the specific exact-match lookups your queries actually run. And when one of those lookups runs often enough to show up in a performance review, check whether adding the queried columns to the index (making it covering) would let you skip the round trip back to the table entirely.

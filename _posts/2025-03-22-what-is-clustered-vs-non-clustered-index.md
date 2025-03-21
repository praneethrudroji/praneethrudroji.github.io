---
layout: post
title: What is Clustered VS Non-Clustered Index
date: 2025-03-22 00:38 +0530
tags: [indexes, databases, sql, performance, optimization, clustered index, non-clustered index]
---

## What is Clustered VS Non-Clustered Index

When working with databases, understanding the difference between clustered and non-clustered indexes is crucial for optimizing query performance. Let's dive into these concepts.

### Clustered Index

A clustered index determines the physical order of data in a table. It is like a phone book where the data is stored in a sorted order based on the indexed column. Since the data is stored directly in the index, there can be only one clustered index per table.

#### Characteristics of Clustered Index:
- **Physical Order**: Data is stored in the same order as the index.
- **Single Index**: Only one clustered index is allowed per table.
- **Efficient for Range Queries**: Ideal for range queries as data is stored sequentially.

#### Example:
Consider a table `Employees` with a clustered index on the `EmployeeID` column. The data will be stored in the table in the order of `EmployeeID`.

### Non-Clustered Index

A non-clustered index, on the other hand, does not alter the physical order of the data. Instead, it creates a separate structure that points to the actual data. Think of it as an index in a book that points to the pages where the information is located.

#### Characteristics of Non-Clustered Index:
- **Logical Order**: Data is stored in one place, and index entries point to the data.
- **Multiple Indexes**: Multiple non-clustered indexes can be created on a table.
- **Efficient for Exact Lookups**: Ideal for exact lookups and queries involving multiple columns.

#### Example:
Consider the same `Employees` table with a non-clustered index on the `LastName` column. The index will store the `LastName` values along with pointers to the actual rows in the table.

### Key Differences

| Feature           | Clustered Index                            | Non-Clustered Index                                  |
| ----------------- | ------------------------------------------ | ---------------------------------------------------- |
| Physical Storage  | Data stored in the same order as the index | Separate structure pointing to the data              |
| Number of Indexes | Only one per table                         | Multiple indexes allowed                             |
| Use Case          | Efficient for range queries                | Efficient for exact lookups and multi-column queries |

### Conclusion

Understanding the differences between clustered and non-clustered indexes helps in designing efficient database schemas and optimizing query performance. Clustered indexes are best for range queries, while non-clustered indexes are suitable for exact lookups and queries involving multiple columns.

By leveraging the right type of index, you can significantly improve the performance of your database applications.

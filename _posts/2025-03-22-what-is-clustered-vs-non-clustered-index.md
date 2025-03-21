---
layout: post
title: What is Clustered vs Non-Clustered Index?
date: 2025-03-22 00:38 +0530
categories: [backend, sql]
tags: [indexes, databases, sql, performance, optimization, clustered index, non-clustered index]
---

## What is Clustered vs Non-Clustered Index?

When working with databases, **indexes** are used to speed up queries. Two common types of indexes are **clustered** and **non-clustered indexes**. Understanding the difference between them is essential for optimizing database performance. Let’s break it down in simple terms.

---

### Clustered Index

A clustered index determines the **physical order of data** in a table. Think of it like a phone book, where the data is stored in sorted order based on the indexed column. Since the data is stored directly in the index, there can be **only one clustered index per table**.

#### Key Characteristics:
1. **Physical Order**: The data in the table is stored in the same order as the index.
2. **Single Index**: Only one clustered index is allowed per table.
3. **Efficient for Range Queries**: Ideal for queries that retrieve a range of values (e.g., `BETWEEN`, `ORDER BY`).

#### Example:
Let’s say we have a table called `Employees` with a clustered index on the `EmployeeID` column. The data will be stored in the table in the order of `EmployeeID`:

| EmployeeID | FirstName | LastName | Department |
| ---------- | --------- | -------- | ---------- |
| 1          | Alice     | Smith    | HR         |
| 2          | Bob       | Johnson  | IT         |
| 3          | Charlie   | Brown    | Finance    |

- **How It Works**:  
  If you query for a range of `EmployeeID` (e.g., `WHERE EmployeeID BETWEEN 1 AND 3`), the database can quickly retrieve the data because it is stored sequentially.

---

### Non-Clustered Index

A non-clustered index, on the other hand, does **not change the physical order** of the data. Instead, it creates a **separate structure** that points to the actual data. Think of it like an index in a book—it tells you where to find the information, but the information itself is stored elsewhere.

#### Key Characteristics:
1. **Logical Order**: The data is stored in one place, and the index points to it.
2. **Multiple Indexes**: You can create multiple non-clustered indexes on a table.
3. **Efficient for Exact Lookups**: Ideal for queries that search for specific values or involve multiple columns.

#### Example:
Let’s use the same `Employees` table, but this time with a non-clustered index on the `LastName` column. The index will store the `LastName` values along with pointers to the actual rows in the table:

**Non-Clustered Index on `LastName`**

| LastName | Pointer to EmployeeID |
| -------- | --------------------- |
| Brown    | 3                     |
| Johnson  | 2                     |
| Smith    | 1                     |

- **How It Works**:  
  If you query for `WHERE LastName = 'Smith'`, the database will:  
  1. Use the non-clustered index to find the pointer to `EmployeeID = 1`.  
  2. Fetch the actual row from the table using the pointer.

---

### Key Differences

| Feature               | Clustered Index                                | Non-Clustered Index                                        |
| --------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| **Physical Order**    | Data is stored in the same order as the index. | Data is stored separately; index points to the data.       |
| **Number of Indexes** | Only one per table.                            | Multiple indexes allowed.                                  |
| **Use Case**          | Best for range queries (e.g., `BETWEEN`).      | Best for exact lookups (e.g., `WHERE LastName = 'Smith'`). |

---

### Understanding Index Storage

#### Heap File (No Clustered Index)
When a table does not have a clustered index, the data is stored in a **heap file**, which is unordered. Non-clustered indexes in this case point to the rows in the heap.

**Example: Heap File for `Employees` Table**

| Row ID | EmployeeID | FirstName | LastName | Department |
| ------ | ---------- | --------- | -------- | ---------- |
| 1      | 2          | Bob       | Johnson  | IT         |
| 2      | 1          | Alice     | Smith    | HR         |
| 3      | 3          | Charlie   | Brown    | Finance    |

- **Non-Clustered Index on `LastName`**:
  
  | LastName | Pointer (Row ID) |
  | -------- | ---------------- |
  | Brown    | 3                |
  | Johnson  | 1                |
  | Smith    | 2                |

---

#### Clustered Index Storage
If a clustered index exists (e.g., on `EmployeeID`), the data is stored in the order of the index.

**Example: Clustered Index on `EmployeeID`**

| EmployeeID | FirstName | LastName | Department |
| ---------- | --------- | -------- | ---------- |
| 1          | Alice     | Smith    | HR         |
| 2          | Bob       | Johnson  | IT         |
| 3          | Charlie   | Brown    | Finance    |

- **Non-Clustered Index on `LastName`**:
  
  | LastName | Clustered Key (EmployeeID) |
  | -------- | -------------------------- |
  | Brown    | 3                          |
  | Johnson  | 2                          |
  | Smith    | 1                          |

---

#### Covering Index
A **covering index** includes all the columns needed for a query, so the database doesn’t need to access the actual table. Since it stores additional columns alongside the indexed ones, it can have redundant data.

**Example: Non-Clustered Index on `LastName` Including `Department`**

| LastName | Department | Pointer (Row ID) |
| -------- | ---------- | ---------------- |
| Brown    | Finance    | 3                |
| Johnson  | IT         | 1                |
| Smith    | HR         | 2                |

- **Query**: `SELECT Department FROM Employees WHERE LastName = 'Smith'`  
  - The database can answer this query using only the index, without accessing the table.

---

### Conclusion

- **Clustered Index**: Best for range queries and tables with a primary key.  
- **Non-Clustered Index**: Best for exact lookups and queries involving multiple columns.  
- **Covering Index**: Improves performance by including all required columns in the index but may store redundant data.

By understanding these concepts, you can design efficient database schemas and write faster queries.

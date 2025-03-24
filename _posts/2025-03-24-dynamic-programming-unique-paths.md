---
layout: post
title: Dynamic Programming - Unique Paths
date: 2025-03-24 23:35 +0530
categories: [Programming, Algorithms, Dynamic Programming]
tags: [Dynamic Programming, Algorithms, Recursion, Memoization]
---

## Problem Statement

There is a robot on an m x n grid. The robot is initially located at the top-left corner (i.e., grid[0][0]). The robot tries to move to the bottom-right corner (i.e., grid[m - 1][n - 1]). The robot can only move either down or right at any point in time.

Given the two integers m and n, return the number of possible unique paths that the robot can take to reach the bottom-right corner.

The test cases are generated so that the answer will be less than or equal to 2 * 10^9.

![DP Robot Grid](/assets/img/dp-unique-paths.png)

## Thought Process

1. **Understanding the Problem:**
   - The robot can only move to the RIGHT or DOWN.
   - We need to find the number of unique paths from the top-left corner to the bottom-right corner.

2. **Base Cases:**
   - If either m or n is 0, there are 0 ways to reach the bottom-right corner because a grid with 0 rows or 0 columns does not form a valid grid.
   - If the grid is 1x1, there is exactly 1 way to reach the bottom-right corner.

3. **Example Cases:**
   - For a 2x2 grid:
     ```
     +---+---+
     | S |   |
     +---+---+
     |   | E |
     +---+---+
     ```
     - Move right, then down.
     - Move down, then right.
     - Total: 2 ways.

   - For a 3x2 grid:
     ```
     +---+---+
     | S |   |
     +---+---+
     |   |   |
     +---+---+
     |   | E |
     +---+---+
     ```
     - Move DOWN first, reducing the grid to a 2x2 grid (2 ways).
     - Move RIGHT first, reducing the grid to a 3x1 grid (1 way).
     - Total: 2 + 1 = 3 ways.

## Top-Down (Recursive) Solution

```csharp
public class Solution {
    public int UniquePaths(int m, int n) {
        if (m == 0 || n == 0) return 0;  
        if (m == 1 && n == 1) return 1;

        int totalWays = 0;

        // The robot can take two paths: either right or down
        totalWays = UniquePaths(m, n - 1) + UniquePaths(m - 1, n);

        return totalWays;
    }
}
```

### Example Execution

Let's break down the execution of `UniquePaths(3, 2)` step by step:

1. **Initial Call:**
   - `UniquePaths(3, 2)`

2. **First Level of Recursion:**
   - The robot can move right to `UniquePaths(3, 1)` or down to `UniquePaths(2, 2)`.

3. **Second Level of Recursion (Right Path):**
   - `UniquePaths(3, 1)`
     - The robot can move right to `UniquePaths(3, 0)` or down to `UniquePaths(2, 1)`.

4. **Third Level of Recursion (Right-Right Path):**
   - `UniquePaths(3, 0)` returns 0 because m or n is 0.
   - `UniquePaths(2, 1)`
     - The robot can move right to `UniquePaths(2, 0)` or down to `UniquePaths(1, 1)`.

5. **Fourth Level of Recursion (Right-Right-Right Path):**
   - `UniquePaths(2, 0)` returns 0 because m or n is 0.
   - `UniquePaths(1, 1)` returns 1 because it is a 1x1 grid.

6. **Combining Results (Right Path):**
   - `UniquePaths(2, 1)` = 0 (from `UniquePaths(2, 0)`) + 1 (from `UniquePaths(1, 1)`) = 1.
   - `UniquePaths(3, 1)` = 0 (from `UniquePaths(3, 0)`) + 1 (from `UniquePaths(2, 1)`) = 1.

7. **Second Level of Recursion (Down Path):**
   - `UniquePaths(2, 2)`
     - The robot can move right to `UniquePaths(2, 1)` or down to `UniquePaths(1, 2)`.

8. **Third Level of Recursion (Down-Right Path):**
   - `UniquePaths(2, 1)` has already been calculated as 1.
   - `UniquePaths(1, 2)`
     - The robot can move right to `UniquePaths(1, 1)` or down to `UniquePaths(0, 2)`.

9. **Fourth Level of Recursion (Down-Right-Right Path):**
   - `UniquePaths(1, 1)` returns 1 because it is a 1x1 grid.
   - `UniquePaths(0, 2)` returns 0 because m or n is 0.

10. **Combining Results (Down Path):**
    - `UniquePaths(1, 2)` = 1 (from `UniquePaths(1, 1)`) + 0 (from `UniquePaths(0, 2)`) = 1.
    - `UniquePaths(2, 2)` = 1 (from `UniquePaths(2, 1)`) + 1 (from `UniquePaths(1, 2)`) = 2.

11. **Combining Final Results:**
    - `UniquePaths(3, 2)` = 1 (from `UniquePaths(3, 1)`) + 2 (from `UniquePaths(2, 2)`) = 3.

## Adding Memoization

To optimize the recursive solution, we can use memoization to store the results of subproblems and avoid redundant calculations.

```csharp
public class Solution {

    Dictionary<(int, int), int> memo = new();

    public int UniquePaths(int m, int n) {
        if (m == 0 || n == 0) return 0;  
        if (m == 1 && n == 1) return 1;

        if (memo.ContainsKey((m, n))) return memo[(m, n)];

        int totalWays = 0;

        // The robot can take two paths: either right or down
        totalWays = UniquePaths(m, n - 1) + UniquePaths(m - 1, n);

        memo[(m, n)] = totalWays;
        return totalWays;
    }
}
```

## Stay Tuned

Stay tuned for the bottom-up iterative approach to solving the unique paths problem!

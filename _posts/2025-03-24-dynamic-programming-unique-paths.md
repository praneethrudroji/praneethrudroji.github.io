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

### Explanation

In the top-down approach, we use recursion to calculate the number of unique paths to the bottom-right corner of the grid. The idea is to break the problem into smaller subproblems:

1. **Recursive Formula:**
   - To reach cell `(m, n)`, the robot must come from either the cell above it `(m-1, n)` or the cell to its left `(m, n-1)`.
   - Therefore, the total number of unique paths to `(m, n)` is the sum of the unique paths to `(m-1, n)` and `(m, n-1)`.
   - Formula: `UniquePaths(m, n) = UniquePaths(m-1, n) + UniquePaths(m, n-1)`.

2. **Base Cases:**
   - If `m == 0` or `n == 0`, there are no valid paths because the grid is invalid.
   - If `m == 1` and `n == 1`, there is exactly one path (the robot is already at the destination).

3. **Recursive Calls:**
   - The function makes two recursive calls for each cell: one for the cell above and one for the cell to the left.

4. **Result:**
   - The result is the value returned by `UniquePaths(m, n)`.

### Example Execution

For a 3x2 grid:

1. **Initial Call:**
   - `UniquePaths(3, 2)`

2. **First Level of Recursion:**
   - The robot can move right to `UniquePaths(3, 1)` or down to `UniquePaths(2, 2)`.

3. **Second Level of Recursion:**
   - For `UniquePaths(3, 1)`, the robot can move right to `UniquePaths(3, 0)` or down to `UniquePaths(2, 1)`.
   - For `UniquePaths(2, 2)`, the robot can move right to `UniquePaths(2, 1)` or down to `UniquePaths(1, 2)`.

4. **Base Cases:**
   - `UniquePaths(3, 0)` and `UniquePaths(0, 2)` return 0 because the grid is invalid.
   - `UniquePaths(1, 1)` returns 1 because it is a 1x1 grid.

5. **Combining Results:**
   - `UniquePaths(2, 1) = UniquePaths(1, 1) + UniquePaths(2, 0) = 1 + 0 = 1`.
   - `UniquePaths(3, 1) = UniquePaths(2, 1) + UniquePaths(3, 0) = 1 + 0 = 1`.
   - `UniquePaths(1, 2) = UniquePaths(1, 1) + UniquePaths(0, 2) = 1 + 0 = 1`.
   - `UniquePaths(2, 2) = UniquePaths(2, 1) + UniquePaths(1, 2) = 1 + 1 = 2`.
   - `UniquePaths(3, 2) = UniquePaths(3, 1) + UniquePaths(2, 2) = 1 + 2 = 3`.

### Time Complexity Without Memoization

- **Time Complexity:** `O(2^(m + n))`  
  Without memoization, the recursive solution explores all possible paths, leading to an exponential number of recursive calls. Each call splits into two further calls (right and down), resulting in `2^(m + n)` calls in the worst case.

- **Space Complexity:** `O(m + n)`  
  The recursion stack can grow up to `m + n` levels deep, corresponding to the maximum depth of the recursion tree.

## Adding Memoization

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

## Bottom-Up (Iterative) Solution

```csharp
public class Solution {
    public int UniquePaths(int m, int n) {
        int[,] dp = new int[m, n];

        // Initialize the first row and first column to 1
        for (int i = 0; i < m; i++) dp[i, 0] = 1;
        for (int j = 0; j < n; j++) dp[0, j] = 1;

        // Fill the DP table
        for (int i = 1; i < m; i++) {
            for (int j = 1; j < n; j++) {
                dp[i, j] = dp[i - 1, j] + dp[i, j - 1];
            }
        }

        return dp[m - 1, n - 1];
    }
}
```

### Explanation

In the bottom-up (iterative) approach, we use a 2D array `dp` to store the number of unique paths to each cell in the grid. The value of `dp[i, j]` represents the number of unique paths to reach cell `(i, j)`.

1. **Initialization:**
   - The first row (`dp[0, j]`) and the first column (`dp[i, 0]`) are initialized to 1 because there is only one way to reach any cell in the first row (by moving right) or the first column (by moving down).

2. **Filling the DP Table:**
   - For each cell `(i, j)`, the number of unique paths is the sum of the unique paths from the cell above it (`dp[i - 1, j]`) and the cell to its left (`dp[i, j - 1]`).
   - Formula: `dp[i, j] = dp[i - 1, j] + dp[i, j - 1]`.

3. **Result:**
   - The value at the bottom-right corner of the grid (`dp[m - 1, n - 1]`) gives the total number of unique paths.

### Example Execution

For a 3x2 grid:

1. **Initialization:**
   ```
   dp = [
     [1, 1],
     [1, 0],
     [1, 0]
   ]
   ```

2. **Filling the DP Table:**
   - For cell `(1, 1)`: `dp[1, 1] = dp[0, 1] + dp[1, 0] = 1 + 1 = 2`.
   - For cell `(2, 1)`: `dp[2, 1] = dp[1, 1] + dp[2, 0] = 2 + 1 = 3`.

   Final DP table:
   ```
   dp = [
     [1, 1],
     [1, 2],
     [1, 3]
   ]
   ```

3. **Result:**
   - The value at `dp[2, 1]` is `3`, which is the total number of unique paths.

### Time Complexity

#### Top-Down (Recursive with Memoization):
- **Time Complexity:** `O(m * n)` because each subproblem is solved only once and stored in the memoization table.
- **Space Complexity:** `O(m * n)` for the memoization table, plus `O(m + n)` for the recursion stack.

#### Top-Down (Recursive without Memoization):
- **Time Complexity:** `O(2^(m + n))` due to the exponential growth of recursive calls.
- **Space Complexity:** `O(m + n)` for the recursion stack.

#### Bottom-Up (Iterative):
- **Time Complexity:** `O(m * n)` because we iterate through all cells in the grid.
- **Space Complexity:** `O(m * n)` for the DP table.

### Comparison

| Approach                       | Time Complexity | Space Complexity | Notes                                                                |
| ------------------------------ | --------------- | ---------------- | -------------------------------------------------------------------- |
| Top-Down (Without Memoization) | `O(2^(m + n))`  | `O(m + n)`       | Exponential growth due to redundant calculations.                    |
| Top-Down (With Memoization)    | `O(m * n)`      | `O(m * n)`       | Requires recursion and memoization. May have additional stack usage. |
| Bottom-Up                      | `O(m * n)`      | `O(m * n)`       | Iterative approach with no recursion overhead.                       |

In summary, the top-down approach without memoization is highly inefficient compared to the other two approaches. Memoization or the bottom-up approach is recommended for optimal performance.

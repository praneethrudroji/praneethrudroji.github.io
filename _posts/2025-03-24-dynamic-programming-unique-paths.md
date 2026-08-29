---
layout: post
title: Dynamic Programming - Unique Paths
description: The Unique Paths problem solved step by step - recursion, memoization, and bottom-up dynamic programming, with the reasoning that takes you from brute force to a fast, iterative solution.
date: 2025-03-24 23:35 +0530
categories: [algorithms, dynamic programming]
tags: [Dynamic Programming, Algorithms, Recursion, Memoization]
---

## The problem

There's a robot sitting on an m by n grid, starting in the top-left corner. It's trying to reach the bottom-right corner, and at every step it can only move down or right, never up or left, never diagonally.

Given the grid's dimensions, m and n, how many different paths can the robot take to get from start to finish?

![DP Robot Grid](/assets/img/dp-unique-paths.png)

## Working through it

The robot only ever moves right or down, so every path is really just a sequence of R's and D's. The question is how many distinct sequences actually land on the bottom-right corner.

Start with the base cases, since those anchor everything else. If either dimension is 0, there's no valid grid at all, so there are 0 paths, full stop. If the grid is a single cell, 1x1, the robot is already standing on the destination, so there's exactly one path: do nothing.

A tiny example makes the pattern click faster than a formula would. Take a 2x2 grid:

```
+---+---+
| S |   |
+---+---+
|   | E |
+---+---+
```

There are exactly two ways to get from S to E: right then down, or down then right. Two paths.

Now bump it up to a 3x2 grid:

```
+---+---+
| S |   |
+---+---+
|   |   |
+---+---+
|   | E |
+---+---+
```

Here's the trick that makes this a dynamic programming problem rather than just a counting exercise: think about the robot's very first move. If it moves down first, it's left with a 2x2 grid to solve, which we already know has 2 paths. If it moves right first, it's left with a 3x1 grid, a single column, which only has 1 path (straight down). Add those together and you get 2 + 1 = 3 total paths.

That's the whole idea in one sentence: the number of paths to any cell is the number of paths to the cell above it, plus the number of paths to the cell to its left. Everything below is just different ways of computing that.

## First attempt: plain recursion

The recursive formula falls straight out of the reasoning above. To reach cell (m, n), the robot had to arrive from either the cell above it, (m-1, n), or the cell to its left, (m, n-1). So the total paths to (m, n) is just the sum of the paths to those two cells.

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

Trace it through for a 3x2 grid and you can watch the recursion unfold. The call `UniquePaths(3, 2)` splits into `UniquePaths(3, 1)` and `UniquePaths(2, 2)`. Each of those splits again: `UniquePaths(3, 1)` becomes `UniquePaths(3, 0)` and `UniquePaths(2, 1)`, while `UniquePaths(2, 2)` becomes `UniquePaths(2, 1)` and `UniquePaths(1, 2)`. Keep unwinding and you eventually hit the base cases: anything with a 0 returns 0, and `UniquePaths(1, 1)` returns 1.

Working back up from there: `UniquePaths(2, 1) = 1 + 0 = 1`, `UniquePaths(3, 1) = 1 + 0 = 1`, `UniquePaths(1, 2) = 1 + 0 = 1`, `UniquePaths(2, 2) = 1 + 1 = 2`, and finally `UniquePaths(3, 2) = 1 + 2 = 3`. Same answer we got by hand above.

Notice something in that trace, though: `UniquePaths(2, 1)` got computed twice, once as a sub-call of `UniquePaths(3, 1)` and once as a sub-call of `UniquePaths(2, 2)`. That's not a coincidence, and it's about to become a real problem.

This version works, but it's slow. Without anything remembering past results, the recursion explores every possible path independently, and the number of calls grows exponentially with the grid size, roughly doubling with every extra row or column you add. For a small grid that's fine. For a large one, it grinds to a halt, because the same subproblems get recomputed over and over.

## Fixing it with memoization

The fix is almost embarrassingly simple once you've spotted the repeated work above: cache the answer to each `(m, n)` pair the first time you compute it, and just look it up if you're ever asked for it again.

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

This is the exact same recursion as before, with one line added: check the dictionary before doing any work, and write to it before returning. Now every distinct `(m, n)` pair only ever gets computed once, no matter how many times it shows up in the recursion tree. That turns the exponential blowup from before into something that scales cleanly with the size of the grid.

## Going bottom-up instead

Memoization fixes the performance problem, but you're still paying for recursion itself: a call stack, and the overhead of function calls going down before any answers come back up. The bottom-up version skips that entirely by building the answer from the smallest cases upward, using a plain table instead of recursive calls.

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

Here, `dp[i, j]` just means "the number of paths to reach cell (i, j)." The first row and first column both get initialized to 1, because there's only one way to reach any cell along the top edge (keep moving right) or the left edge (keep moving down). After that, every other cell is just the sum of the cell above it and the cell to its left, exactly the same relationship as before, just computed forward instead of backward.

Walk through a 3x2 grid to see it fill in. After initialization, the table looks like this:

```
dp = [
  [1, 1],
  [1, 0],
  [1, 0]
]
```

Fill in cell (1, 1): `dp[1,1] = dp[0,1] + dp[1,0] = 1 + 1 = 2`. Then cell (2, 1): `dp[2,1] = dp[1,1] + dp[2,0] = 2 + 1 = 3`. The finished table:

```
dp = [
  [1, 1],
  [1, 2],
  [1, 3]
]
```

The answer sits in the bottom-right corner, `dp[2, 1] = 3`, matching everything we've computed so far by hand and by recursion.

## So which one should you actually use

| Approach | Speed | Memory | Notes |
| --- | --- | --- | --- |
| Plain recursion | Exponential, gets slow fast | Small (just the call stack) | Fine for tiny grids, falls apart quickly as the grid grows |
| Recursion with memoization | Scales with grid size | A dictionary plus the call stack | Same idea as bottom-up, but still pays for recursion overhead |
| Bottom-up table | Scales with grid size | One table sized to the grid | No recursion at all, generally the fastest in practice |

The plain recursive version is the one to reach for only when you're first working out the logic by hand, since it maps directly onto the reasoning ("this path or that path"). The moment you'd actually run this on a real input, memoization or the bottom-up table are the two to pick between, and in practice I'd default to the bottom-up table: it does the exact same amount of work as the memoized version, without the overhead of a recursive call stack sitting underneath it.

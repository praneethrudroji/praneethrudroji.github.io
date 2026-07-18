---
layout: post
title: Async/Await Pitfalls in C# - Deadlocks, ConfigureAwait, and Fire-and-Forget
description: ConfigureAwait, sync-over-async deadlocks, async void, and fire-and-forget - the C# async/await pitfalls that bite production apps, with fixes.
date: 2026-07-11 11:00 +0530
categories: [backend, dotnet]
tags: [c#, .net, async, concurrency, dotnet]
---

## async/await isn't automatically "safe"

`async`/`await` in C# reads like ordinary sequential code, which is exactly what makes it easy to misuse. The compiler will happily let you write code that deadlocks, swallows exceptions, or runs synchronously despite every method being marked `async`. None of these are edge cases - they're the three mistakes that show up most often in real codebases, usually introduced by someone reasonably assuming `async` code behaves like the `sync` code it replaced.

## Pitfall 1: the classic deadlock

```csharp
public IActionResult GetOrder(int id)
{
    var order = _orderService.GetOrderAsync(id).Result; // blocks
    return Ok(order);
}
```

In an ASP.NET (classic, not Core) or Windows Presentation Foundation ([WPF](/glossary/#wpf))/WinForms context, this deadlocks under load. Here's why: `.Result` blocks the current thread waiting for the async method to complete. When `GetOrderAsync` hits its first `await`, by default it captures the current `SynchronizationContext` so it can resume back on that same context after the awaited work finishes. In ASP.NET classic, that context only allows one thread at a time. The calling thread is now blocked inside `.Result`, waiting for `GetOrderAsync` to finish - but `GetOrderAsync` can't resume, because resuming requires that same thread, which is busy blocking. Neither side can proceed.

The fix in application code is simple: don't block on async code. Make the caller `async` too, and `await` all the way up:

```csharp
public async Task<IActionResult> GetOrder(int id)
{
    var order = await _orderService.GetOrderAsync(id);
    return Ok(order);
}
```

ASP.NET Core has no `SynchronizationContext` by default, so this specific deadlock is less likely there - but `.Result`/`.Wait()` are still wrong to reach for: they turn a scalable async call into a thread-blocking one, defeating the reason to use async in the first place.

## Pitfall 2: ConfigureAwait(false), and when it actually matters

```csharp
public async Task<Order> GetOrderAsync(int id)
{
    var row = await _db.QuerySingleAsync<OrderRow>(sql, new { id }).ConfigureAwait(false);
    return MapToOrder(row);
}
```

`ConfigureAwait(false)` tells the awaited task not to bother resuming on the original `SynchronizationContext` - just continue on whatever thread pool thread happens to be free. In library code with no reason to care which thread runs next, this avoids the deadlock scenario above entirely (there's nothing to be waiting on) and skips a small amount of context-marshaling overhead.

It matters less in ASP.NET Core specifically, because there's no `SynchronizationContext` to capture in the first place - but it's still good practice in library/shared code that might be called from a context that does have one (a WPF app, a classic ASP.NET app, a console app someone wraps a context around). The practical rule: reusable library and infrastructure code should use `ConfigureAwait(false)` throughout; top-level application code that needs to get back onto a UI thread (WPF, WinForms, MAUI) should not.

## Pitfall 3: async void and fire-and-forget

```csharp
public async void ProcessOrder(int id) // async void
{
    await _orderService.ProcessAsync(id);
}
```

`async void` exists almost exclusively for event handlers, because event handler signatures can't be `async Task`. Everywhere else it's a trap: if `ProcessAsync` throws, the exception can't be awaited or caught by the caller - it's thrown directly on the `SynchronizationContext`, which in ASP.NET typically crashes the process instead of failing the one request. `async Task` methods, by contrast, capture the exception on the returned `Task` where a caller can observe it.

The other version of this mistake is discarding a `Task` without an `async void` in sight:

```csharp
_ = _orderService.ProcessAsync(id); // fire-and-forget, exception goes nowhere useful
```

This doesn't crash the process, but any exception from `ProcessAsync` ends up on a `Task` nobody observes - it's raised on the finalizer thread as an `UnobservedTaskException`, logged nowhere by default, and easy to miss entirely in production until data quietly stops being processed. If fire-and-forget is genuinely the intent (a background job that shouldn't block the caller), wrap it so failures are still visible:

```csharp
_ = Task.Run(async () =>
{
    try
    {
        await _orderService.ProcessAsync(id);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Background order processing failed for {OrderId}", id);
    }
});
```

## A smaller one: Task.Run for the wrong kind of work

`Task.Run` schedules work onto the thread pool - it's for CPU-bound work you want off the current thread. Wrapping an already-async I/O call in `Task.Run` doesn't parallelize anything useful; it just burns a thread pool thread waiting on a call that was already non-blocking:

```csharp
// unnecessary - GetOrderAsync is already async I/O
var order = await Task.Run(() => _orderService.GetOrderAsync(id));

// correct - just await it directly
var order = await _orderService.GetOrderAsync(id);
```

`Task.Run` earns its keep for genuine CPU-bound work (image processing, heavy serialization, hashing) that you want to move off a request thread - not as a generic wrapper for anything that returns a `Task`.

## The short version

- Never block on async code with `.Result` or `.Wait()` - `await` all the way up the call stack instead.
- Use `ConfigureAwait(false)` in library/infrastructure code; skip it in UI code that needs the original context back.
- Never use `async void` outside event handlers; never discard a `Task` without at least logging its failure.
- Reach for `Task.Run` for CPU-bound work, not as a wrapper around code that's already asynchronous.

Every one of these compiles cleanly and looks correct at a glance - which is exactly why they survive code review and show up as production incidents instead.

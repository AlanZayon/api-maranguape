using System.Collections.Concurrent;
using System.Diagnostics;

namespace Organograma.Api.Middleware;

public sealed class MetricsCollector
{
    private readonly ConcurrentDictionary<string, PathStats> _byPath = new();
    private readonly ConcurrentDictionary<string, long> _byStatus = new();
    private long _total;
    private readonly Stopwatch _uptime = Stopwatch.StartNew();

    private sealed class PathStats
    {
        public long Count;
        public long TotalMs;
    }

    public void Record(string method, string path, int statusCode, long elapsedMs)
    {
        Interlocked.Increment(ref _total);
        var status = statusCode.ToString();
        _byStatus.AddOrUpdate(status, 1, (_, n) => n + 1);
        var key = $"{method} {path}";
        _byPath.AddOrUpdate(
            key,
            _ => new PathStats { Count = 1, TotalMs = elapsedMs },
            (_, stats) =>
            {
                Interlocked.Increment(ref stats.Count);
                Interlocked.Add(ref stats.TotalMs, elapsedMs);
                return stats;
            });
    }

    public object GetSnapshot()
    {
        var paths = new Dictionary<string, object>();
        foreach (var (key, val) in _byPath)
        {
            paths[key] = new
            {
                count = val.Count,
                avgMs = val.Count > 0 ? (long)Math.Round((double)val.TotalMs / val.Count) : 0L,
            };
        }

        return new
        {
            total = Interlocked.Read(ref _total),
            byStatus = _byStatus.ToDictionary(kv => kv.Key, kv => kv.Value),
            byPath = paths,
            uptime = _uptime.Elapsed.TotalSeconds,
        };
    }
}

public sealed class MetricsMiddleware(RequestDelegate next, MetricsCollector metrics)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var start = Stopwatch.GetTimestamp();
        var pathKey = context.Request.Path.Value ?? "/";

        try
        {
            await next(context);
        }
        finally
        {
            var elapsedMs = (long)Stopwatch.GetElapsedTime(start).TotalMilliseconds;
            metrics.Record(context.Request.Method, pathKey, context.Response.StatusCode, elapsedMs);
        }
    }
}

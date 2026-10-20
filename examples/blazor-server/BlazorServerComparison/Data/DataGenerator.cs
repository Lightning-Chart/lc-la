namespace BlazorServerComparison.Data;

/// <summary>
/// A client-neutral XY dataset. Chart.js can format X as labels, while LCLA can
/// consume the numeric X and Y arrays directly.
/// </summary>
public sealed record LineChartData(double[] X, double[] Y);

/// <summary>
/// Produces deterministic line-chart data for both static and real-time tests.
/// Create a separate instance for each test so every chart receives the same
/// sequence when the same seed and starting index are used.
/// </summary>
public sealed class DataGenerator
{
    private readonly Random _random;
    private long _nextIndex;

    public DataGenerator(int seed = 42, long startIndex = 0)
    {
        _random = new Random(seed);
        _nextIndex = startIndex;
    }

    /// <summary>
    /// Generates the next batch and advances the generator. X is elapsed time
    /// in seconds at a 100 Hz sampling rate. Y is a sine signal plus noise.
    /// </summary>
    public LineChartData NextBatch(int sampleCount)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(sampleCount);

        var x = new double[sampleCount];
        var y = new double[sampleCount];

        for (var i = 0; i < sampleCount; i++)
        {
            var sampleIndex = _nextIndex++;
            var seconds = sampleIndex * 0.01;

            x[i] = seconds;
            y[i] = Math.Sin(seconds * 2 * Math.PI)
                   + (_random.NextDouble() - 0.5) * 0.15;
        }

        return new LineChartData(x, y);
    }

    /// <summary>
    /// Convenience method for an independently reproducible historical set.
    /// </summary>
    public static LineChartData CreateHistorical(int sampleCount = 10_000, int seed = 42)
    {
        return new DataGenerator(seed).NextBatch(sampleCount);
    }
}

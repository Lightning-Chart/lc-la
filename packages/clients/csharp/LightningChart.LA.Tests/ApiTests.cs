using System.Text.Json;
using System.Net.Http;
using LightningChart.LA.Api;
using LightningChart.LA.Bij;
using LightningChart.LA.WebView;

namespace LightningChart.LA.Tests;

/// <summary>
/// Tests for the high-level API using a mock transport.
/// Verifies that the API produces correct BIJ messages.
/// </summary>
public class ApiTests
{
    [Fact]
    public async Task WebViewTransport_StartsLocalChartPage()
    {
        await using var transport = await WebViewTransport.StartAsync();

        Assert.Equal("http", transport.Uri.Scheme);
        Assert.Equal("127.0.0.1", transport.Uri.Host);
        Assert.True(transport.Uri.Port > 0);
    }

    [Fact]
    public async Task WebViewTransport_ConnectsWithBinaryHttp()
    {
        await using var transport = await WebViewTransport.StartAsync();
        using var client = new HttpClient();

        var message = BijEncoder.Encode([BijPart.Json("meta", new { id = "test", category = "lifecycle", action = "init" })]);
        var send = transport.SendAsync(message);
        var received = await client.GetByteArrayAsync(new Uri(transport.Uri, "lcla-poll"));

        Assert.Equal(message, received);
        using var content = new ByteArrayContent(received);
        var posted = await client.PostAsync(new Uri(transport.Uri, "lcla-response"), content);
        posted.EnsureSuccessStatusCode();

        var response = await send;
        Assert.Equal(message, response);
    }

    [Fact]
    public async Task WebViewTransport_PropagatesWebViewErrors()
    {
        await using var transport = await WebViewTransport.StartAsync();
        using var client = new HttpClient();
        Exception? reported = null;
        transport.ErrorOccurred += (_, args) => reported = args.Exception;

        var pending = transport.SendAsync(BijEncoder.Encode([BijPart.Json("meta", new { id = "test", category = "lifecycle", action = "init" })]));
        _ = await client.GetByteArrayAsync(new Uri(transport.Uri, "lcla-poll"));
        using var content = new StringContent("ReferenceError: WebGL unavailable");
        var posted = await client.PostAsync(new Uri(transport.Uri, "lcla-error"), content);
        posted.EnsureSuccessStatusCode();

        var exception = await Assert.ThrowsAsync<LclaException>(() => pending);
        Assert.Equal(LclaErrorCategory.Host, exception.Category);
        Assert.Contains("WebGL unavailable", exception.Message);
        Assert.NotNull(reported);
        Assert.Contains("WebGL unavailable", reported!.Message);
    }

    private class MockTransport : ILclaTransport
    {
        public List<byte[]> SentMessages { get; } = new();
        public List<byte[]> FireAndForgetMessages { get; } = new();

        private int _chartCounter;

        public Task<byte[]> SendAsync(byte[] message, CancellationToken ct = default)
        {
            SentMessages.Add(message);
            var decoded = BijDecoder.Decode(message);
            var meta = (JsonElement)decoded["meta"];

            var action = meta.GetProperty("action").GetString();

            // Simulate host responses
            object response = action switch
            {
                "create" => new { id = meta.GetProperty("id").GetString()!, type = "response", result = new { chartId = $"chart-{++_chartCounter}" } },
                "init" => new { id = meta.GetProperty("id").GetString()!, type = "response" },
                _ => new { id = meta.GetProperty("id").GetString()!, type = "response" },
            };

            var responseBytes = BijEncoder.Encode([BijPart.Json("meta", response)]);
            return Task.FromResult(responseBytes);
        }

        public void SendFireAndForget(byte[] message)
        {
            FireAndForgetMessages.Add(message);
        }

        public void DiscardPending() { }
    }

    [Fact]
    public async Task CreateChart_SendsLifecycleCreate()
    {
        var transport = new MockTransport();
        var client = new LclaContext(transport, new LclaLicense { Key = "test-license" });

        var chart = await client.CreateChartAsync();

        // First message is init (SendAsync), second is create (SendAsync)
        Assert.Equal(2, transport.SentMessages.Count);
        var initDecoded = BijDecoder.Decode(transport.SentMessages[0]);
        var initMeta = (JsonElement)initDecoded["meta"];
        Assert.Equal("lifecycle", initMeta.GetProperty("category").GetString());
        Assert.Equal("init", initMeta.GetProperty("action").GetString());
        var licenseInformation = initMeta.GetProperty("params").GetProperty("licenseInformation");
        Assert.Equal("LightningChart JS Trial", licenseInformation.GetProperty("appTitle").GetString());
        Assert.Equal("LightningChart Ltd.", licenseInformation.GetProperty("company").GetString());

        var decoded = BijDecoder.Decode(transport.SentMessages[1]);
        var meta = (JsonElement)decoded["meta"];
        Assert.Equal("lifecycle", meta.GetProperty("category").GetString());
        Assert.Equal("create", meta.GetProperty("action").GetString());
        Assert.NotNull(chart.ChartId);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    [InlineData(null)]
    public async Task CreateChart_SerializesLegendVisibility(bool? legendVisible)
    {
        var transport = new MockTransport();
        var context = new LclaContext(transport, new LclaLicense { Key = "test-license" });

        await context.CreateChartAsync(new XYChartConfig
        {
            LegendVisible = legendVisible,
        });

        var decoded = BijDecoder.Decode(transport.SentMessages.Last());
        var meta = (JsonElement)decoded["meta"];
        var options = meta.GetProperty("params");

        if (legendVisible.HasValue)
        {
            Assert.Equal(
                legendVisible.Value,
                options.GetProperty("legendVisible").GetBoolean());
        }
        else
        {
            Assert.False(options.TryGetProperty("legendVisible", out _));
        }
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    [InlineData(null)]
    public async Task Update_SerializesLegendVisibility(bool? legendVisible)
    {
        var transport = new MockTransport();
        var context = new LclaContext(transport, new LclaLicense { Key = "test-license" });

        var chart = await context.CreateChartAsync();

        chart.Update(new UpdateXYChartConfig
        {
            Title = "Updated title",
            LegendVisible = legendVisible,
        });

        var decoded = BijDecoder.Decode(Assert.Single(transport.FireAndForgetMessages));
        var meta = (JsonElement)decoded["meta"];
        var options = meta.GetProperty("params");

        Assert.Equal("update", meta.GetProperty("action").GetString());

        if (legendVisible.HasValue)
        {
            Assert.Equal(
                legendVisible.Value,
                options.GetProperty("legendVisible").GetBoolean());
        }
        else
        {
            Assert.False(options.TryGetProperty("legendVisible", out _));
        }
    }

    [Fact]
    public async Task CreateChart_QueuesSeriesAfterSharedDataSetConfiguration()
    {
        var transport = new MockTransport();
        var context = new LclaContext(transport, new LclaLicense { Key = "test-license" });

        context.ConfigureDataSets(
        [
            new DataSetConfig
            {
                Id = "telemetry",
                Columns =
                [
                    new DataSetColumnConfig { Id = "time" },
                    new DataSetColumnConfig { Id = "speed" },
                ],
            },
        ]);

        var chart = await context.CreateChartAsync(new XYChartConfig
        {
            Series =
            [
                new LineSeriesConfig
                {
                    Id = "speed",
                    DataSetId = "telemetry",
                    X = "time",
                    Y = "speed",
                },
            ],
        });

        // Chart creation does not create series ahead of queued datasets.
        var create = (JsonElement)BijDecoder.Decode(transport.SentMessages.Last())["meta"];
        Assert.False(create.GetProperty("params").TryGetProperty("series", out _));

        // The shared dataset and its series use the same queue, in that order.
        Assert.Equal(2, transport.FireAndForgetMessages.Count);

        var dataset = (JsonElement)BijDecoder.Decode(transport.FireAndForgetMessages[0])["meta"];
        Assert.Equal("datasets", dataset.GetProperty("action").GetString());
        Assert.Equal(
            "telemetry",
            dataset.GetProperty("params").GetProperty("datasets")[0].GetProperty("id").GetString()
        );

        var update = (JsonElement)BijDecoder.Decode(transport.FireAndForgetMessages[1])["meta"];
        Assert.Equal("update", update.GetProperty("action").GetString());
        Assert.Equal(chart.ChartId, update.GetProperty("chartId").GetString());
        Assert.Equal(
            "telemetry",
            update.GetProperty("params").GetProperty("series")[0].GetProperty("dataSetId").GetString()
        );
    }

    [Fact]
    public async Task CreateChart_WithConfig_SendsDataSetsAxesAndSeries()
    {
        var transport = new MockTransport();
        var client = new LclaContext(transport, new LclaLicense { Key = "test-license" });

        var chart = await client.CreateChartAsync(new XYChartConfig
        {
            Title = "Test",
            DataSets = [
                new DataSetConfig
                {
                    Id = "ds1",
                    Columns = [
                        new DataSetColumnConfig { Id = "time" },
                        new DataSetColumnConfig { Id = "temperature" },
                    ],
                },
            ],
            Axes = [
                new AxisConfig 
                {
                    Id = "time-axis",
                    Axis = AxisTarget.X,
                    Opposite = true,
                },
                new AxisConfig
                {
                    Id = "temperature-axis",
                    Axis = AxisTarget.Y,
                    Opposite = true,
                },
            ],
            Series = [
                new LineSeriesConfig
                {
                    Id = "temperature-series",
                    DataSetId = "ds1",
                    X = "time",
                    Y = "temperature",
                    XAxisId = "time-axis",
                    YAxisId = "temperature-axis",
                    Name = "Temp",
                    Color = "#ff0000",
                },
            ],
        });

        // Chart and axis settings are sent during creation.
        Assert.Equal(2, transport.SentMessages.Count);

        var decoded = BijDecoder.Decode(transport.SentMessages[1]);
        var meta = (JsonElement)decoded["meta"];
        Assert.Equal("lifecycle", meta.GetProperty("category").GetString());
        Assert.Equal("create", meta.GetProperty("action").GetString());

        var options = meta.GetProperty("params");
        Assert.False(options.TryGetProperty("title", out _));
        Assert.False(options.TryGetProperty("dataSets", out _));
        Assert.False(options.TryGetProperty("series", out _));

        var axes = options.GetProperty("axes");
        Assert.Equal(2, axes.GetArrayLength());
        Assert.Equal("x", axes[0].GetProperty("axis").GetString());
        Assert.True(axes[0].GetProperty("opposite").GetBoolean());
        Assert.Equal("y", axes[1].GetProperty("axis").GetString());
        Assert.True(axes[1].GetProperty("opposite").GetBoolean());

        // Title, datasets, and series are queued in that order.
        Assert.Equal(3, transport.FireAndForgetMessages.Count);

        var updates = transport.FireAndForgetMessages
            .Select(message => (JsonElement)BijDecoder.Decode(message)["meta"])
            .ToArray();
        foreach (var update in updates)
        {
            Assert.Equal("config", update.GetProperty("category").GetString());
            Assert.Equal("update", update.GetProperty("action").GetString());
            Assert.Equal(chart.ChartId, update.GetProperty("chartId").GetString());
        }
        Assert.Equal("Test", updates[0].GetProperty("params").GetProperty("title").GetString());

        var dataSetOptions = updates[1].GetProperty("params");
        var seriesOptions = updates[2].GetProperty("params");
        var dataSets = dataSetOptions.GetProperty("dataSets");
        Assert.Equal(1, dataSets.GetArrayLength());
        Assert.Equal("ds1", dataSets[0].GetProperty("id").GetString());
        Assert.Equal(2, dataSets[0].GetProperty("columns").GetArrayLength());

        var series = seriesOptions.GetProperty("series")[0];
        Assert.Equal("line", series.GetProperty("type").GetString());
        Assert.Equal("ds1", series.GetProperty("dataSetId").GetString());
        Assert.Equal("time", series.GetProperty("x").GetString());
        Assert.Equal("temperature", series.GetProperty("y").GetString());
        Assert.Equal("time-axis", series.GetProperty("xAxisId").GetString());
        Assert.Equal("temperature-axis", series.GetProperty("yAxisId").GetString());
    }

    [Theory]
    [InlineData(AxisTarget.X, "x")]
    [InlineData(AxisTarget.Y, "y")]
    public async Task CreateChart_SendsAxisSettings(AxisTarget axis, string orientation)
    {
        var transport = new MockTransport();
        var client = new LclaContext(transport, new LclaLicense { Key = "test-license" });

        await client.CreateChartAsync(new XYChartConfig
        {
            Axes =
            [
                new AxisConfig
                {
                    Axis = axis,
                    Title = "Axis title",
                    Opposite = true,
                    StackIndex = -1,
                    ParallelIndex = 2,
                    Interval = new AxisIntervalConfig
                    {
                        Start = 0,
                        End = 100,
                        StopAxisAfter = false,
                    },
                    TickStrategy = TickStrategy.Numeric,
                    ScrollStrategy = ScrollStrategy.Scrolling,
                },
            ],
        });

        var decoded = BijDecoder.Decode(transport.SentMessages.Last());
        var meta = (JsonElement)decoded["meta"];
        var options = meta.GetProperty("params").GetProperty("axes")[0];

        Assert.Equal(orientation, options.GetProperty("axis").GetString());
        Assert.Equal("Axis title", options.GetProperty("title").GetString());
        Assert.True(options.GetProperty("opposite").GetBoolean());
        Assert.Equal(-1, options.GetProperty("stackIndex").GetInt32());
        Assert.Equal(2, options.GetProperty("parallelIndex").GetInt32());
        Assert.Equal("numeric", options.GetProperty("tickStrategy").GetString());
        Assert.Equal("scrolling", options.GetProperty("scrollStrategy").GetString());
        Assert.False(options.TryGetProperty("id", out _));

        var interval = options.GetProperty("interval");
        Assert.Equal(0d, interval.GetProperty("start").GetDouble());
        Assert.Equal(100d, interval.GetProperty("end").GetDouble());
        Assert.False(interval.GetProperty("stopAxisAfter").GetBoolean());
        Assert.False(interval.TryGetProperty("animate", out _));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Update_SendsAxisSelectionAndTitle(bool useId)
    {
        var transport = new MockTransport();
        var client = new LclaContext(transport, new LclaLicense { Key = "test-license" });

        var chart = await client.CreateChartAsync(new XYChartConfig
        {
            Axes =
            [
                new AxisConfig
                {
                    Axis = AxisTarget.Y,
                    Id = useId ? "axis-1" : null,
                    Title = "Original title",
                },
            ],
        });

        chart.Update(new UpdateXYChartConfig
        {
            Axes =
            [
                new UpdateAxisConfig
                {
                    Axis = useId ? null : AxisTarget.Y,
                    Id = useId ? "axis-1" : null,
                    Title = "",
                },
            ],
        });

        var decoded = BijDecoder.Decode(Assert.Single(transport.FireAndForgetMessages));
        var meta = (JsonElement)decoded["meta"];

        Assert.Equal("config", meta.GetProperty("category").GetString());
        Assert.Equal("update", meta.GetProperty("action").GetString());
        Assert.Equal(chart.ChartId, meta.GetProperty("chartId").GetString());

        var options = meta.GetProperty("params");
        Assert.False(options.TryGetProperty("title", out _));
        Assert.False(options.TryGetProperty("dataSets", out _));
        Assert.False(options.TryGetProperty("series", out _));

        var axes = options.GetProperty("axes");
        Assert.Equal(1, axes.GetArrayLength());

        var axis = axes[0];
        Assert.Equal("", axis.GetProperty("title").GetString());
        Assert.False(axis.TryGetProperty("opposite", out _));
        Assert.False(axis.TryGetProperty("remove", out _));

        if (useId)
        {
            Assert.Equal("axis-1", axis.GetProperty("id").GetString());
            Assert.False(axis.TryGetProperty("axis", out _));
        }
        else
        {
            Assert.Equal("y", axis.GetProperty("axis").GetString());
            Assert.False(axis.TryGetProperty("id", out _));
        }
    }

    [Fact]
    public async Task SetData_SendsBijWithNamedColumns()
    {
        var transport = new MockTransport();
        var client = new LclaContext(transport, new LclaLicense { Key = "test-license" });
        var chart = await client.CreateChartAsync();

        var columns = new Dictionary<string, double[]>
        {
            ["time"] = [1.0, 2.0, 3.0],
            ["temperature"] = [10.0, 20.0, 30.0],
            ["humidity"] = [40.0, 50.0, 60.0],
        };
        chart.SetData(new SetDataOptions { DataSetId = "sensors", Columns = columns });

        var lastMsg = transport.FireAndForgetMessages.Last();
        var decoded = BijDecoder.Decode(lastMsg);
        var meta = (JsonElement)decoded["meta"];
        Assert.Equal("data", meta.GetProperty("category").GetString());
        Assert.Equal("set", meta.GetProperty("action").GetString());
        Assert.Equal("sensors", meta.GetProperty("dataSetId").GetString());

        var decodedTime = (double[])decoded["time"];
        Assert.Equal(columns["time"], decodedTime);
        var decodedTemp = (double[])decoded["temperature"];
        Assert.Equal(columns["temperature"], decodedTemp);
        var decodedHumid = (double[])decoded["humidity"];
        Assert.Equal(columns["humidity"], decodedHumid);
    }

    [Fact]
    public async Task AppendData_UsesFireAndForget()
    {
        var transport = new MockTransport();
        var client = new LclaContext(transport, new LclaLicense { Key = "test-license" });
        var chart = await client.CreateChartAsync();

        var columns = new Dictionary<string, double[]>
        {
            ["time"] = [1.0, 2.0],
            ["temperature"] = [10.0, 20.0],
        };
        chart.AppendData(new AppendDataOptions { DataSetId = "sensors", Columns = columns });

        // SetData + AppendData both go through FireAndForget
        var appendMsg = transport.FireAndForgetMessages.Last();
        var decoded = BijDecoder.Decode(appendMsg);
        var meta = (JsonElement)decoded["meta"];
        Assert.Equal("data", meta.GetProperty("category").GetString());
        Assert.Equal("append", meta.GetProperty("action").GetString());
        Assert.Equal("sensors", meta.GetProperty("dataSetId").GetString());
        Assert.Equal(columns["time"], (double[])decoded["time"]);
        Assert.Equal(columns["temperature"], (double[])decoded["temperature"]);
    }

    [Fact]
    public async Task DisposeContext_SendsDatasetCleanupAfterChartDisposal()
    {
        var transport = new MockTransport();
        var client = new LclaContext(
            transport,
            new LclaLicense { Key = "test-license" });

        var firstChart = await client.CreateChartAsync();
        var secondChart = await client.CreateChartAsync();
        transport.FireAndForgetMessages.Clear();

        await client.DisposeAsync();

        var messages = transport.FireAndForgetMessages
            .Select(message => (JsonElement)BijDecoder.Decode(message)["meta"])
            .ToArray();

        Assert.Equal(3, messages.Length);

        var clientId = messages[0].GetProperty("clientId").GetString();

        Assert.All(messages, message =>
        {
            Assert.Equal("lifecycle", message.GetProperty("category").GetString());
            Assert.Equal("dispose", message.GetProperty("action").GetString());
            Assert.Equal(clientId, message.GetProperty("clientId").GetString());
        });

        Assert.Equal(firstChart.ChartId, messages[0].GetProperty("chartId").GetString());
        Assert.Equal(secondChart.ChartId, messages[1].GetProperty("chartId").GetString());
        Assert.False(messages[2].TryGetProperty("chartId", out _));
    }

    [Fact]
    public async Task DisposeChart_SendsLifecycleDispose()
    {
        var transport = new MockTransport();
        var client = new LclaContext(transport, new LclaLicense { Key = "test-license" });
        var chart = await client.CreateChartAsync();

        await chart.DisposeAsync();

        var lastMsg = transport.FireAndForgetMessages.Last();
        var decoded = BijDecoder.Decode(lastMsg);
        var meta = (JsonElement)decoded["meta"];
        Assert.Equal("lifecycle", meta.GetProperty("category").GetString());
        Assert.Equal("dispose", meta.GetProperty("action").GetString());
    }

    [Theory]
    [InlineData(ScrollDimension.Columns, "columns")]
    [InlineData(ScrollDimension.Rows, "rows")]
    public async Task CreateChart_SendsScrollingHeatmapConfiguration(
        ScrollDimension dimension, string expectedDimension)
    {
        var transport = new MockTransport();
        var context = new LclaContext(transport, new LclaLicense { Key = "test-license" });

        var chart = await context.CreateChartAsync(new XYChartConfig
        {
            Axes =
            [
                new AxisConfig { Id = "axis-x", Axis = AxisTarget.X },
                new AxisConfig { Id = "axis-y", Axis = AxisTarget.Y },
            ],
            Series =
            [
                new ScrollingHeatmapSeriesConfig
                {
                    Id = "heatmap",
                    Name = "Intensity",
                    Resolution = 3,
                    ScrollDimension = dimension,
                    XAxisId = "axis-x",
                    YAxisId = "axis-y",
                    Start = new PointConfig { X = 0, Y = 0 },
                    Step = new PointConfig { X = 2, Y = 5 },
                    DataCleaning = new DataCleaningConfig { MinDataPointCount = 1000 },
                    Palette = new PaletteConfig
                    {
                        Steps =
                        [
                            new PaletteStepConfig { Value = 0, Color = "#0000FF" },
                            new PaletteStepConfig { Value = 100, Color = "#FF0000" },
                        ],
                        Interpolate = true,
                    },
                },
            ],
        });

        var decoded = BijDecoder.Decode(Assert.Single(transport.FireAndForgetMessages));
        var meta = (JsonElement)decoded["meta"];

        Assert.Equal("config", meta.GetProperty("category").GetString());
        Assert.Equal("update", meta.GetProperty("action").GetString());
        Assert.Equal(chart.ChartId, meta.GetProperty("chartId").GetString());

        var options = meta.GetProperty("params");
        Assert.False(options.TryGetProperty("dataSets", out _));

        var series = options.GetProperty("series")[0];
        Assert.Equal("heatmap", series.GetProperty("id").GetString());
        Assert.Equal("scrollingHeatmap", series.GetProperty("type").GetString());
        Assert.Equal("Intensity", series.GetProperty("name").GetString());
        Assert.Equal(3, series.GetProperty("resolution").GetInt32());
        Assert.Equal(expectedDimension, series.GetProperty("scrollDimension").GetString());
        Assert.Equal("axis-x", series.GetProperty("xAxisId").GetString());
        Assert.Equal("axis-y", series.GetProperty("yAxisId").GetString());
        Assert.False(series.TryGetProperty("dataSetId", out _));

        var start = series.GetProperty("start");
        Assert.Equal(0d, start.GetProperty("x").GetDouble());
        Assert.Equal(0d, start.GetProperty("y").GetDouble());

        var step = series.GetProperty("step");
        Assert.Equal(2d, step.GetProperty("x").GetDouble());
        Assert.Equal(5d, step.GetProperty("y").GetDouble());
        Assert.Equal(1000, series.GetProperty("dataCleaning").GetProperty("minDataPointCount").GetInt32());

        var palette = series.GetProperty("palette");
        Assert.True(palette.GetProperty("interpolate").GetBoolean());

        var steps = palette.GetProperty("steps");
        Assert.Equal(2, steps.GetArrayLength());
        Assert.Equal(0d, steps[0].GetProperty("value").GetDouble());
        Assert.Equal("#0000FF", steps[0].GetProperty("color").GetString());
        Assert.Equal(100d, steps[1].GetProperty("value").GetDouble());
        Assert.Equal("#FF0000", steps[1].GetProperty("color").GetString());
    }

    [Fact]
    public async Task Update_SendsScrollingHeatmapSettingsAndRemoval()
    {
        var transport = new MockTransport();
        var context = new LclaContext(transport, new LclaLicense { Key = "test-license" });

        var chart = await context.CreateChartAsync(new XYChartConfig
        {
            Series =
            [
                new ScrollingHeatmapSeriesConfig
                {
                    Id = "heatmap",
                    Resolution = 3,
                    ScrollDimension = ScrollDimension.Columns,
                },
            ],
        });

        var creationMeta = (JsonElement)BijDecoder.Decode(
            Assert.Single(transport.FireAndForgetMessages))["meta"];

        Assert.False(
            creationMeta.GetProperty("params").GetProperty("series")[0]
                .TryGetProperty("dataCleaning", out _));

        chart.Update(new UpdateXYChartConfig
        {
            Series =
            [
                new UpdateScrollingHeatmapSeriesConfig
                {
                    Id = "heatmap",
                    Name = "",
                    Start = new PointConfig { X = 0, Y = 10 },
                    DataCleaning = new DataCleaningConfig { MinDataPointCount = 2000 },
                    Palette = new PaletteConfig
                    {
                        Steps =
                        [
                            new PaletteStepConfig { Value = 0, Color = "#000000" },
                            new PaletteStepConfig { Value = 100, Color = "#FFFFFF" },
                        ],
                        Interpolate = false,
                    },
                },
            ],
        });

        var decoded = BijDecoder.Decode(transport.FireAndForgetMessages.Last());
        var meta = (JsonElement)decoded["meta"];
        var series = meta.GetProperty("params").GetProperty("series")[0];
        Assert.Equal("scrollingHeatmap", series.GetProperty("type").GetString());
        Assert.Equal("", series.GetProperty("name").GetString());
        Assert.Equal(0d, series.GetProperty("start").GetProperty("x").GetDouble());
        Assert.Equal(10d, series.GetProperty("start").GetProperty("y").GetDouble());
        Assert.Equal(2000, series.GetProperty("dataCleaning").GetProperty("minDataPointCount").GetInt32());

        var palette = series.GetProperty("palette");
        Assert.False(palette.GetProperty("interpolate").GetBoolean());

        var steps = palette.GetProperty("steps");
        Assert.Equal(2, steps.GetArrayLength());
        Assert.Equal(0d, steps[0].GetProperty("value").GetDouble());
        Assert.Equal("#000000", steps[0].GetProperty("color").GetString());
        Assert.Equal(100d, steps[1].GetProperty("value").GetDouble());
        Assert.Equal("#FFFFFF", steps[1].GetProperty("color").GetString());

        foreach (var property in new[] {
            "resolution", "scrollDimension", "xAxisId", "yAxisId", "step", "remove",
        })
        {
            Assert.False(series.TryGetProperty(property, out _));
        }

        chart.Update(new UpdateXYChartConfig
        {
            Series =
            [
                new UpdateScrollingHeatmapSeriesConfig
                {
                    Id = "heatmap",
                    Remove = true,
                },
            ],
        });

        var removalDecoded = BijDecoder.Decode(transport.FireAndForgetMessages.Last());
        var removalMeta = (JsonElement)removalDecoded["meta"];
        var removal = removalMeta.GetProperty("params").GetProperty("series")[0];

        Assert.Equal("heatmap", removal.GetProperty("id").GetString());
        Assert.Equal("scrollingHeatmap", removal.GetProperty("type").GetString());
        Assert.True(removal.GetProperty("remove").GetBoolean());
        Assert.False(removal.TryGetProperty("name", out _));
        Assert.False(removal.TryGetProperty("start", out _));
        Assert.False(removal.TryGetProperty("dataCleaning", out _));
    }

    [Fact]
    public async Task Update_SendsScatterColorByAndPalette()
    {
        var transport = new MockTransport();
        var context = new LclaContext(transport, new LclaLicense { Key = "test-license" });
        var chart = await context.CreateChartAsync();
        transport.FireAndForgetMessages.Clear();

        chart.Update(new UpdateXYChartConfig
        {
            Series =
            [
                new ScatterSeriesConfig
                {
                    Id = "scatter",
                    DataSetId = "measurements",
                    X = "time",
                    Y = "pressure",
                    ColorBy = "temperature",
                    Palette = new PaletteConfig
                    {
                        Steps =
                        [
                            new PaletteStepConfig { Value = 0, Color = "#0000FF" },
                            new PaletteStepConfig { Value = 100, Color = "#FF0000" },
                        ],
                    },
                },
            ],
        });

        var decoded = BijDecoder.Decode(Assert.Single(transport.FireAndForgetMessages));
        var meta = (JsonElement)decoded["meta"];
        var series = meta.GetProperty("params").GetProperty("series")[0];
        Assert.Equal("scatter", series.GetProperty("type").GetString());
        Assert.Equal("temperature", series.GetProperty("colorBy").GetString());

        var palette = series.GetProperty("palette");
        Assert.False(palette.TryGetProperty("interpolate", out _));

        var steps = palette.GetProperty("steps");
        Assert.Equal(2, steps.GetArrayLength());
        Assert.Equal(0d, steps[0].GetProperty("value").GetDouble());
        Assert.Equal("#0000FF", steps[0].GetProperty("color").GetString());
        Assert.Equal(100d, steps[1].GetProperty("value").GetDouble());
        Assert.Equal("#FF0000", steps[1].GetProperty("color").GetString());
    }

    [Fact]
    public async Task ClearMatrixData_SendsOnlyMetadataBySeriesId()
    {
        var transport = new MockTransport();
        var client = new LclaContext(transport, new LclaLicense { Key = "test-license" });
        var chart = await client.CreateChartAsync();

        transport.FireAndForgetMessages.Clear();

        chart.ClearMatrixData(new ClearMatrixDataOptions
        {
            SeriesId = "heatmap",
        });

        var decoded = BijDecoder.Decode(Assert.Single(transport.FireAndForgetMessages));
        var meta = (JsonElement)decoded["meta"];
        Assert.Single(decoded);
        Assert.Equal("data", meta.GetProperty("category").GetString());
        Assert.Equal("clearMatrix", meta.GetProperty("action").GetString());
        Assert.Equal(chart.ChartId, meta.GetProperty("chartId").GetString());
        Assert.Equal("heatmap", meta.GetProperty("seriesId").GetString());
        Assert.False(string.IsNullOrEmpty(meta.GetProperty("clientId").GetString()));
        Assert.False(meta.TryGetProperty("params", out _));
    }

    [Fact]
    public async Task SetMatrixData_SendsFlatFloat32ValuesBySeriesId()
    {
        var transport = new MockTransport();
        var client = new LclaContext(transport, new LclaLicense { Key = "test-license" });
        var chart = await client.CreateChartAsync();

        var values = new float[] { 1, 2, 3, 4, 5, 6 };
        chart.SetMatrixData(new SetMatrixDataOptions { SeriesId = "heatmap", Values = values });

        var decoded = BijDecoder.Decode(transport.FireAndForgetMessages.Last());
        var meta = (JsonElement)decoded["meta"];
        Assert.Equal("data", meta.GetProperty("category").GetString());
        Assert.Equal("setMatrix", meta.GetProperty("action").GetString());
        Assert.Equal(chart.ChartId, meta.GetProperty("chartId").GetString());
        Assert.Equal("heatmap", meta.GetProperty("seriesId").GetString());
        Assert.Equal(values, (float[])decoded["values"]);
    }

    [Fact]
    public async Task InvalidateMatrixData_SendsRegion()
    {
        var transport = new MockTransport();
        var client = new LclaContext(transport, new LclaLicense { Key = "test-license" });
        var chart = await client.CreateChartAsync();

        chart.InvalidateMatrixData(new InvalidateMatrixDataOptions
        {
            SeriesId = "heatmap", IColumn = 10, IRow = 2, Columns = 2, Rows = 3, Values = new float[6],
        });

        var meta = (JsonElement)BijDecoder.Decode(transport.FireAndForgetMessages.Last())["meta"];
        Assert.Equal("invalidateMatrix", meta.GetProperty("action").GetString());
        var p = meta.GetProperty("params");
        Assert.Equal(10, p.GetProperty("iColumn").GetInt32());
        Assert.Equal(2, p.GetProperty("iRow").GetInt32());
        Assert.Equal(2, p.GetProperty("columns").GetInt32());
        Assert.Equal(3, p.GetProperty("rows").GetInt32());

        Assert.Throws<ArgumentException>(() => chart.InvalidateMatrixData(new InvalidateMatrixDataOptions
        {
            SeriesId = "heatmap", IColumn = 0, IRow = 0, Columns = 2, Rows = 3, Values = new float[5],
        }));
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0)]
    [InlineData(4)]
    public async Task AppendMatrixData_FlattensSamplesIntoOnePart(int? iSample)
    {
        var transport = new MockTransport();
        var client = new LclaContext(transport, new LclaLicense { Key = "test-license" });
        var chart = await client.CreateChartAsync();

        chart.AppendMatrixData(new AppendMatrixDataOptions
        {
            SeriesId = "spectrogram",
            Samples = [[1, 2, 3], [4, 5, 6]],
            ISample = iSample,
        });

        var decoded = BijDecoder.Decode(transport.FireAndForgetMessages.Last());
        var meta = (JsonElement)decoded["meta"];
        var parameters = meta.GetProperty("params");

        Assert.Equal("appendMatrix", meta.GetProperty("action").GetString());
        Assert.Equal(3, parameters.GetProperty("sampleLength").GetInt32());
        Assert.Equal(new float[] { 1, 2, 3, 4, 5, 6 }, (float[])decoded["values"]);

        if (iSample.HasValue)
            Assert.Equal(iSample.Value, parameters.GetProperty("iSample").GetInt32());
        else
            Assert.False(parameters.TryGetProperty("iSample", out _));

        Assert.Throws<ArgumentException>(() => chart.AppendMatrixData(
            new AppendMatrixDataOptions
            {
                SeriesId = "spectrogram",
                Samples = [[1, 2, 3], [4, 5]],
            }));
    }
}

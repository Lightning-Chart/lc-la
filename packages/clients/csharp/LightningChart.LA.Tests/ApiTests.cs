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

    [Fact]
    public async Task CreateChart_WithConfig_SendsDataSetsAndChannels()
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
                    Columns = [new DataSetColumnConfig { Id = "temperature" }],
                },
            ],
            Channels = [
                new ChannelConfig { Id = "ch1", DataSetId = "ds1", Column = "temperature", Name = "Temp", Color = "#ff0000" },
            ],
        });

        // init + create via SendAsync, title + datasets + channels via FireAndForget
        Assert.Equal(2, transport.SentMessages.Count);
        Assert.Equal(3, transport.FireAndForgetMessages.Count);

        // Verify datasets message
        var dsDecoded = BijDecoder.Decode(transport.FireAndForgetMessages[1]);
        var dsMeta = (JsonElement)dsDecoded["meta"];
        Assert.Equal("datasets", dsMeta.GetProperty("action").GetString());

        // Verify channels message
        var chDecoded = BijDecoder.Decode(transport.FireAndForgetMessages[2]);
        var chMeta = (JsonElement)chDecoded["meta"];
        Assert.Equal("channels", chMeta.GetProperty("action").GetString());
    }

    [Fact]
    public async Task SetData_SendsBijWithSharedTimestamps()
    {
        var transport = new MockTransport();
        var client = new LclaContext(transport, new LclaLicense { Key = "test-license" });
        var chart = await client.CreateChartAsync();

        var x = new double[] { 1.0, 2.0, 3.0 };
        var columns = new Dictionary<string, double[]>
        {
            ["temperature"] = [10.0, 20.0, 30.0],
            ["humidity"] = [40.0, 50.0, 60.0],
        };
        chart.SetData(new SetDataOptions { DataSetId = "sensors", X = x, Columns = columns });

        var lastMsg = transport.FireAndForgetMessages.Last();
        var decoded = BijDecoder.Decode(lastMsg);
        var meta = (JsonElement)decoded["meta"];
        Assert.Equal("data", meta.GetProperty("category").GetString());
        Assert.Equal("set", meta.GetProperty("action").GetString());
        Assert.Equal("sensors", meta.GetProperty("dataSetId").GetString());

        var decodedX = (double[])decoded["x"];
        Assert.Equal(x, decodedX);
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
            ["temperature"] = [10.0, 20.0],
        };
        chart.AppendData(new AppendDataOptions { DataSetId = "sensors", X = [1.0, 2.0], Columns = columns });

        // SetData + AppendData both go through FireAndForget
        var appendMsg = transport.FireAndForgetMessages.Last();
        var decoded = BijDecoder.Decode(appendMsg);
        var meta = (JsonElement)decoded["meta"];
        Assert.Equal("data", meta.GetProperty("category").GetString());
        Assert.Equal("append", meta.GetProperty("action").GetString());
        Assert.Equal("sensors", meta.GetProperty("dataSetId").GetString());
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
}

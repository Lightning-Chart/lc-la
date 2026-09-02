using System.Text.Json;
using LightningChart.LA.Bij;

namespace LightningChart.LA.Tests;

public class BijTests
{
    [Fact]
    public void RoundTrip_JsonOnly()
    {
        var parts = new List<BijPart>
        {
            BijPart.Json("meta", new { category = "lifecycle", action = "create", id = "1" }),
            BijPart.Json("params", new { type = "xy" }),
        };

        var buffer = BijEncoder.Encode(parts);
        var decoded = BijDecoder.Decode(buffer);

        Assert.True(decoded.ContainsKey("meta"));
        Assert.True(decoded.ContainsKey("params"));

        var meta = (JsonElement)decoded["meta"];
        Assert.Equal("lifecycle", meta.GetProperty("category").GetString());
        Assert.Equal("create", meta.GetProperty("action").GetString());
    }

    [Fact]
    public void RoundTrip_Float64Array()
    {
        var x = new double[] { 1.0, 2.0, 3.0, 4.0, 5.0 };
        var y = new double[] { 10.0, 20.0, 30.0, 40.0, 50.0 };

        var parts = new List<BijPart>
        {
            BijPart.Json("meta", new { id = "1", category = "data" }),
            BijPart.Float64("x", x),
            BijPart.Float64("y", y),
        };

        var buffer = BijEncoder.Encode(parts);
        var decoded = BijDecoder.Decode(buffer);

        var decodedX = (double[])decoded["x"];
        var decodedY = (double[])decoded["y"];

        Assert.Equal(x, decodedX);
        Assert.Equal(y, decodedY);
    }

    [Fact]
    public void RoundTrip_Float32Array()
    {
        var values = new float[] { 1.5f, 2.5f, 3.5f };

        var parts = new List<BijPart>
        {
            BijPart.Json("meta", new { id = "5" }),
            BijPart.Float32("values", values),
        };

        var buffer = BijEncoder.Encode(parts);
        var decoded = BijDecoder.Decode(buffer);

        var decodedValues = (float[])decoded["values"];
        Assert.Equal(values, decodedValues);
    }

    [Fact]
    public void RoundTrip_Mixed()
    {
        var f32 = new float[] { 1.0f, 2.0f };
        var f64 = new double[] { 100.0, 200.0, 300.0 };

        var parts = new List<BijPart>
        {
            BijPart.Json("config", new { title = "Mixed" }),
            BijPart.Float32("f32data", f32),
            BijPart.Float64("f64data", f64),
            BijPart.Json("extra", new int[] { 1, 2, 3 }),
        };

        var buffer = BijEncoder.Encode(parts);
        var decoded = BijDecoder.Decode(buffer);

        var config = (JsonElement)decoded["config"];
        Assert.Equal("Mixed", config.GetProperty("title").GetString());

        Assert.Equal(f32, (float[])decoded["f32data"]);
        Assert.Equal(f64, (double[])decoded["f64data"]);
    }

    [Fact]
    public void RoundTrip_EmptyParts()
    {
        var buffer = BijEncoder.Encode([]);
        var decoded = BijDecoder.Decode(buffer);
        Assert.Empty(decoded);
    }

    [Fact]
    public void RoundTrip_LargeFloat64Array()
    {
        var big = new double[1_000_000];
        for (int i = 0; i < big.Length; i++) big[i] = i * 0.1;

        var parts = new List<BijPart>
        {
            BijPart.Json("meta", new { id = "1" }),
            BijPart.Float64("data", big),
        };

        var buffer = BijEncoder.Encode(parts);
        var decoded = BijDecoder.Decode(buffer);

        var decodedData = (double[])decoded["data"];
        Assert.Equal(1_000_000, decodedData.Length);
        Assert.Equal(0.0, decodedData[0], 5);
        Assert.Equal(99999.9, decodedData[999_999], 1);
    }

    [Fact]
    public void RoundTrip_Unicode()
    {
        var parts = new List<BijPart>
        {
            BijPart.Json("text", new { title = "Temperatur °C — Mäßig" }),
        };

        var buffer = BijEncoder.Encode(parts);
        var decoded = BijDecoder.Decode(buffer);

        var text = (JsonElement)decoded["text"];
        Assert.Equal("Temperatur °C — Mäßig", text.GetProperty("title").GetString());
    }

    [Fact]
    public void Encode_ProducesSameByteFormat_AsTypeScript()
    {
        // Verify the structural format matches: first 8 bytes = metadata length prefix,
        // then metadata, then data regions, all 8-byte aligned
        var parts = new List<BijPart>
        {
            BijPart.Json("meta", new { id = "1" }),
            BijPart.Float64("x", new double[] { 1.0 }),
        };

        var buffer = BijEncoder.Encode(parts);

        // First 2 bytes: metadata length as UInt16 (little-endian)
        ushort metaLen = BitConverter.ToUInt16(buffer, 0);
        Assert.True(metaLen > 0);

        // Bytes 2-7 should be zero (padding)
        for (int i = 2; i < 8; i++)
        {
            Assert.Equal(0, buffer[i]);
        }

        // Metadata region should be valid JSON
        var metaBytes = buffer.AsSpan(8, metaLen);
        var metaJson = System.Text.Encoding.UTF8.GetString(metaBytes);
        var meta = JsonSerializer.Deserialize<JsonElement>(metaJson);
        Assert.Equal(JsonValueKind.Array, meta.ValueKind);
    }
}

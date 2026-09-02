using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

namespace LightningChart.LA.Bij;

/// <summary>
/// Decodes a BIJ binary buffer back into key-value pairs.
/// Float arrays are returned as float[] or double[].
/// JSON parts are returned as JsonElement.
/// </summary>
public static class BijDecoder
{
    public static Dictionary<string, object> Decode(byte[] buffer)
    {
        return Decode(buffer.AsSpan());
    }

    public static Dictionary<string, object> Decode(ReadOnlySpan<byte> buffer)
    {
        ushort metadataByteLength = MemoryMarshal.Read<ushort>(buffer);
        var metadataBytes = buffer.Slice(8, metadataByteLength);
        var metadataJson = Encoding.UTF8.GetString(metadataBytes);
        var metadata = JsonSerializer.Deserialize<JsonElement>(metadataJson);

        int dataStart = 8 + Align8(metadataByteLength);
        var result = new Dictionary<string, object>();

        foreach (var part in metadata.EnumerateArray())
        {
            var key = part.GetProperty("key").GetString()!;
            int start = part.GetProperty("start").GetInt32();
            int length = part.GetProperty("length").GetInt32();
            var type = part.GetProperty("type").GetString()!;

            int firstByte = dataStart + start;

            switch (type)
            {
                case "json":
                {
                    var jsonBytes = buffer.Slice(firstByte, length);
                    var jsonString = Encoding.UTF8.GetString(jsonBytes);
                    result[key] = JsonSerializer.Deserialize<JsonElement>(jsonString);
                    break;
                }
                case "float32":
                {
                    int count = length / sizeof(float);
                    var floats = new float[count];
                    MemoryMarshal.Cast<byte, float>(buffer.Slice(firstByte, length)).CopyTo(floats);
                    result[key] = floats;
                    break;
                }
                case "float64":
                {
                    int count = length / sizeof(double);
                    var doubles = new double[count];
                    MemoryMarshal.Cast<byte, double>(buffer.Slice(firstByte, length)).CopyTo(doubles);
                    result[key] = doubles;
                    break;
                }
            }
        }

        return result;
    }

    private static int Align8(int n) => (n + 7) & ~7;
}

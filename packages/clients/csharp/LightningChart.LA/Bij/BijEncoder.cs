using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

namespace LightningChart.LA.Bij;

/// <summary>
/// Encodes a list of BijParts into a single binary buffer (ArrayBuffer-compatible).
///
/// Format:
///   [0..8)     UInt16 at offset 0: metadata byte length. Padded to 8-byte boundary.
///   [8..8+M)   UTF-8 metadata JSON: array of { key, start, length, type }.
///   [data...]  Each part's bytes, 8-byte aligned.
/// </summary>
public static class BijEncoder
{
    public static byte[] Encode(IReadOnlyList<BijPart> parts)
    {
        var partBytesList = new List<byte[]>(parts.Count);
        var partByteLengths = new int[parts.Count];
        var partTypes = new string[parts.Count];

        for (int i = 0; i < parts.Count; i++)
        {
            var part = parts[i];
            switch (part.Type)
            {
                case BijValueType.Float32:
                {
                    var arr = (float[])part.Value;
                    var bytes = MemoryMarshal.AsBytes(arr.AsSpan()).ToArray();
                    partBytesList.Add(bytes);
                    partByteLengths[i] = bytes.Length;
                    partTypes[i] = "float32";
                    break;
                }
                case BijValueType.Float64:
                {
                    var arr = (double[])part.Value;
                    var bytes = MemoryMarshal.AsBytes(arr.AsSpan()).ToArray();
                    partBytesList.Add(bytes);
                    partByteLengths[i] = bytes.Length;
                    partTypes[i] = "float64";
                    break;
                }
                default:
                {
                    var json = JsonSerializer.Serialize(part.Value);
                    var bytes = Encoding.UTF8.GetBytes(json);
                    partBytesList.Add(bytes);
                    partByteLengths[i] = bytes.Length;
                    partTypes[i] = "json";
                    break;
                }
            }
        }

        // Build metadata
        int offset = 0;
        var metadata = new object[parts.Count];
        for (int i = 0; i < parts.Count; i++)
        {
            metadata[i] = new
            {
                key = parts[i].Key,
                start = offset,
                length = partByteLengths[i],
                type = partTypes[i],
            };
            offset += Align8(partByteLengths[i]);
        }

        var metadataJson = JsonSerializer.Serialize(metadata);
        var metadataBytes = Encoding.UTF8.GetBytes(metadataJson);

        const int metadataPrefixByteLength = 8;
        int metadataByteLength = metadataBytes.Length;

        int totalByteLength = metadataPrefixByteLength
            + Align8(metadataByteLength)
            + partByteLengths.Sum(len => Align8(len));

        var buffer = new byte[totalByteLength];

        // Write metadata length prefix as UInt16 (little-endian)
        BitConverter.TryWriteBytes(buffer.AsSpan(0, 2), (ushort)metadataByteLength);

        // Write metadata bytes
        Array.Copy(metadataBytes, 0, buffer, metadataPrefixByteLength, metadataByteLength);

        // Write each part's data
        int dataStart = metadataPrefixByteLength + Align8(metadataByteLength);
        for (int i = 0; i < partBytesList.Count; i++)
        {
            Array.Copy(partBytesList[i], 0, buffer, dataStart, partByteLengths[i]);
            dataStart += Align8(partByteLengths[i]);
        }

        return buffer;
    }

    /// <summary>
    /// Convenience: encode a single JSON-only message with one "meta" key.
    /// </summary>
    public static byte[] EncodeJson(string key, object value)
    {
        return Encode([BijPart.Json(key, value)]);
    }

    private static int Align8(int n) => (n + 7) & ~7;
}

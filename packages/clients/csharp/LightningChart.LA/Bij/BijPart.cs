namespace LightningChart.LA.Bij;

/// <summary>
/// A single part of a BIJ message, identified by a key.
/// Value can be a JSON-serializable object, a float[], or a double[].
/// </summary>
public readonly struct BijPart
{
    public string Key { get; }
    public object Value { get; }
    public BijValueType Type { get; }

    private BijPart(string key, object value, BijValueType type)
    {
        Key = key;
        Value = value;
        Type = type;
    }

    public static BijPart Json(string key, object value) => new(key, value, BijValueType.Json);
    public static BijPart Float32(string key, float[] value) => new(key, value, BijValueType.Float32);
    public static BijPart Float64(string key, double[] value) => new(key, value, BijValueType.Float64);
}

public enum BijValueType
{
    Json,
    Float32,
    Float64,
}

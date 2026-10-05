using System.Globalization;

namespace BlazorWasmExample.Data;

public sealed record TelemetrySample(
    double TimeSeconds,
    double SpeedKmh,
    double LateralAccelerationMs2,
    double LongitudinalAccelerationMs2,
    double YawRateRadiansPerSecond,
    double ThrottlePercent,
    double BrakePressureBar,
    double SteeringAngleDegrees,
    double PowerKw,
    double BatterySocPercent,
    double TirePressureFrontLeftPsi,
    double TirePressureFrontRightPsi,
    double TirePressureRearLeftPsi,
    double TirePressureRearRightPsi,
    double TireSlipFrontLeft,
    double TireSlipFrontRight,
    double TireSlipRearLeft,
    double TireSlipRearRight,
    double BrakeTemperatureFrontLeft,
    double BrakeTemperatureFrontRight,
    double BrakeTemperatureRearLeft,
    double BrakeTemperatureRearRight,
    double DistanceKm);

public sealed class TelemetryData
{
    private TelemetryData(IReadOnlyList<TelemetrySample> samples)
    {
        Samples = samples;
    }

    public IReadOnlyList<TelemetrySample> Samples { get; }

    public double DurationSeconds => Samples[^1].TimeSeconds;

    public static async Task<TelemetryData> LoadAsync(
        CancellationToken cancellationToken = default)
    {
        const string resourceName =
            "BlazorWasmExample.Data.tesla_trackmode_laguna_seca_synced60s.csv";

        await using var stream = typeof(TelemetryData).Assembly
            .GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException(
                $"Embedded telemetry dataset '{resourceName}' was not found.");

        using var streamReader = new StreamReader(stream);
        var csv = await streamReader.ReadToEndAsync(cancellationToken);

        using var reader = new StringReader(csv);
        var headerLine = reader.ReadLine()
            ?? throw new InvalidOperationException(
                "The telemetry dataset is empty.");

        var columns = headerLine
            .Split(',')
            .Select((name, index) => new
            {
                Name = name.Trim().TrimStart('\uFEFF'),
                Index = index,
            })
            .ToDictionary(
                column => column.Name,
                column => column.Index,
                StringComparer.OrdinalIgnoreCase);

        int Column(string name)
        {
            if (!columns.TryGetValue(name, out var index))
            {
                throw new InvalidOperationException(
                    $"Required telemetry column '{name}' is missing.");
            }

            return index;
        }

        var time = Column("time_s");
        var speed = Column("speed_kmh");
        var lateralAcceleration = Column("accel_lateral_ms2");
        var longitudinalAcceleration = Column("accel_longitudinal_ms2");
        var yawRate = Column("yaw_rate_rads");
        var throttle = Column("throttle_pos_pct");
        var brakePressure = Column("brake_pressure_bar");
        var steeringAngle = Column("steering_angle_deg");
        var power = Column("power_kw");
        var batterySoc = Column("battery_soc_pct");
        var tirePressureFrontLeft = Column("tire_pressure_fl_psi");
        var tirePressureFrontRight = Column("tire_pressure_fr_psi");
        var tirePressureRearLeft = Column("tire_pressure_rl_psi");
        var tirePressureRearRight = Column("tire_pressure_rr_psi");
        var tireSlipFrontLeft = Column("tire_slip_fl_norm");
        var tireSlipFrontRight = Column("tire_slip_fr_norm");
        var tireSlipRearLeft = Column("tire_slip_rl_norm");
        var tireSlipRearRight = Column("tire_slip_rr_norm");
        var brakeTemperatureFrontLeft = Column("brake_temp_fl_norm");
        var brakeTemperatureFrontRight = Column("brake_temp_fr_norm");
        var brakeTemperatureRearLeft = Column("brake_temp_rl_norm");
        var brakeTemperatureRearRight = Column("brake_temp_rr_norm");
        var distance = Column("distance_km");

        var samples = new List<TelemetrySample>();

        while (reader.ReadLine() is { } line)
        {
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            var values = line.Split(',');

            double Parse(int column) =>
                double.Parse(
                    values[column],
                    NumberStyles.Float,
                    CultureInfo.InvariantCulture);

            samples.Add(new TelemetrySample(
                TimeSeconds: Parse(time),
                SpeedKmh: Parse(speed),
                LateralAccelerationMs2: Parse(lateralAcceleration),
                LongitudinalAccelerationMs2: Parse(longitudinalAcceleration),
                YawRateRadiansPerSecond: Parse(yawRate),
                ThrottlePercent: Parse(throttle),
                BrakePressureBar: Parse(brakePressure),
                SteeringAngleDegrees: Parse(steeringAngle),
                PowerKw: Parse(power),
                BatterySocPercent: Parse(batterySoc),
                TirePressureFrontLeftPsi: Parse(tirePressureFrontLeft),
                TirePressureFrontRightPsi: Parse(tirePressureFrontRight),
                TirePressureRearLeftPsi: Parse(tirePressureRearLeft),
                TirePressureRearRightPsi: Parse(tirePressureRearRight),
                TireSlipFrontLeft: Parse(tireSlipFrontLeft),
                TireSlipFrontRight: Parse(tireSlipFrontRight),
                TireSlipRearLeft: Parse(tireSlipRearLeft),
                TireSlipRearRight: Parse(tireSlipRearRight),
                BrakeTemperatureFrontLeft: Parse(brakeTemperatureFrontLeft),
                BrakeTemperatureFrontRight: Parse(brakeTemperatureFrontRight),
                BrakeTemperatureRearLeft: Parse(brakeTemperatureRearLeft),
                BrakeTemperatureRearRight: Parse(brakeTemperatureRearRight),
                DistanceKm: Parse(distance)));
        }

        if (samples.Count == 0)
        {
            throw new InvalidOperationException(
                "The telemetry dataset contains no samples.");
        }

        return new TelemetryData(samples);
    }
}

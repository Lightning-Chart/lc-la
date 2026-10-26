import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:lightning_chart_flutter/lightning_chart_flutter.dart';

void main() {
  runApp(const ExampleApp());
}

class ExampleApp extends StatelessWidget {
  const ExampleApp({super.key});

  @override
  Widget build(BuildContext context) {
    const license = LightningChartLicense(
      key: String.fromEnvironment('LIGHTNINGCHART_LICENSE'),
      appTitle: 'LightningChart Flutter Package Example',
      company: 'LightningChart Ltd.',
    );

    final x = Float64List.fromList([0, 1, 2, 3, 4, 5]);
    final sensorA = Float64List.fromList([21.2, 21.8, 22.4, 22.1, 22.9, 23.2]);
    final sensorB = Float64List.fromList([19.8, 20.1, 20.7, 20.4, 20.9, 21.3]);

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(useMaterial3: true),
      home: Scaffold(
        appBar: AppBar(title: const Text('LightningChart Flutter')),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: LightningChart.xy(
            license: license,
            title: 'Temperature',
            dataSets: const [
              DataSetConfig(
                id: 'sensors',
                columns: [
                  DataSetColumnConfig(
                    id: 'time',
                    dataPattern: DataPattern.progressive,
                  ),
                  DataSetColumnConfig(id: 'sensorA'),
                  DataSetColumnConfig(id: 'sensorB'),
                ],
              ),
            ],
            series: const [
              LineSeriesConfig(
                id: 'sensorA',
                dataSetId: 'sensors',
                x: 'time',
                y: 'sensorA',
                name: 'Sensor A',
                color: '#00A6FF',
              ),
              LineSeriesConfig(
                id: 'sensorB',
                dataSetId: 'sensors',
                x: 'time',
                y: 'sensorB',
                name: 'Sensor B',
                color: '#FF9800',
              ),
            ],
            initialData: [
              SetDataOptions(
                dataSetId: 'sensors',
                columns: {'time': x, 'sensorA': sensorA, 'sensorB': sensorB},
              ),
            ],
          ),
        ),
      ),
    );
  }
}

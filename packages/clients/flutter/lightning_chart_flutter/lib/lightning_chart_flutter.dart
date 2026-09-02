import 'src/chart_session.dart';
import 'src/models.dart';
import 'src/view.dart';

export 'src/bij.dart';
export 'src/bridge.dart';
export 'src/flutter_chart.dart';
export 'src/models.dart';
export 'src/view.dart' hide LclaChartView;

class LightningChartView extends LclaChartView {
  const LightningChartView({
    required super.license,
    super.initialConfig,
    super.onChartReady,
    super.onError,
    super.key,
  });
}

class LightningChartLicense extends LclaLicense {
  const LightningChartLicense({
    required super.key,
    super.appTitle,
    super.company,
    super.theme,
  });
}

typedef LightningChartReady = LclaChartReady;
typedef LightningChartErrorHandler = LclaErrorHandler;
typedef LightningChartController = LclaChart;
typedef LightningChartTheme = LclaTheme;

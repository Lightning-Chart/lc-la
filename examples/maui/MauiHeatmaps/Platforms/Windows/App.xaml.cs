namespace MauiHeatmaps.WinUI;

public sealed partial class App : MauiWinUIApplication
{
    public App() => InitializeComponent();

    protected override MauiApp CreateMauiApp() => global::MauiHeatmaps.MauiProgram.CreateMauiApp();
}

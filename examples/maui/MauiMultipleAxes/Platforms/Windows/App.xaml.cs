namespace MauiMultipleAxes.WinUI;

public sealed partial class App : MauiWinUIApplication
{
    public App() => InitializeComponent();

    protected override MauiApp CreateMauiApp() => global::MauiMultipleAxes.MauiProgram.CreateMauiApp();
}

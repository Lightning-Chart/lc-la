using BlazorServerComparison.Components;
using LightningChart.LA.Api;
using ApexCharts;
using Radzen;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();
    
// Register Blazor-ApexCharts.
builder.Services.AddApexCharts();

// Register Radzen Blazor.
builder.Services.AddRadzenComponents();

// Register Blazor Bootstrap.
builder.Services.AddBlazorBootstrap();

var licenseKey = Environment.GetEnvironmentVariable("LCJS_LICENSE_KEY")
    ?? throw new InvalidOperationException(
        "LCJS_LICENSE_KEY environment variable is not set.");
var appTitle = Environment.GetEnvironmentVariable("LCJS_APP_TITLE");
var company = Environment.GetEnvironmentVariable("LCJS_COMPANY");

// Create the LCLA license once and register it for dependency injection.
// In your own application, the values may instead come from configuration,
// user secrets, or another suitable configuration source.
builder.Services.AddSingleton(new LclaLicense
{
    Key = licenseKey,
    AppTitle = string.IsNullOrWhiteSpace(appTitle)
        ? "LightningChart JS Trial"
        : appTitle,
    Company = string.IsNullOrWhiteSpace(company)
        ? "LightningChart Ltd."
        : company,
    Theme = LclaTheme.DarkGold,
});


var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseStaticFiles();
app.UseAntiforgery();

app.MapStaticAssets();

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();

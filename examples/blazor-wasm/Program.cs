using System.Reflection;
using BlazorWasmExample;
using LightningChart.LA.Api;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

var metadata = typeof(App).Assembly
    .GetCustomAttributes<AssemblyMetadataAttribute>()
    .ToDictionary(item => item.Key, item => item.Value);

metadata.TryGetValue("LCJS_LICENSE_KEY", out var licenseKey);
metadata.TryGetValue("LCJS_APP_TITLE", out var appTitle);
metadata.TryGetValue("LCJS_COMPANY", out var company);

if (string.IsNullOrWhiteSpace(licenseKey))
{
    throw new InvalidOperationException(
        "LCJS_LICENSE_KEY environment variable is not set.");
}

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

await builder.Build().RunAsync();

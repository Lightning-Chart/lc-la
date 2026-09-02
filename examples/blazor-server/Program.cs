using BlazorServerExample.Components;
using LightningChart.LA.Api;

var builder = WebApplication.CreateBuilder(args);

var licenseKey = Environment.GetEnvironmentVariable("LCJS_LICENSE_KEY")
    ?? throw new InvalidOperationException(
        "LCJS_LICENSE_KEY environment variable is not set.");

builder.Services.AddSingleton(new LclaLicense
{
    Key = licenseKey,
    AppTitle = Environment.GetEnvironmentVariable("LCJS_APP_TITLE"),
    Company = Environment.GetEnvironmentVariable("LCJS_COMPANY"),
    Theme = LclaTheme.DarkGold,
});

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

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

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();

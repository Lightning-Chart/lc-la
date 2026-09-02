# LCLA Blazor Server Example

Real-time XY chart with streaming sine/cosine data.

Learn more: [LightningChart documentation](https://lightningchart.com/lc-la/docs/)

Clone this standalone example with:

```bash
git clone https://github.com/Lightning-Chart/lc-la-example-blazor-server.git
cd lc-la-example-blazor-server
```

## Prerequisites

- .NET 10 SDK
- LightningChart JS license key ([get one here](https://lightningchart.com/js-charts/))

## Build and Run

1. Run the example:

   ```
   # PowerShell:
   $env:LCJS_LICENSE_KEY="your-license-key"; dotnet run
   ```

   ```
   # Git Bash:
   LCJS_LICENSE_KEY="your-license-key" dotnet run
   ```

2. Open https://localhost:5001 (or the URL shown in terminal) and navigate to "LCLA Chart".

3. Click "Start Streaming" to see real-time data.

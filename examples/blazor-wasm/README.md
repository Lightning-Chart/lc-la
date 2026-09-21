# LCLA Blazor WebAssembly Example

Historical XY chart with sine/cosine data and a real-time scrolling XY chart.

Learn more: [LightningChart documentation](https://lightningchart.com/lc-la/docs/)

Clone this standalone example with:

```bash
git clone https://github.com/Lightning-Chart/lc-la-example-blazor-wasm.git
cd lc-la-example-blazor-wasm
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

2. Open the URL shown in terminal and navigate to "LCLA Chart".

3. Click "Load Historical Data" to display the historical chart data.

4. Click "Run" to start the real-time scrolling chart. Click "Pause" to stop it.

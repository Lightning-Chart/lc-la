# LCLA Blazor Server Example

Twelve charts display the same ECG stream from `examples/data/ecg_1000.csv`. All charts share one dataset, with each streaming batch appended once. Playback loops through the CSV at a target rate of 1,000 samples per second. Each chart shows a one-second scrolling window.

Learn more: [LightningChart documentation](https://lightningchart.com/lc-la/docs/)

![Blazor Server example](/examples/blazor-server/wwwroot/lcla_blazorserver.png)

## Prerequisites

- .NET 10 SDK
- LightningChart JS license key ([get one here](https://lightningchart.com/js-charts/))

## Build and Run
1. Clone this standalone example with:

    ```bash
    git clone https://github.com/Lightning-Chart/lc-la-example-blazor-server.git
    cd lc-la-example-blazor-server
    ```

2. Run the example:

   ```
   # PowerShell:
   $env:LCJS_LICENSE_KEY="your-license-key"; dotnet run
   ```

   ```
   # Git Bash:
   LCJS_LICENSE_KEY="your-license-key" dotnet run
   ```

3. Open https://localhost:5001 (or the URL shown in terminal) and navigate to "LightningChart Blazor".

4. Click **Play** to start ECG playback. Click **Pause** to pause playback, then **Play** to resume. Use the chart's mouse interactions to zoom and pan.

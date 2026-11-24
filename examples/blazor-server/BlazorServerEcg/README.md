# LightningChart Blazor Server Example

Twelve charts display the same ECG stream from `Data/ecg_1000.csv`. All charts share one dataset, with each streaming batch appended once. Playback loops through the CSV at a target rate of 1,000 samples per second. Each chart shows a one-second scrolling window.

Learn more: [LightningChart documentation](https://lightningchart.com/lc-la/docs/)

![Blazor Server ecg example](./images/BlazorServerEcg.png)

## Prerequisites

- .NET 10 SDK
- LightningChart JS license key ([get one here](https://lightningchart.com/js-charts/))

## Build and Run

### Standalone repository

1. Clone the standalone example with:

   ```bash
   git clone https://github.com/Lightning-Chart/lc-la-example-blazor-server.git
   cd lc-la-example-blazor-server
   ```

2. Supply your license key and run the example:

   ```powershell
    # PowerShell:
    $env:LCJS_LICENSE_KEY="your-license-key"; dotnet run
   ```

   ```bash
    # Git Bash:
    LCJS_LICENSE_KEY="your-license-key" dotnet run
   ```

3. Open the URL shown in the terminal and navigate to "LightningChart Blazor".

### From the lc-la repository

1. Clone the repository:

   ```bash
   git clone https://github.com/Lightning-Chart/lc-la.git
   cd lc-la
   ```

   If you already have the repository, open a terminal in its root folder.

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` in the repository root and set `LCJS_LICENSE_KEY` to your license key.

4. Start the example runner:

   ```bash
   npm run dev
   ```

   Select "Blazor Server", then "Multiple ECG streams".

5. Open the URL shown in the terminal and navigate to "LightningChart Blazor".

## Using the Example

Click **Play** to start ECG playback and **Pause** to pause it.
Use the chart's mouse interactions to zoom and pan.
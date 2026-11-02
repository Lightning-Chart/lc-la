# LightningChart MAUI Example

This .NET MAUI example demonstrates static and scrolling heatmaps with value-based coloring using lookup tables (LUTs).

Learn more: [LightningChart documentation](https://lightningchart.com/lc-la/docs/)

![MAUI example](./images/MauiHeatmaps.png)

## Prerequisites

- Windows 10 build 19041 or later
- .NET 10 SDK with the MAUI workload
- LightningChart JS license key ([get one here](https://lightningchart.com/js-charts/))

Install the MAUI workload if needed:
```powershell
dotnet workload install maui
```

## Build and Run

1. Clone the repository:
   ```powershell
   git clone https://github.com/Lightning-Chart/lc-la.git
   cd lc-la
   ```

   If you already have the repository, open a terminal in its root folder.

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Copy `.env.example` to `.env` in the repository root and set `LCJS_LICENSE_KEY` to your license key.

4. Start the Windows example:
   ```powershell
   npm run dev
   ```

   Select ".NET MAUI", then "Heatmaps".

5. Playback starts automatically with simulated historical spectra, followed by continuously generated spectra.
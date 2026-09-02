import { useEffect, useRef, useState } from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

const sampleCount = 500_000;
const channelCount = 6;
const totalPointCount = sampleCount * channelCount;
const chartTitle = `${totalPointCount.toLocaleString("en-US")} points - no downsampling or hacks required! Instant loading`;

export default function PerformanceDemo() {
  const { siteConfig } = useDocusaurusContext();
  const docsLicenseKey = (siteConfig.customFields?.docsLicenseKey as string) ?? "";
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState(
    docsLicenseKey
      ? "Preparing 3,000,000 samples…"
      : "Demo unavailable: set LCJS_DOCS_LICENSE_KEY in the root .env to enable it.",
  );

  useEffect(() => {
    if (!docsLicenseKey) return undefined;

    let disposed = false;
    let disposeChart: (() => void) | undefined;

    const createChart = async () => {
      const [lcjs, xydata] = await Promise.all([
        import("@lightningchart/lcjs"),
        import("@lightningchart/xydata"),
      ]);
      const data = await xydata
        .createMultiChannelTraceGenerator()
        .setNumberOfChannels(channelCount)
        .setNumberOfPoints(sampleCount)
        .setUseSharedArrayBuffers(false)
        .generate();

      if (disposed || !containerRef.current) return;

      setStatus("Rendering 6 channels of 500,000 samples…");
      const lc = lcjs.lightningChart({ license: docsLicenseKey });
      const chart = lc
        .ChartXY({ container: containerRef.current })
        .setTitle(chartTitle);
      disposeChart = () => chart.dispose();

      const lowerAxis = chart.getDefaultAxisY().setTitle("Lower signals");
      const upperAxis = chart.addAxisY({ iStack: 1 }).setTitle("Upper signals");
      const dataSet = new lcjs.DataSetXY({
        schema: {
          x: { pattern: "progressive" },
          y0: { pattern: null },
          y1: { pattern: null },
          y2: { pattern: null },
          y3: { pattern: null },
          y4: { pattern: null },
          y5: { pattern: null },
        },
      }).setMaxSampleCount(sampleCount);

      for (let channel = 0; channel < channelCount; channel += 1) {
        chart
          .addLineSeries({ axisY: channel < 3 ? lowerAxis : upperAxis })
          .setName(`Channel ${channel + 1}`)
          .setDataSet(dataSet, { x: "x", y: `y${channel}` });
      }

      dataSet.appendSamples(data);
      setStatus(
        "Use mouse wheel to zoom, right mouse button to pan, and use the cursor to inspect values.",
      );
    };

    void createChart().catch((error: unknown) => {
      if (!disposed) {
        setStatus(
          error instanceof Error
            ? `Unable to start the demo: ${error.message}`
            : "Unable to start the demo.",
        );
      }
    });

    return () => {
      disposed = true;
      disposeChart?.();
    };
  }, [docsLicenseKey]);

  return (
    <section
      className="performance-demo"
      aria-label="Interactive LightningChart JS performance demo"
    >
      <div className="performance-demo__chart" ref={containerRef} />
      <p className="performance-demo__status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}

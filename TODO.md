# Heatmaps: matrix data logistics

Status: scrolling heatmap creation, configuration, and streaming are implemented. Static heatmap creation, palette coloring, clearing, and data cleaning are not yet implemented.

## Decisions

- **Matrix data is generic; series are heatmaps.** Data API is named "matrix data" (`SetMatrixData`, ...). Heatmap series creation is a separate concern.
- **No LCLA-side matrix store or ring buffer.** LCJS heatmap series hold their own data (including scrolling history); data goes straight to the series.
- **Targeting by `seriesId`** (chart-scoped, with `chartId`). Users create the series with all required shape params (columns/rows/dataOrder or resolution/scrollDimension), then push data referencing the series id.
- **No registry or target interface on the host.** Host finds the series and checks `instanceof HeatmapGridSeriesIntensityValues` / `HeatmapScrollingGridSeriesIntensityValues`.
- **Wire format: one flat `float32` BIJ part named `values`.** No BIJ codec changes. LCJS converts all intensity input to `Float32Array` anyway, and flat input is its fastest path. The host passes zero-copy views into LCJS.
- **LCJS series don't expose their shape** (no `getColumns`/`getResolution`), so `appendMatrix` carries `sampleLength`. Clients take a list of samples and fill it in automatically.

## Protocol

Category `data`, envelope has `chartId` + `seriesId`:

| Action             | Series    | Params                               | `values`                        |
| ------------------ | --------- | ------------------------------------ | ------------------------------- |
| `setMatrix`        | grid      | none                                 | whole grid, in series dataOrder |
| `invalidateMatrix` | grid      | `iColumn`, `iRow`, `columns`, `rows` | `columns * rows` region         |
| `appendMatrix`     | scrolling | `sampleLength`                       | `k * sampleLength` (k samples)  |

Large grids can be sent in slabs via `invalidateMatrix`.

## Done

- Host: `packages/host/src/handlers/matrix.ts`. `applyMatrixData` (dispatch, validation, zero-copy slicing) is complete and tested; routed from `handlers/data.ts`.
- C#: `LclaChart.SetMatrixData` / `InvalidateMatrixData` / `AppendMatrixData` + options classes, tests.
- Dart: `LclaChart.setMatrixData` / `invalidateMatrixData` / `appendMatrixData` + options classes, tests.
- [X] Implement `findSeries()` in `handlers/matrix.ts`.
- [X] If series end up referenced by handle instead of string id, adapt the client methods. --> Not needed, series remain referenced by string ID.
- [X] Implement scrolling heatmap creation and configuration in the host, C#, and Flutter, with tests.
- [X] Add a MAUI example with 1M+ historical cells and continuous streaming.

## Remaining

- [ ] Decide on clearing scrolling heatmaps and their history limit (data cleaning); both belong to series creation.
- [ ] Implement shared PalettedFill/LUT configuration.
- [ ] Implement static heatmap creation and configuration.
- [ ] Add a static heatmap to the MAUI example.
- [ ] Update docs (client pages and feature pages) and example READMEs (+ example screenshot).
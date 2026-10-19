# Heatmaps: matrix data logistics

Status: matrix data path is set up but not functional. Waiting for the series creation/storage refactor.

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

## Waiting for series refactor

- [ ] Implement `findSeries()` in `handlers/matrix.ts` (currently always returns "Series not found").
- [ ] If series end up referenced by handle instead of string id, adapt the client methods.
- [ ] Decide on clearing scrolling heatmaps and their history limit (data cleaning); both belong to series creation.
- [ ] Docs (client pages), example READMEs, and an example with 1M+ cell historical grid + streaming spectrogram.

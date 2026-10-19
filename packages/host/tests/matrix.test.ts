import { describe, it, expect, vi } from 'vitest'
import { HeatmapGridSeriesIntensityValues, HeatmapScrollingGridSeriesIntensityValues } from '@lightningchart/lcjs'
import { applyMatrixData, splitSamples } from '../src/handlers/matrix.js'
import type { MessageEnvelope } from '../src/types.js'

vi.mock('@lightningchart/lcjs', () => ({
  HeatmapGridSeriesIntensityValues: class {
    invalidateIntensityValues = vi.fn()
  },
  HeatmapScrollingGridSeriesIntensityValues: class {
    addIntensityValues = vi.fn()
  },
}))

type MockGrid = { invalidateIntensityValues: ReturnType<typeof vi.fn> }
type MockScrolling = { addIntensityValues: ReturnType<typeof vi.fn> }

const gridSeries = () => new (HeatmapGridSeriesIntensityValues as unknown as new () => MockGrid)()
const scrollingSeries = () => new (HeatmapScrollingGridSeriesIntensityValues as unknown as new () => MockScrolling)()

const envelope = (action: string, params?: Record<string, unknown>): MessageEnvelope => ({
  id: '1', category: 'data', action, chartId: 'chart', seriesId: 'heatmap', params,
})

describe('Matrix data', () => {
  it('sets the full grid from flat values without copying', () => {
    const series = gridSeries()
    const values = new Float32Array([1, 2, 3, 4])

    const res = applyMatrixData(envelope('setMatrix'), series, values)

    expect(res.type).toBe('response')
    expect(series.invalidateIntensityValues).toHaveBeenCalledWith(values)
  })

  it('invalidates a grid region', () => {
    const series = gridSeries()
    const values = new Float32Array(6)

    const res = applyMatrixData(envelope('invalidateMatrix', { iColumn: 10, iRow: 2, columns: 2, rows: 3 }), series, values)

    expect(res.type).toBe('response')
    expect(series.invalidateIntensityValues).toHaveBeenCalledWith({ iColumn: 10, iRow: 2, columns: 2, rows: 3, values })
  })

  it('rejects a region whose values do not match its size', () => {
    const res = applyMatrixData(envelope('invalidateMatrix', { iColumn: 0, iRow: 0, columns: 2, rows: 3 }), gridSeries(), new Float32Array(5))

    expect(res.type).toBe('error')
    expect(res.error).toContain('expected 6 values')
  })

  it('appends samples to a scrolling heatmap as views over the received buffer', () => {
    const series = scrollingSeries()
    const values = new Float32Array([1, 2, 3, 4, 5, 6])

    const res = applyMatrixData(envelope('appendMatrix', { sampleLength: 3 }), series, values)

    expect(res.type).toBe('response')
    const samples = series.addIntensityValues.mock.calls[0]![0] as Float32Array[]
    expect(samples.map((s) => Array.from(s))).toEqual([[1, 2, 3], [4, 5, 6]])
    expect(samples.every((s) => s.buffer === values.buffer)).toBe(true)
  })

  it('rejects appended values that are not whole samples', () => {
    const res = applyMatrixData(envelope('appendMatrix', { sampleLength: 4 }), scrollingSeries(), new Float32Array(6))

    expect(res.type).toBe('error')
    expect(res.error).toContain('not a multiple')
  })

  it('rejects actions the series does not support', () => {
    expect(applyMatrixData(envelope('appendMatrix', { sampleLength: 2 }), gridSeries(), new Float32Array(4)).type).toBe('error')
    expect(applyMatrixData(envelope('setMatrix'), scrollingSeries(), new Float32Array(4)).type).toBe('error')
    expect(applyMatrixData(envelope('setMatrix'), {}, new Float32Array(4)).error).toContain('does not support setMatrix')
  })

  it('splits 1M values into 1000 samples', () => {
    const samples = splitSamples(new Float32Array(1_000_000), 1000)

    expect(samples).toHaveLength(1000)
    expect(samples.every((s) => s.length === 1000)).toBe(true)
  })
})

/**
 * Matrix data handler: set, invalidate, and append matrix data on heatmap series.
 * Operations target a seriesId. BIJ parts: a single flat float32 "values" part.
 *
 * LCJS heatmap series store their own data, so the host keeps no matrix buffers.
 * Values are passed to LCJS as zero-copy views over the received message.
 */

import { HeatmapGridSeriesIntensityValues, HeatmapScrollingGridSeriesIntensityValues } from '@lightningchart/lcjs'
import type { MessageEnvelope, ResponseEnvelope, InvalidateMatrixParams, AppendMatrixParams } from '../types.js'
import { hostState } from './state.js'

export type MatrixAction = 'setMatrix' | 'invalidateMatrix' | 'appendMatrix'

export function handleMatrixData(envelope: MessageEnvelope, binaryParts: Record<string, unknown>): ResponseEnvelope {
  const values = binaryParts['values']
  if (!(values instanceof Float32Array)) {
    return error(envelope, 'matrix data requires values as Float32Array')
  }

  const result = findSeries(envelope)
  if (result.error) return result.error

  return applyMatrixData(envelope, result.series, values)
}

/**
 * Resolve the target series by chartId + seriesId.
 * TODO(heatmaps): look up the series once series creation/storage lands.
 */
function findSeries(envelope: MessageEnvelope): { series: unknown; error?: undefined } | { series?: undefined; error: ResponseEnvelope } {
  if (!envelope.chartId) return { error: error(envelope, 'Missing chartId') }
  if (!envelope.seriesId) return { error: error(envelope, 'Missing seriesId') }

  const chartState = hostState.getChart(envelope.chartId)
  if (!chartState) return { error: error(envelope, `Chart not found: ${envelope.chartId}`) }

  return { error: error(envelope, `Series not found: ${envelope.seriesId}`) }
}

/**
 * Apply matrix data to an already resolved series.
 * Values are interpreted in the dataOrder / scrollDimension the series was created with.
 */
export function applyMatrixData(envelope: MessageEnvelope, series: unknown, values: Float32Array): ResponseEnvelope {
  switch (envelope.action as MatrixAction) {
    case 'setMatrix':
      if (!(series instanceof HeatmapGridSeriesIntensityValues)) return notSupported(envelope)
      series.invalidateIntensityValues(values)
      return ok(envelope)

    case 'invalidateMatrix': {
      if (!(series instanceof HeatmapGridSeriesIntensityValues)) return notSupported(envelope)
      const params = envelope.params as unknown as InvalidateMatrixParams | undefined
      if (!params || !isIndex(params.iColumn) || !isIndex(params.iRow) || !isIndex(params.columns) || !isIndex(params.rows)) {
        return error(envelope, 'invalidateMatrix requires iColumn, iRow, columns and rows')
      }
      if (values.length !== params.columns * params.rows) {
        return error(envelope, `invalidateMatrix expected ${params.columns * params.rows} values, got ${values.length}`)
      }
      series.invalidateIntensityValues({ ...params, values })
      return ok(envelope)
    }

    case 'appendMatrix': {
      if (!(series instanceof HeatmapScrollingGridSeriesIntensityValues)) return notSupported(envelope)
      const params = envelope.params as unknown as AppendMatrixParams | undefined
      const sampleLength = params?.sampleLength
      if (!isIndex(sampleLength) || sampleLength === 0) {
        return error(envelope, 'appendMatrix requires a positive sampleLength')
      }
      if (values.length % sampleLength !== 0) {
        return error(envelope, `appendMatrix values length ${values.length} is not a multiple of sampleLength ${sampleLength}`)
      }
      series.addIntensityValues(splitSamples(values, sampleLength))
      return ok(envelope)
    }

    default:
      return error(envelope, `Unknown matrix data action: ${envelope.action}`)
  }
}

/** Split a flat buffer into per-sample views (no copies). */
export function splitSamples(values: Float32Array, sampleLength: number): Float32Array[] {
  const samples: Float32Array[] = []
  for (let start = 0; start < values.length; start += sampleLength) {
    samples.push(values.subarray(start, start + sampleLength))
  }
  return samples
}

function isIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function ok(envelope: MessageEnvelope): ResponseEnvelope {
  return { id: envelope.id, type: 'response' }
}

function error(envelope: MessageEnvelope, message: string): ResponseEnvelope {
  return { id: envelope.id, type: 'error', error: message }
}

function notSupported(envelope: MessageEnvelope): ResponseEnvelope {
  return error(envelope, `Series "${envelope.seriesId}" does not support ${envelope.action}`)
}

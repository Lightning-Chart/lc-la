/**
 * Data handler: set, append, and clear data on datasets.
 * Operations target a dataSetId. BIJ parts: x + named Y columns.
 * maxSampleCount can only increase (LCJS crashes on decrease).
 */

import type { DataSetXY } from '@lightningchart/lcjs'
import type { MessageEnvelope, ResponseEnvelope } from '../types.js'
import { hostState } from './state.js'

function increaseMaxSampleCountIfNeeded(dataSet: DataSetXY, requested: number) {
  const current = dataSet.getMaxSampleCount()
  if (current === undefined || requested > current) {
    dataSet.setMaxSampleCount(requested)
  }
}

function getDataSet(envelope: MessageEnvelope): { dataSet: DataSetXY; columns: string[]; error?: undefined } | { dataSet?: undefined; columns?: undefined; error: ResponseEnvelope } {
  const dataSetId = envelope.dataSetId
  if (!dataSetId) {
    return { error: { id: envelope.id, type: 'error', error: 'Missing dataSetId' } }
  }

  const dsState = hostState.getDataSet(envelope.clientId ?? 'default', dataSetId)
  if (!dsState) {
    return { error: { id: envelope.id, type: 'error', error: `DataSet not found: ${dataSetId}` } }
  }

  return { dataSet: dsState.dataSet, columns: dsState.columns }
}

export function handleData(envelope: MessageEnvelope, binaryParts: Record<string, unknown>): ResponseEnvelope {
  switch (envelope.action) {
    case 'set':
      return handleSet(envelope, binaryParts)
    case 'append':
      return handleAppend(envelope, binaryParts)
    case 'clear':
      return handleClear(envelope)
    default:
      return { id: envelope.id, type: 'error', error: `Unknown data action: ${envelope.action}` }
  }
}

function buildSamples(binaryParts: Record<string, unknown>, columns: string[], envelopeId: string): { samples: Record<string, Float64Array>; error?: undefined } | { samples?: undefined; error: ResponseEnvelope } {
  const x = binaryParts['x']
  if (!(x instanceof Float64Array)) {
    return { error: { id: envelopeId, type: 'error', error: 'data requires x as Float64Array' } }
  }

  const samples: Record<string, Float64Array> = { x }
  for (const col of columns) {
    const part = binaryParts[col]
    if (!(part instanceof Float64Array)) {
      return { error: { id: envelopeId, type: 'error', error: `data requires "${col}" as Float64Array` } }
    }
    samples[col] = part
  }

  return { samples }
}

function handleSet(envelope: MessageEnvelope, binaryParts: Record<string, unknown>): ResponseEnvelope {
  const result = getDataSet(envelope)
  if (result.error) return result.error

  const samplesResult = buildSamples(binaryParts, result.columns, envelope.id)
  if (samplesResult.error) return samplesResult.error

  const maxCount = envelope.params?.['maxSampleCount'] as number | undefined
  if (maxCount !== undefined) {
    increaseMaxSampleCountIfNeeded(result.dataSet, maxCount)
  }

  result.dataSet.clear()
  result.dataSet.setSamples(samplesResult.samples as any)

  return { id: envelope.id, type: 'response' }
}

function handleAppend(envelope: MessageEnvelope, binaryParts: Record<string, unknown>): ResponseEnvelope {
  const result = getDataSet(envelope)
  if (result.error) return result.error

  const samplesResult = buildSamples(binaryParts, result.columns, envelope.id)
  if (samplesResult.error) return samplesResult.error

  const maxCount = envelope.params?.['maxSampleCount'] as number | undefined
  if (maxCount !== undefined) {
    increaseMaxSampleCountIfNeeded(result.dataSet, maxCount)
  }

  result.dataSet.appendSamples(samplesResult.samples as any)

  return { id: envelope.id, type: 'response' }
}

function handleClear(envelope: MessageEnvelope): ResponseEnvelope {
  const result = getDataSet(envelope)
  if (result.error) return result.error

  result.dataSet.clear()
  return { id: envelope.id, type: 'response' }
}

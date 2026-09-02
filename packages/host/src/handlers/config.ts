/**
 * Config handler: configure datasets, channels, title, scroll strategy,
 * axis intervals, tick strategies.
 * The host creates/removes LCJS DataSetXY, series, and axes internally.
 */

import {
  DataSetXY,
  AxisScrollStrategies,
  AxisTickStrategies,
  SolidLine,
  SolidFill,
  ColorHEX,
  emptyFill,
  emptyLine,
  type PointLineAreaSeries,
  type Axis,
} from '@lightningchart/lcjs'
import type {
  MessageEnvelope,
  ResponseEnvelope,
  ConfigureDataSetsParams,
  ConfigureChannelsParams,
  ConfigureTitleParams,
  ConfigureScrollStrategyParams,
  ConfigureAxisIntervalParams,
  ConfigureDefaultAxisIntervalParams,
  ConfigureTickStrategyParams,
  ChannelConfig,
  DataSetConfig,
  ScrollStrategy,
} from '../types.js'
import { hostState, type DataSetState } from './state.js'

const DEFAULT_MAX_SAMPLE_COUNT = 2_000_000

export function handleConfig(envelope: MessageEnvelope): ResponseEnvelope {
  switch (envelope.action) {
    case 'datasets':
      return handleDataSets(envelope)
    case 'channels':
      return handleChannels(envelope)
    case 'title':
      return handleTitle(envelope)
    case 'scrollStrategy':
      return handleScrollStrategy(envelope)
    case 'axisInterval':
      return handleAxisInterval(envelope)
    case 'defaultAxisInterval':
      return handleDefaultAxisInterval(envelope)
    case 'tickStrategy':
      return handleTickStrategy(envelope)
    default:
      return { id: envelope.id, type: 'error', error: `Unknown config action: ${envelope.action}` }
  }
}

// --- Dataset management ---

function handleDataSets(envelope: MessageEnvelope): ResponseEnvelope {
  const params = envelope.params as unknown as ConfigureDataSetsParams
  if (!params?.datasets) {
    return { id: envelope.id, type: 'error', error: 'Missing datasets in params' }
  }

  const dataSets = hostState.getDataSets(envelope.clientId ?? 'default')
  const requestedIds = new Set(params.datasets.map((ds) => ds.id))

  // Remove datasets no longer in config
  for (const [id] of dataSets) {
    if (!requestedIds.has(id)) {
      dataSets.delete(id)
    }
  }

  // Create or update datasets
  for (const dsConfig of params.datasets) {
    const existing = dataSets.get(dsConfig.id)
    if (existing) {
      const existingCols = existing.columns.slice().sort()
      const newCols = dsConfig.columns.map((c) => c.id).slice().sort()
      if (existingCols.join(',') !== newCols.join(',')) {
        const newDs = createDataSet(dsConfig)
        dataSets.set(dsConfig.id, newDs)
      }
    } else {
      dataSets.set(dsConfig.id, createDataSet(dsConfig))
    }
  }

  return { id: envelope.id, type: 'response' }
}

function createDataSet(config: DataSetConfig): DataSetState {
  const schema: Record<string, { pattern?: 'progressive' | 'regressive' | null }> = {
    x: { pattern: config.xDataPattern !== undefined ? config.xDataPattern : 'progressive' },
  }
  for (const col of config.columns) {
    schema[col.id] = { pattern: col.dataPattern !== undefined ? col.dataPattern : null }
  }

  const dataSet = new DataSetXY({ schema: schema as any })
  dataSet.setMaxSampleCount(config.maxSampleCount ?? DEFAULT_MAX_SAMPLE_COUNT)

  return {
    id: config.id,
    dataSet,
    columns: config.columns.map((c) => c.id),
  }
}

// --- Channel management ---

function handleChannels(envelope: MessageEnvelope): ResponseEnvelope {
  const chartId = envelope.chartId
  if (!chartId) {
    return { id: envelope.id, type: 'error', error: 'Missing chartId' }
  }

  const chartState = hostState.getChart(chartId)
  if (!chartState) {
    return { id: envelope.id, type: 'error', error: `Chart not found: ${chartId}` }
  }

  const params = envelope.params as unknown as ConfigureChannelsParams
  if (!params?.channels) {
    return { id: envelope.id, type: 'error', error: 'Missing channels in params' }
  }

  const requestedIds = new Set(params.channels.map((ch) => ch.id))

  // Remove channels no longer in config
  for (const [id, channelState] of chartState.channels) {
    if (!requestedIds.has(id)) {
      channelState.series.dispose()
      chartState.channels.delete(id)
    }
  }

  // Create or update channels
  for (const channelConfig of params.channels) {
    const existing = chartState.channels.get(channelConfig.id)
    if (existing) {
      applyChannelStyle(existing.series, channelConfig)
    } else {
      const dsState = hostState.getDataSet(chartState.clientId, channelConfig.dataSetId)
      if (!dsState) {
        return { id: envelope.id, type: 'error', error: `DataSet not found: ${channelConfig.dataSetId}` }
      }
      if (!dsState.columns.includes(channelConfig.column)) {
        return { id: envelope.id, type: 'error', error: `Column "${channelConfig.column}" not found in dataset "${channelConfig.dataSetId}"` }
      }

      const yAxis = resolveYAxis(chartState, channelConfig.stackIndex)

      const series = chartState.chart.addPointLineAreaSeries({ yAxis })
      series.setDataSet(dsState.dataSet, { x: 'x', y: channelConfig.column })
      series.setAreaFillStyle(emptyFill)

      if (channelConfig.name) {
        series.setName(channelConfig.name)
      }
      applyChannelStyle(series, channelConfig)

      chartState.channels.set(channelConfig.id, {
        id: channelConfig.id,
        series,
        dataSetId: channelConfig.dataSetId,
        column: channelConfig.column,
      })
    }
  }

  return { id: envelope.id, type: 'response' }
}

function resolveYAxis(chartState: { chart: { axisY: Axis; addAxisY: (opts?: { iStack?: number }) => Axis }; axes: Map<number, Axis> }, stackIndex?: number): Axis {
  if (stackIndex === undefined || stackIndex === 0) {
    return chartState.chart.axisY
  }

  const existing = chartState.axes.get(stackIndex)
  if (existing) return existing

  const axis = chartState.chart.addAxisY({ iStack: stackIndex, type: 'linear-highPrecision' } as any)
  chartState.axes.set(stackIndex, axis)
  return axis
}

function applyChannelStyle(series: PointLineAreaSeries, config: ChannelConfig) {
  const color = config.color ? ColorHEX(config.color) : undefined
  const channelType = config.type ?? 'line'

  if (color) {
    const fill = new SolidFill({ color })

    if (channelType === 'line' || channelType === 'line+scatter') {
      series.setStrokeStyle(new SolidLine({ thickness: 2, fillStyle: fill }))
    } else {
      series.setStrokeStyle(emptyLine)
    }

    if (channelType === 'scatter' || channelType === 'line+scatter') {
      series.setPointFillStyle(fill)
      series.setPointSize(6)
    } else {
      series.setPointSize(0)
    }
  }
}

// --- Axis configuration ---

function resolveAxis(envelope: MessageEnvelope, axis: 'x' | 'y', stackIndex?: number): { axis: Axis; error?: undefined } | { axis?: undefined; error: ResponseEnvelope } {
  const chartId = envelope.chartId
  if (!chartId) {
    return { error: { id: envelope.id, type: 'error', error: 'Missing chartId' } }
  }

  const chartState = hostState.getChart(chartId)
  if (!chartState) {
    return { error: { id: envelope.id, type: 'error', error: `Chart not found: ${chartId}` } }
  }

  if (axis === 'x') {
    return { axis: chartState.chart.axisX }
  }

  if (stackIndex !== undefined && stackIndex !== 0) {
    const stacked = chartState.axes.get(stackIndex)
    if (!stacked) {
      return { error: { id: envelope.id, type: 'error', error: `Y axis with stackIndex ${stackIndex} not found` } }
    }
    return { axis: stacked }
  }

  return { axis: chartState.chart.axisY }
}

function handleAxisInterval(envelope: MessageEnvelope): ResponseEnvelope {
  const params = envelope.params as unknown as ConfigureAxisIntervalParams
  if (!params?.axis) {
    return { id: envelope.id, type: 'error', error: 'Missing axis in params' }
  }

  const result = resolveAxis(envelope, params.axis, params.stackIndex)
  if (result.error) return result.error

  result.axis.setInterval({
    start: params.start,
    end: params.end,
    animate: params.animate,
    stopAxisAfter: params.stopAxisAfter,
  })

  return { id: envelope.id, type: 'response' }
}

function handleDefaultAxisInterval(envelope: MessageEnvelope): ResponseEnvelope {
  const params = envelope.params as unknown as ConfigureDefaultAxisIntervalParams
  if (!params?.axis) {
    return { id: envelope.id, type: 'error', error: 'Missing axis in params' }
  }

  const result = resolveAxis(envelope, params.axis, params.stackIndex)
  if (result.error) return result.error

  if (params.length !== undefined) {
    // Trailing window: follow latest data with fixed-width interval
    const len = params.length
    result.axis.setDefaultInterval((state: { dataMax: number | undefined }) => ({
      end: state.dataMax ?? 0,
      start: (state.dataMax ?? 0) - len,
      stopAxisAfter: false,
    }))
  } else {
    // Static default interval
    result.axis.setDefaultInterval({
      start: params.start,
      end: params.end,
    })
  }

  return { id: envelope.id, type: 'response' }
}

function handleTickStrategy(envelope: MessageEnvelope): ResponseEnvelope {
  const params = envelope.params as unknown as ConfigureTickStrategyParams
  if (!params?.axis || !params?.strategy) {
    return { id: envelope.id, type: 'error', error: 'Missing axis or strategy in params' }
  }

  const result = resolveAxis(envelope, params.axis, params.stackIndex)
  if (result.error) return result.error

  switch (params.strategy) {
    case 'dateTime':
      result.axis.setTickStrategy(AxisTickStrategies.DateTime)
      break
    case 'time':
      result.axis.setTickStrategy(AxisTickStrategies.Time)
      break
    case 'numeric':
      result.axis.setTickStrategy(AxisTickStrategies.Numeric)
      break
    default:
      return { id: envelope.id, type: 'error', error: `Unknown tick strategy: ${params.strategy}` }
  }

  return { id: envelope.id, type: 'response' }
}

// --- Scroll strategy ---

function resolveScrollStrategy(strategy: ScrollStrategy) {
  switch (strategy) {
    case 'scrolling':
      return AxisScrollStrategies.scrolling()
    case 'fitting':
      return AxisScrollStrategies.fitting()
    case 'expansion':
      return AxisScrollStrategies.expansion()
  }
}

function handleScrollStrategy(envelope: MessageEnvelope): ResponseEnvelope {
  const chartId = envelope.chartId
  if (!chartId) {
    return { id: envelope.id, type: 'error', error: 'Missing chartId' }
  }

  const chartState = hostState.getChart(chartId)
  if (!chartState) {
    return { id: envelope.id, type: 'error', error: `Chart not found: ${chartId}` }
  }

  const params = envelope.params as unknown as ConfigureScrollStrategyParams
  if (params?.axisX) {
    chartState.chart.axisX.setScrollStrategy(resolveScrollStrategy(params.axisX))
  }
  if (params?.axisY) {
    chartState.chart.axisY.setScrollStrategy(resolveScrollStrategy(params.axisY))
  }

  return { id: envelope.id, type: 'response' }
}

// --- Title ---

function handleTitle(envelope: MessageEnvelope): ResponseEnvelope {
  const chartId = envelope.chartId
  if (!chartId) {
    return { id: envelope.id, type: 'error', error: 'Missing chartId' }
  }

  const chartState = hostState.getChart(chartId)
  if (!chartState) {
    return { id: envelope.id, type: 'error', error: `Chart not found: ${chartId}` }
  }

  const params = envelope.params as unknown as ConfigureTitleParams
  if (params?.title !== undefined) {
    chartState.chart.setTitle(params.title)
  }

  return { id: envelope.id, type: 'response' }
}

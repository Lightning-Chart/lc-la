/**
 * Config handler: configure datasets, axes, series, title, scroll strategy,
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
  ConfigureAxesParams,
  ConfigureSeriesParams,
  ConfigureTitleParams,
  ConfigureAxisTitleParams,
  ConfigureScrollStrategyParams,
  ConfigureAxisIntervalParams,
  ConfigureDefaultAxisIntervalParams,
  ConfigureTickStrategyParams,
  SeriesConfig,
  DataSetConfig,
  ScrollStrategy,
} from '../types.js'
import { hostState, type DataSetState, type SeriesState } from './state.js'

const DEFAULT_MAX_SAMPLE_COUNT = 2_000_000

export function handleConfig(envelope: MessageEnvelope): ResponseEnvelope {
  switch (envelope.action) {
    case 'datasets':
      return handleDataSets(envelope)
    case 'axes':
      return handleAxes(envelope)
    case 'series':
      return handleSeries(envelope)
    case 'title':
      return handleTitle(envelope)
    case 'axisTitle':
      return handleAxisTitle(envelope)
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
  const schema: Record<string, { pattern: 'progressive' | 'regressive' | null }> = {}
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

// --- Series management ---

function handleSeries(envelope: MessageEnvelope): ResponseEnvelope {
  const chartId = envelope.chartId
  if (!chartId) return { id: envelope.id, type: 'error', error: 'Missing chartId' }

  const chartState = hostState.getChart(chartId)
  if (!chartState) return { id: envelope.id, type: 'error', error: `Chart not found: ${chartId}` }

  const params = envelope.params as unknown as ConfigureSeriesParams
  if (!params?.series) return { id: envelope.id, type: 'error', error: 'Missing series in params' }

  // Create or update series
  for (const seriesConfig of params.series) {
    const dsState = hostState.getDataSet(chartState.clientId, seriesConfig.dataSetId)
    if (!dsState) return { id: envelope.id, type: 'error', error: `DataSet not found: ${seriesConfig.dataSetId}` }

    for (const column of [seriesConfig.x, seriesConfig.y]) {
      if (!dsState.columns.includes(column)) {
        return { id: envelope.id, type: 'error', error: `Column "${column}" not found in dataset "${seriesConfig.dataSetId}"` }
      }
    }

    // Omitted IDs use the default axes
    const xAxis = seriesConfig.xAxisId === undefined 
      ? chartState.defaultXAxis : chartState.axes.get(seriesConfig.xAxisId)
    const yAxis = seriesConfig.yAxisId === undefined
      ? chartState.defaultYAxis : chartState.axes.get(seriesConfig.yAxisId)

    if (!xAxis || xAxis.target !== 'x' || !yAxis || yAxis.target !== 'y') {
      return { id: envelope.id, type: 'error', error: 'Series axis not found or has the wrong orientation' }
    }

    const existing = chartState.series.get(seriesConfig.id)
    if (existing && existing.xAxis === xAxis && existing.yAxis === yAxis) {
      // Update data bindings without recreating the series
      if (
        existing.config.dataSetId !== seriesConfig.dataSetId ||
        existing.config.x !== seriesConfig.x ||
        existing.config.y !== seriesConfig.y
      ) {
        existing.series.setDataSet(dsState.dataSet, { x: seriesConfig.x, y: seriesConfig.y })
      }

      applySeriesStyle(existing.series, seriesConfig)
      existing.config = { ...seriesConfig }
    } else {
      // Create a series, or replace it when its axes change
      const series = chartState.chart.addPointLineAreaSeries({ xAxis: xAxis.axis, yAxis: yAxis.axis })
      series.setDataSet(dsState.dataSet, { x: seriesConfig.x, y: seriesConfig.y })
      series.setAreaFillStyle(emptyFill)
      applySeriesStyle(series, seriesConfig)

      existing?.series.dispose()
      chartState.series.set(seriesConfig.id, {
        id: seriesConfig.id,
        series,
        config: { ...seriesConfig },
        xAxis,
        yAxis,
      })
    }
  }
  
  return { id: envelope.id, type: 'response' }
}

function applySeriesStyle(series: PointLineAreaSeries, config: SeriesConfig) {
  if (config.name !== undefined) series.setName(config.name)
  const color = config.color ? ColorHEX(config.color) : undefined
  const type = config.type ?? 'line'

  if (color) {
    const fill = new SolidFill({ color })
    series.setStrokeStyle(new SolidLine({ thickness: 2, fillStyle: fill }))
    series.setPointFillStyle(fill)
  }

  if (type === 'scatter') {
    series.setStrokeStyle(emptyLine)
  } else if (series.getStrokeStyle() === emptyLine) {
    // Restore the line using the current point color
    series.setStrokeStyle(new SolidLine({ thickness: 2, fillStyle: series.getPointFillStyle() }))
  }

  series.setPointSize(type === 'line' ? 0 : 6) 
}

// --- Axis management ---

function handleAxes(envelope: MessageEnvelope): ResponseEnvelope {
  const chartId = envelope.chartId
  if (!chartId) return { id: envelope.id, type: 'error', error: 'Missing chartId' }

  const chartState = hostState.getChart(chartId)
  if (!chartState) return { id: envelope.id, type: 'error', error: `Chart not found: ${chartId}` }

  const params = envelope.params as unknown as ConfigureAxesParams
  if (!params?.axes) return { id: envelope.id, type: 'error', error: 'Missing axes in params' }

  for (const axisConfig of params.axes) {
    if (axisConfig.axis !== 'x' && axisConfig.axis !== 'y') return { id: envelope.id, type: 'error', error: 'Invalid axis orientation' }

    // Reuse an axis already created for this ID
    const existing = chartState.axes.get(axisConfig.id)
    if (existing) {
      existing.axis.setTitle(axisConfig.title ?? '')
      continue
    }

    // Create the missing axis with the requested positioning
    const options = {
      opposite: axisConfig.opposite,
      iStack: axisConfig.stackIndex,
      iParallel: axisConfig.parallelIndex,
      type: 'linear-highPrecision' as const,
    }

    const axis = axisConfig.axis === 'x'
      ? chartState.chart.addAxisX(options)
      : chartState.chart.addAxisY(options)

    axis.setTitle(axisConfig.title ?? '')

    chartState.axes.set(axisConfig.id, {
      target: axisConfig.axis,
      axis,
    })
  }

  return { id: envelope.id, type: 'response' }
}

// Resolve a named axis by ID, or a default axis by X/Y orientation
function resolveAxis(envelope: MessageEnvelope, axis?: 'x' | 'y', axisId?: string): { axis: Axis; error?: undefined } | { axis?: undefined; error: ResponseEnvelope } {
  const chartId = envelope.chartId
  if (!chartId) return { error: { id: envelope.id, type: 'error', error: 'Missing chartId' } }

  const chartState = hostState.getChart(chartId)
  if (!chartState) return { error: { id: envelope.id, type: 'error', error: `Chart not found: ${chartId}` } }

  if (axis !== undefined && axis !== 'x' && axis !== 'y') return { error: { id: envelope.id, type: 'error', error: `Unknown axis: ${axis}` } }
  if (axisId === undefined && axis === undefined) {
    return { error: { id: envelope.id, type: 'error', error: 'Specify Axis for a default axis or AxisId for a named axis' } }
  }

  const selected = axisId !== undefined
    ? chartState.axes.get(axisId)
    : (axis === 'x' ? chartState.defaultXAxis : chartState.defaultYAxis)

  if (!selected || (axis !== undefined && selected.target !== axis)) {
    return { error: { id: envelope.id, type: 'error', error: `Axis not found or has the wrong orientation: ${axisId ?? axis}` } }
  }

  return { axis: selected.axis }
}

function handleAxisTitle(envelope: MessageEnvelope): ResponseEnvelope {
  const params = envelope.params as unknown as ConfigureAxisTitleParams
  if (typeof params?.title !== 'string') return { id: envelope.id, type: 'error', error: 'Missing title in params' }

  const result = resolveAxis(envelope, params.axis, params.axisId)
  if (result.error) return result.error

  result.axis.setTitle(params.title)

  return { id: envelope.id, type: 'response'}
}

function handleAxisInterval(envelope: MessageEnvelope): ResponseEnvelope {
  const params = envelope.params as unknown as ConfigureAxisIntervalParams
  if (!params) return { id: envelope.id, type: 'error', error: 'Missing params' }

  const result = resolveAxis(envelope, params.axis, params.axisId)
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
  if (!params) return { id: envelope.id, type: 'error', error: 'Missing params' }

  const result = resolveAxis(envelope, params.axis, params.axisId)
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
  if (!params?.strategy) return { id: envelope.id, type: 'error', error: 'Missing strategy in params' }

  const result = resolveAxis(envelope, params.axis, params.axisId)
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
  const params = envelope.params as unknown as ConfigureScrollStrategyParams
  if (!params?.strategy) return { id: envelope.id, type: 'error', error: 'Missing strategy in params' }

  const result = resolveAxis(envelope, params.axis, params.axisId)
  if (result.error) return result.error

  result.axis.setScrollStrategy(resolveScrollStrategy(params.strategy))

  return { id: envelope.id, type: 'response' }
}

// --- Title ---

function handleTitle(envelope: MessageEnvelope): ResponseEnvelope {
  const chartId = envelope.chartId
  if (!chartId) return { id: envelope.id, type: 'error', error: 'Missing chartId' }

  const chartState = hostState.getChart(chartId)
  if (!chartState) return { id: envelope.id, type: 'error', error: `Chart not found: ${chartId}` }

  const params = envelope.params as unknown as ConfigureTitleParams
  if (params?.title !== undefined) chartState.chart.setTitle(params.title)

  return { id: envelope.id, type: 'response' }
}
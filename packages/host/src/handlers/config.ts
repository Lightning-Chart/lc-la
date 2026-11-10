/**
 * Config handler: configure datasets, axes, series, title, scroll strategy,
 * axis intervals, tick strategies.
 * The host creates/removes LCJS DataSet, series, and axes internally.
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
} from '@lightningchart/lcjs'
import type {
  MessageEnvelope,
  ResponseEnvelope,
  ConfigureDataSetsParams,
  UpdateXYChartConfig,
  DataSetConfig,
  UpdateDataSetConfig,
  AxisConfig,
  UpdateAxisConfig,
  SeriesConfig,
  UpdateSeriesConfig,
  ScrollStrategy,
} from '../types.js'
import { hostState, type DataSetState, type AxisState, type ChartState } from './state.js'

const DEFAULT_MAX_SAMPLE_COUNT = 2_000_000

export function handleConfig(envelope: MessageEnvelope): ResponseEnvelope {
  switch (envelope.action) {
    case 'datasets':
      return handleDataSets(envelope)
    case 'update':
      return handleChartUpdate(envelope)
    default:
      return { id: envelope.id, type: 'error', error: `Unknown config action: ${envelope.action}` }
  }
}

function handleChartUpdate(envelope: MessageEnvelope): ResponseEnvelope {
  const chartId = envelope.chartId
  if (!chartId) return { id: envelope.id, type: 'error', error: 'Missing chartId' }

  const chartState = hostState.getChart(chartId)
  if (!chartState) return { id: envelope.id, type: 'error', error: `Chart not found: ${chartId}` }

  const params = envelope.params as unknown as UpdateXYChartConfig
  if (!params) return { id: envelope.id, type: 'error', error: 'Missing params' }

  // Create datasets and axes before series can reference them.
  if (params.dataSets !== undefined) {
    const result = configureDataSets(chartState.clientId, params.dataSets, envelope.id)
    if (result.type === 'error') return result
  }

  if (params.axes !== undefined) {
    const result = configureAxes(chartState, params.axes, envelope.id)
    if (result.type === 'error') return result
  }

  if (params.series !== undefined) {
    const result = configureSeries(chartState, params.series, envelope.id)
    if (result.type === 'error') return result
  }

  // Process requested removals after the requested series changes.
  if (params.axes !== undefined) {
    const result = removeAxes(chartState, params.axes, envelope.id)
    if (result.type === 'error') return result
  }

  if (params.dataSets !== undefined) {
    const result = removeDataSets(
      chartState.clientId, params.dataSets, envelope.id,
    )
    if (result.type === 'error') return result
  }

  if (params.title !== undefined) {
    chartState.chart.setTitle(params.title)
  }

  return { id: envelope.id, type: 'response' }
}

// --- Dataset management ---

function handleDataSets(envelope: MessageEnvelope): ResponseEnvelope {
  const params = envelope.params as unknown as ConfigureDataSetsParams
  if (!params?.datasets) {
    return { id: envelope.id, type: 'error', error: 'Missing datasets in params' }
  }

  const clientId = envelope.clientId ?? 'default'
  const result = configureDataSets(clientId, params.datasets, envelope.id)
  if (result.type === 'error') return result

  return removeDataSets(clientId, params.datasets, envelope.id)
}

// Shared by context dataset configuration and chart updates.
function configureDataSets(clientId: string, configs: (DataSetConfig | UpdateDataSetConfig)[], envelopeId: string): ResponseEnvelope {
  const dataSets = hostState.getDataSets(clientId)

  for (const dsConfig of configs) {
    // Removals are handled separately, after series bindings are updated.
    if ('remove' in dsConfig && dsConfig.remove === true) continue
    const existing = dataSets.get(dsConfig.id)
    const columns = 'columns' in dsConfig ? dsConfig.columns : undefined

    if (existing) {
      if (columns !== undefined) {
        const existingCols = existing.columns.slice().sort()
        const newCols = columns.map((column) => column.id).sort()
        if (existingCols.join(',') !== newCols.join(',')) {
          return { id: envelopeId, type: 'error', error: `Columns cannot be changed for existing dataset "${dsConfig.id}"` }
        }
      }

      // Retention limits can increase, but must never decrease.
      if (dsConfig.maxSampleCount !== undefined) {
        const current = existing.dataSet.getMaxSampleCount()
        if (current === undefined || dsConfig.maxSampleCount > current) {
          existing.dataSet.setMaxSampleCount(dsConfig.maxSampleCount)
        }
      }
    } else {
      if (columns === undefined) {
        return { id: envelopeId, type: 'error', error: `Columns are required for new dataset "${dsConfig.id}"` }
      }

      dataSets.set(dsConfig.id, createDataSet({
        id: dsConfig.id,
        columns,
        maxSampleCount: dsConfig.maxSampleCount,
      }))
    }
  }

  return { id: envelopeId, type: 'response' }
}

function removeDataSets(clientId: string, configs: (DataSetConfig | UpdateDataSetConfig)[], envelopeId: string): ResponseEnvelope {
  const dataSets = hostState.getDataSets(clientId)

  for (const dsConfig of configs) {
    if (!('remove' in dsConfig) || dsConfig.remove !== true) continue
    if (!dataSets.has(dsConfig.id)) {
      return { id: envelopeId, type: 'error', error: `DataSet not found: ${dsConfig.id}` }
    }
    if (hostState.isDataSetInUse(clientId, dsConfig.id)) {
      return { id: envelopeId, type: 'error', error: `Cannot remove dataset "${dsConfig.id}" while it is used by a series` }
    }
    dataSets.delete(dsConfig.id)
  }

  return { id: envelopeId, type: 'response' }
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

function configureSeries(chartState: ChartState, configs: (SeriesConfig | UpdateSeriesConfig)[], envelopeId: string): ResponseEnvelope {
 for (const seriesConfig of configs) {
    const existing = chartState.series.get(seriesConfig.id)

    // Remove only when explicitly requested.
    if ('remove' in seriesConfig && seriesConfig.remove === true) {
      if (!existing) {
        return { id: envelopeId, type: 'error', error: `Series not found: ${seriesConfig.id}` }
      }
      existing.series.dispose()
      chartState.series.delete(seriesConfig.id)
      continue
    }

    // Existing series retain their type and assigned axes.
    if (existing) {
      if (
        (seriesConfig.type !== undefined &&
          seriesConfig.type !== (existing.config.type ?? 'line')) ||
        ('xAxisId' in seriesConfig &&
          seriesConfig.xAxisId !== undefined &&
          seriesConfig.xAxisId !== existing.config.xAxisId) ||
        ('yAxisId' in seriesConfig &&
          seriesConfig.yAxisId !== undefined &&
          seriesConfig.yAxisId !== existing.config.yAxisId)
      ) {
        return { id: envelopeId, type: 'error', error: 'Series type and assigned axes cannot be changed after creation' }
      }
    }

    // Omitted bindings retain their existing values.
    const dataSetId = seriesConfig.dataSetId ?? existing?.config.dataSetId
    const x = seriesConfig.x ?? existing?.config.x
    const y = seriesConfig.y ?? existing?.config.y

    if (dataSetId === undefined || x === undefined || y === undefined) {
      return { id: envelopeId, type: 'error', error: 'A new series requires DataSetId, X, and Y' }
    }

    const dsState = hostState.getDataSet(chartState.clientId, dataSetId)
    if (!dsState) {
      return { id: envelopeId, type: 'error', error: `DataSet not found: ${dataSetId}` }
    }

    for (const column of [x, y]) {
      if (!dsState.columns.includes(column)) {
        return { id: envelopeId, type: 'error', error: `Column "${column}" not found in dataset "${dataSetId}"` }
      }
    }

    const config: SeriesConfig = {
      id: seriesConfig.id,
      type: seriesConfig.type ?? existing?.config.type ?? 'line',
      dataSetId,
      x,
      y,
      name: seriesConfig.name ?? existing?.config.name,
      color: seriesConfig.color ?? existing?.config.color,
      xAxisId: existing
        ? existing.config.xAxisId
        : 'xAxisId' in seriesConfig ? seriesConfig.xAxisId : undefined,
      yAxisId: existing
        ? existing.config.yAxisId
        : 'yAxisId' in seriesConfig ? seriesConfig.yAxisId : undefined,
    }

    if (existing) {
      // Rebind the existing series only when its data selection changes.
      if (
        existing.config.dataSetId !== config.dataSetId ||
        existing.config.x !== config.x ||
        existing.config.y !== config.y
      ) {
        existing.series.setDataSet(dsState.dataSet, { x, y })
      }

      applySeriesStyle(existing.series, config)
      existing.config = config
      continue
    }

    const xAxis = config.xAxisId === undefined ? chartState.defaultXAxis : chartState.axes.get(config.xAxisId)
    const yAxis = config.yAxisId === undefined ? chartState.defaultYAxis : chartState.axes.get(config.yAxisId)

    if (!xAxis || xAxis.target !== 'x' || !yAxis || yAxis.target !== 'y') {
      return { id: envelopeId, type: 'error', error: 'Series axis not found or has the wrong orientation' }
    }

    const series = chartState.chart.addPointLineAreaSeries({
      xAxis: xAxis.axis,
      yAxis: yAxis.axis,
    })
    series.setDataSet(dsState.dataSet, { x, y })
    series.setAreaFillStyle(emptyFill)
    applySeriesStyle(series, config)

    chartState.series.set(config.id, {
      id: config.id,
      series,
      config,
      xAxis,
      yAxis,
    })
  }

  return { id: envelopeId, type: 'response' }
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

function configureAxes(chartState: ChartState, configs: (AxisConfig | UpdateAxisConfig)[], envelopeId: string): ResponseEnvelope {
  for (const axisConfig of configs) {
    // Explicit removals are processed after series changes.
    if ('remove' in axisConfig && axisConfig.remove === true) continue

    if (axisConfig.axis !== undefined && axisConfig.axis !== 'x' && axisConfig.axis !== 'y') {
      return { id: envelopeId, type: 'error', error: 'Invalid axis orientation' }
    }

    if (
      axisConfig.tickStrategy !== undefined &&
      !['numeric', 'dateTime', 'time'].includes(axisConfig.tickStrategy)
    ) {
      return { id: envelopeId, type: 'error', error: `Unknown tick strategy: ${axisConfig.tickStrategy}` }
    }

    // An ID selects a named axis. Orientation alone selects a default axis.
    const existing = axisConfig.id !== undefined
      ? chartState.axes.get(axisConfig.id)
      : axisConfig.axis === 'x'
        ? chartState.defaultXAxis
        : axisConfig.axis === 'y'
          ? chartState.defaultYAxis
          : undefined

    if (existing) {
      if (
        (axisConfig.axis !== undefined && axisConfig.axis !== existing.target) ||
        ('opposite' in axisConfig &&
          axisConfig.opposite !== undefined &&
          axisConfig.opposite !== existing.config.opposite) ||
        ('stackIndex' in axisConfig &&
          axisConfig.stackIndex !== undefined &&
          axisConfig.stackIndex !== existing.config.stackIndex) ||
        ('parallelIndex' in axisConfig &&
          axisConfig.parallelIndex !== undefined &&
          axisConfig.parallelIndex !== existing.config.parallelIndex)
      ) {
        return { id: envelopeId, type: 'error', error: 'Axis orientation and positioning cannot be changed after creation' }
      }

      applyAxisConfig(existing, axisConfig)
      continue
    }

    // A new additional axis needs both an ID and an orientation.
    if (!axisConfig.id || axisConfig.axis === undefined) {
      return { id: envelopeId, type: 'error', error: 'A new axis requires an ID and an orientation' }
    }

    const config: AxisConfig = { ...axisConfig, axis: axisConfig.axis }
    const options = {
      opposite: config.opposite,
      iStack: config.stackIndex,
      iParallel: config.parallelIndex,
      type: 'linear-highPrecision' as const,
    }
    const axis = config.axis === 'x' ? chartState.chart.addAxisX(options) : chartState.chart.addAxisY(options)
    const axisState: AxisState = { target: config.axis, axis, config }

    chartState.axes.set(config.id!, axisState)
    applyAxisConfig(axisState, config)
  }

  return { id: envelopeId, type: 'response' }
}

function removeAxes(chartState: ChartState, configs: (AxisConfig | UpdateAxisConfig)[], envelopeId: string): ResponseEnvelope {
  for (const axisConfig of configs) {
    if (!('remove' in axisConfig) || axisConfig.remove !== true) continue

    const existing = axisConfig.id !== undefined
      ? chartState.axes.get(axisConfig.id)
      : axisConfig.axis === 'x'
        ? chartState.defaultXAxis
        : axisConfig.axis === 'y'
          ? chartState.defaultYAxis
          : undefined

    if (!existing) {
      return { id: envelopeId, type: 'error', error: 'Axis to remove was not found' }
    }

    if (axisConfig.axis !== undefined && axisConfig.axis !== existing.target) {
      return { id: envelopeId, type: 'error', error: 'Axis has the wrong orientation' }
    }

    // Default axes cannot be removed, including through their optional IDs.
    if (existing === chartState.defaultXAxis || existing === chartState.defaultYAxis) {
      return { id: envelopeId, type: 'error', error: 'Default axes cannot be removed' }
    }

    for (const series of chartState.series.values()) {
      if (series.xAxis === existing || series.yAxis === existing) {
        return { id: envelopeId, type: 'error', error: 'Cannot remove an axis while it is used by a series' }
      }
    }

    existing.axis.dispose()
    chartState.axes.delete(axisConfig.id!)
  }

  return { id: envelopeId, type: 'response' }
}

function applyAxisConfig(axisState: AxisState, axisConfig: AxisConfig | UpdateAxisConfig): void {
  const { axis, config } = axisState

  if (axisConfig.title !== undefined) axis.setTitle(axisConfig.title)

  if (axisConfig.tickStrategy !== undefined) {
    switch (axisConfig.tickStrategy) {
      case 'dateTime':
        axis.setTickStrategy(AxisTickStrategies.DateTime)
        break
      case 'time':
        axis.setTickStrategy(AxisTickStrategies.Time)
        break
      case 'numeric':
        axis.setTickStrategy(AxisTickStrategies.Numeric)
        break
    }
  }

  if (axisConfig.scrollStrategy !== undefined) {
    axis.setScrollStrategy(resolveScrollStrategy(axisConfig.scrollStrategy))
  }

  if (axisConfig.defaultInterval !== undefined) {
    const update = axisConfig.defaultInterval

    if (update.length !== undefined) {
      const length = update.length
      axis.setDefaultInterval((state) => ({
        start: (state.dataMax ?? 0) - length,
        end: state.dataMax ?? 0,
        stopAxisAfter: false,
      }))
      config.defaultInterval = { length }
    } else if (update.start !== undefined || update.end !== undefined) {
      const interval = {
        start: update.start ?? config.defaultInterval?.start,
        end: update.end ?? config.defaultInterval?.end,
      }
      axis.setDefaultInterval(interval)
      config.defaultInterval = interval
    }
  }

  // Apply only the supplied interval values to the current axis range.
  if (axisConfig.interval !== undefined) axis.setInterval(axisConfig.interval)
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
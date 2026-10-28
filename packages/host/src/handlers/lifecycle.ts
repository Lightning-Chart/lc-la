/**
 * Lifecycle handler: init, create and destroy charts.
 */

import { lightningChart, Themes } from '@lightningchart/lcjs'
import type { MessageEnvelope, ResponseEnvelope, CreateChartParams, AxisConfig, LclaTheme } from '../types.js'
import { hostState, type AxisState, type ChartState } from './state.js'
import { handleConfig } from './config.js'

let chartCounter = 0

const DEFAULT_LICENSE_INFORMATION = {
  appTitle: 'LightningChart JS Trial',
  company: 'LightningChart Ltd.',
} as const

const THEME_MAP: Record<LclaTheme, typeof Themes.darkGold> = {
  darkGold: Themes.darkGold,
  light: Themes.light,
  lightNature: Themes.lightNature,
  turquoiseHexagon: Themes.turquoiseHexagon,
  cyberSpace: Themes.cyberSpace,
}

export function handleLifecycle(envelope: MessageEnvelope): ResponseEnvelope {
  switch (envelope.action) {
    case 'init':
      return handleInit(envelope)
    case 'create':
      return handleCreate(envelope)
    case 'dispose':
      return handleDispose(envelope)
    default:
      return { id: envelope.id, type: 'error', error: `Unknown lifecycle action: ${envelope.action}` }
  }
}

function handleInit(envelope: MessageEnvelope): ResponseEnvelope {
  // Idempotent: if already initialized, skip. Only one lightningChart() call ever.
  if (hostState.hasLcjs()) {
    return { id: envelope.id, type: 'response' }
  }

  const license = envelope.params?.['license'] as string | undefined
  if (!license) {
    return { id: envelope.id, type: 'error', error: 'License key is required' }
  }

  const licenseInfo = envelope.params?.['licenseInformation'] as { appTitle?: string; company?: string } | undefined
  const themeName = envelope.params?.['theme'] as LclaTheme | undefined

  const lc = lightningChart({
    license,
    licenseInformation: {
      appTitle: licenseInfo?.appTitle ?? DEFAULT_LICENSE_INFORMATION.appTitle,
      company: licenseInfo?.company ?? DEFAULT_LICENSE_INFORMATION.company,
    },
  })
  hostState.setLcjs(lc)

  if (themeName && THEME_MAP[themeName]) {
    hostState.setTheme(THEME_MAP[themeName])
  }

  return { id: envelope.id, type: 'response' }
}

function handleCreate(envelope: MessageEnvelope): ResponseEnvelope {
  const params = envelope.params as unknown as CreateChartParams | undefined
  const chartType = params?.type ?? 'xy'

  if (chartType !== 'xy') {
    return { id: envelope.id, type: 'error', error: `Unsupported chart type: ${chartType}` }
  }

  const axes = params?.axes ?? []

  // The first axis of each orientation configures its default axis.
  const defaultXAxisConfig: AxisConfig = axes.find((axis) => axis.axis === 'x') ?? { axis: 'x' }
  const defaultYAxisConfig: AxisConfig = axes.find((axis) => axis.axis === 'y') ?? { axis: 'y' }

  // Additional axes require IDs. All assigned IDs must be unique.
  const axisIds = new Set<string>()

  for (const axisConfig of axes) {
    if (axisConfig.axis !== 'x' && axisConfig.axis !== 'y') {
      return { id: envelope.id, type: 'error', error: 'Invalid axis orientation' }
    }
    const isDefault = axisConfig === defaultXAxisConfig || axisConfig === defaultYAxisConfig
    if (!isDefault && !axisConfig.id) {
      return { id: envelope.id, type: 'error', error: 'Additional axes require an ID' }
    }
    if (axisConfig.id != null) {
      if (!axisConfig.id || axisIds.has(axisConfig.id)) {
        return { id: envelope.id, type: 'error', error: `Axis ID must be non-empty and unique: "${axisConfig.id}"` }
      }
      axisIds.add(axisConfig.id)
    }
  }

  const lcjs = hostState.getLcjs()
  const chartId = `chart-${++chartCounter}`
  const clientId = envelope.clientId ?? 'default'

  // Use the supplied container or create one.
  let container: HTMLDivElement
  if (params?.containerId) {
    const existing = document.getElementById(params.containerId)
    if (!existing) {
      return { id: envelope.id, type: 'error', error: `Container not found: ${params.containerId}` }
    }
    container = existing as HTMLDivElement
  } else {
    container = document.createElement('div')
    container.id = chartId
    container.style.width = '100%'
    container.style.height = '100%'
    document.body.appendChild(container)
  }

  const ownsContainer = !params?.containerId
  const theme = hostState.getTheme()
  const chart = lcjs.ChartXY({
    container,
    ...(theme ? { theme } : {}),
    defaultAxisX: {
      type: 'linear-highPrecision',
      opposite: defaultXAxisConfig.opposite ?? false,
      iStack: defaultXAxisConfig.stackIndex,
      iParallel: defaultXAxisConfig.parallelIndex,
    },
    defaultAxisY: {
      type: 'linear-highPrecision',
      opposite: defaultYAxisConfig.opposite ?? false,
      iStack: defaultYAxisConfig.stackIndex,
      iParallel: defaultYAxisConfig.parallelIndex,
    },
  })

  if (params?.animationsEnabled === false) chart.setAnimationsEnabled(false)

  const defaultXAxis: AxisState = {
    target: 'x',
    axis: chart.axisX,
    config: { ...defaultXAxisConfig },
  }

  const defaultYAxis: AxisState = {
    target: 'y',
    axis: chart.axisY,
    config: { ...defaultYAxisConfig },
  }
  const state: ChartState = {
    id: chartId,
    clientId,
    chart,
    series: new Map(),
    defaultXAxis,
    defaultYAxis,
    axes: new Map(),
    ownsContainer,
  }

  // IDs on default axes identify the existing default objects.
  if (defaultXAxisConfig.id != null) state.axes.set(defaultXAxisConfig.id, defaultXAxis)
  if (defaultYAxisConfig.id != null) state.axes.set(defaultYAxisConfig.id, defaultYAxis)

  hostState.addChart(chartId, state)

  // Apply initial settings through the shared configuration path.
  const result = handleConfig({
    ...envelope,
    category: 'config',
    action: 'update',
    chartId,
    params: {
      title: params?.title,
      dataSets: params?.dataSets,
      axes,
      series: params?.series,
    },
  })

  if (result.type === 'error') {
    handleDispose({ ...envelope, chartId })
    return result
  }

  return { id: envelope.id, type: 'response', result: { chartId } }
}

function handleDispose(envelope: MessageEnvelope): ResponseEnvelope {
  const chartId = envelope.chartId
  if (!chartId) {
    return { id: envelope.id, type: 'error', error: 'Missing chartId for dispose' }
  }

  const state = hostState.getChart(chartId)
  if (!state) {
    return { id: envelope.id, type: 'error', error: `Chart not found: ${chartId}` }
  }

  state.chart.dispose()
  if (state.ownsContainer) {
    const container = document.getElementById(chartId)
    if (container) container.remove()
  }
  hostState.removeChart(chartId)

  return { id: envelope.id, type: 'response' }
}

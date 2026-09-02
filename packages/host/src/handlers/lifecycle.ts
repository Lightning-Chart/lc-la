/**
 * Lifecycle handler: init, create and destroy charts.
 */

import { lightningChart, Themes } from '@lightningchart/lcjs'
import type { MessageEnvelope, ResponseEnvelope, CreateChartParams, LclaTheme } from '../types.js'
import { hostState, type ChartState } from './state.js'

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

  const lcjs = hostState.getLcjs()
  const chartId = `chart-${++chartCounter}`
  const clientId = envelope.clientId ?? 'default'

  // Use the user-provided container or create one
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
    defaultAxisX: { type: 'linear-highPrecision' },
    defaultAxisY: { type: 'linear-highPrecision' },
  })

  // Keep wheel zoom available while a live X axis is scrolling. The explicit
  // stopScroll flag releases automatic following as soon as the user zooms.
  if (params?.animationsEnabled === false) {
    chart.setAnimationsEnabled(false)
  }

  const state: ChartState = {
    id: chartId,
    clientId,
    chart,
    channels: new Map(),
    axes: new Map(),
    ownsContainer,
  }
  hostState.addChart(chartId, state)

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

/** Message categories for LCLA protocol */
export type MessageCategory = 'lifecycle' | 'config' | 'data'

/** Common JSON envelope present in every BIJ message */
export interface MessageEnvelope {
  id: string
  category: MessageCategory
  action: string
  clientId?: string
  chartId?: string
  dataSetId?: string
  params?: Record<string, unknown>
}

/** Response sent back to client */
export interface ResponseEnvelope {
  id: string
  type: 'response' | 'error'
  result?: unknown
  error?: string
}

// Lifecycle actions
export interface CreateChartParams {
  type: 'xy'
  containerId?: string
  animationsEnabled?: boolean
}

export type LclaTheme = 'darkGold' | 'light' | 'lightNature' | 'turquoiseHexagon' | 'cyberSpace'

// Config actions
export type DataPattern = 'progressive' | 'regressive' | null

export interface DataSetColumnConfig {
  id: string
  dataPattern?: DataPattern
}

export interface DataSetConfig {
  id: string
  xDataPattern?: DataPattern
  columns: DataSetColumnConfig[]
  maxSampleCount?: number
}

export interface ConfigureDataSetsParams {
  datasets: DataSetConfig[]
}

export interface ChannelConfig {
  id: string
  dataSetId: string
  column: string
  name?: string
  color?: string
  type?: 'line' | 'scatter' | 'line+scatter'
  stackIndex?: number
}

export interface ConfigureChannelsParams {
  channels: ChannelConfig[]
}

export interface ConfigureTitleParams {
  title: string
}

export type ScrollStrategy = 'scrolling' | 'fitting' | 'expansion'

export interface ConfigureScrollStrategyParams {
  axisX?: ScrollStrategy
  axisY?: ScrollStrategy
}

export type AxisTarget = 'x' | 'y'

export interface ConfigureAxisIntervalParams {
  axis: AxisTarget
  stackIndex?: number
  start?: number
  end?: number
  animate?: number | boolean
  stopAxisAfter?: boolean
}

export interface ConfigureDefaultAxisIntervalParams {
  axis: AxisTarget
  stackIndex?: number
  start?: number
  end?: number
  length?: number
}

export type TickStrategy = 'numeric' | 'dateTime' | 'time'

export interface ConfigureTickStrategyParams {
  axis: AxisTarget
  stackIndex?: number
  strategy: TickStrategy
}

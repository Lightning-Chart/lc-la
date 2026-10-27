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
export interface DefaultAxisConfig {
  id?: string
  title?: string
  opposite?: boolean
  stackIndex?: number
  parallelIndex?: number
}

export interface CreateChartParams {
  type: 'xy'
  containerId?: string
  defaultAxisX?: DefaultAxisConfig
  defaultAxisY?: DefaultAxisConfig
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
  columns: DataSetColumnConfig[]
  maxSampleCount?: number
}

export interface ConfigureDataSetsParams {
  datasets: DataSetConfig[]
}

export interface AxisConfig {
  id: string,
  axis: AxisTarget,
  title?: string,
  opposite?: boolean,
  stackIndex?: number
  parallelIndex?: number
}

export interface ConfigureAxesParams {
  axes: AxisConfig[]
}

export interface LineSeriesConfig {
  id: string
  type?: 'line'
  name?: string
  dataSetId: string
  x: string
  y: string
  xAxisId?: string
  yAxisId?: string
  color?: string
}

export interface ScatterSeriesConfig {
  id: string
  type: 'scatter'
  name?: string
  dataSetId: string
  x: string
  y: string
  xAxisId?: string
  yAxisId?: string
  color?: string
}

export interface LineScatterSeriesConfig {
  id: string
  type: 'line+scatter'
  name?: string
  dataSetId: string
  x: string
  y: string
  xAxisId?: string
  yAxisId?: string
  color?: string
}

export type SeriesConfig =
  | LineSeriesConfig
  | ScatterSeriesConfig
  | LineScatterSeriesConfig

export interface ConfigureSeriesParams {
  series: SeriesConfig[]
}

export interface ConfigureTitleParams {
  title: string
}

export interface ConfigureAxisTitleParams {
  axis?: AxisTarget
  axisId?: string
  title: string
}

export type ScrollStrategy = 'scrolling' | 'fitting' | 'expansion'

export interface ConfigureScrollStrategyParams {
  axis?: AxisTarget
  axisId?: string
  strategy: ScrollStrategy
}

export type AxisTarget = 'x' | 'y'

export interface ConfigureAxisIntervalParams {
  axis?: AxisTarget
  axisId?: string
  start?: number
  end?: number
  animate?: number | boolean
  stopAxisAfter?: boolean
}

export interface ConfigureDefaultAxisIntervalParams {
  axis?: AxisTarget
  axisId?: string
  start?: number
  end?: number
  length?: number
}

export type TickStrategy = 'numeric' | 'dateTime' | 'time'

export interface ConfigureTickStrategyParams {
  axis?: AxisTarget
  axisId?: string
  strategy: TickStrategy
}

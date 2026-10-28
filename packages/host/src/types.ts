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

export type LclaTheme = 'darkGold' | 'light' | 'lightNature' | 'turquoiseHexagon' | 'cyberSpace'

export type AxisTarget = 'x' | 'y'

export type ScrollStrategy = 'scrolling' | 'fitting' | 'expansion'

export type TickStrategy = 'numeric' | 'dateTime' | 'time'

export type DataPattern = 'progressive' | 'regressive' | null

// Dataset configuration
export interface DataSetColumnConfig {
  id: string
  dataPattern?: DataPattern
}

export interface UpdateDataSetConfig {
  id: string
  maxSampleCount?: number
  remove?: boolean
}

export interface DataSetConfig {
  id: string
  columns: DataSetColumnConfig[]
  maxSampleCount?: number
}

// Retained for context.ConfigureDataSets().
export interface ConfigureDataSetsParams {
  datasets: (DataSetConfig | UpdateDataSetConfig)[]
}

// Axis configuration
export interface AxisIntervalConfig {
  start?: number
  end?: number
  animate?: number | boolean
  stopAxisAfter?: boolean
}

export interface AxisDefaultIntervalConfig {
  start?: number
  end?: number
  length?: number
}

export interface UpdateAxisConfig {
  id?: string
  // Without an ID, orientation selects the corresponding default axis
  axis?: AxisTarget
  title?: string
  interval?: AxisIntervalConfig
  defaultInterval?: AxisDefaultIntervalConfig
  tickStrategy?: TickStrategy
  scrollStrategy?: ScrollStrategy
  remove?: boolean
}

export interface AxisConfig {
  id?: string
  axis: AxisTarget,
  title?: string
  interval?: AxisIntervalConfig
  defaultInterval?: AxisDefaultIntervalConfig
  tickStrategy?: TickStrategy
  scrollStrategy?: ScrollStrategy
  opposite?: boolean
  stackIndex?: number
  parallelIndex?: number
}

// Series configuration
export interface UpdateLineSeriesConfig {
  id: string
  type?: 'line'
  name?: string
  dataSetId?: string
  x?: string
  y?: string
  color?: string
  remove?: boolean
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

export interface UpdateScatterSeriesConfig {
  id: string
  type: 'scatter'
  name?: string
  dataSetId?: string
  x?: string
  y?: string
  color?: string
  remove?: boolean
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

export interface UpdateLineScatterSeriesConfig {
  id: string
  type: 'line+scatter'
  name?: string
  dataSetId?: string
  x?: string
  y?: string
  color?: string
  remove?: boolean
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

export type UpdateSeriesConfig =
  | UpdateLineSeriesConfig
  | UpdateScatterSeriesConfig
  | UpdateLineScatterSeriesConfig

// Chart creation
export interface XYChartConfig {
  title?: string
  containerId?: string
  animationsEnabled?: boolean
  dataSets?: DataSetConfig[]
  axes?: AxisConfig[]
  series?: SeriesConfig[]
}

export interface CreateChartParams extends XYChartConfig {
  type: 'xy'
}

export interface UpdateXYChartConfig {
  title?: string
  dataSets?: (DataSetConfig | UpdateDataSetConfig)[]
  axes?: (AxisConfig | UpdateAxisConfig)[]
  series?: (SeriesConfig | UpdateSeriesConfig)[]
}
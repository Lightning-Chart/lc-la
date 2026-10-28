/**
 * Host state: manages LCJS chart instances, datasets, axes, and series.
 *
 * Datasets are shared within a client context.
 * Each series maps dataset columns to X and Y and references its axes.
 */

import type { Axis, ChartXY, PointLineAreaSeries, LightningChart, DataSetXY, OfficialTheme } from '@lightningchart/lcjs'
import type { AxisTarget, AxisConfig, SeriesConfig } from '../types.js'
export interface DataSetState {
  id: string
  dataSet: DataSetXY
  columns: string[]
}

export interface AxisState {
  target: AxisTarget
  axis: Axis
  config: AxisConfig
}

export interface SeriesState {
  id: string
  series: PointLineAreaSeries
  config: SeriesConfig
  xAxis: AxisState
  yAxis: AxisState
}

export interface ChartState {
  id: string
  clientId: string
  chart: ChartXY
  series: Map<string, SeriesState>
  axes: Map<string, AxisState>
  defaultXAxis: AxisState
  defaultYAxis: AxisState
  ownsContainer: boolean
}

export class HostState {
  private charts = new Map<string, ChartState>()
  private dataSetsByClient = new Map<string, Map<string, DataSetState>>()
  private lcjs: LightningChart | undefined
  private theme: OfficialTheme | undefined

  setLcjs(lcjs: LightningChart) {
    this.lcjs = lcjs
  }

  setTheme(theme: OfficialTheme) {
    this.theme = theme
  }

  getTheme(): OfficialTheme | undefined {
    return this.theme
  }

  hasLcjs(): boolean {
    return this.lcjs !== undefined
  }

  getLcjs(): LightningChart {
    if (!this.lcjs) throw new Error('LightningChart not initialized')
    return this.lcjs
  }

  addChart(id: string, state: ChartState) {
    this.charts.set(id, state)
  }

  getChart(id: string): ChartState | undefined {
    return this.charts.get(id)
  }

  removeChart(id: string): boolean {
    const removedChart = this.charts.get(id)
    if (!removedChart) return false

    this.charts.delete(id)
    const clientStillHasCharts = [...this.charts.values()]
      .some((chart) => chart.clientId === removedChart.clientId)

    if (!clientStillHasCharts) this.dataSetsByClient.delete(removedChart.clientId)

    return true
  }

  getDataSets(clientId: string): Map<string, DataSetState> {
    let dataSets = this.dataSetsByClient.get(clientId)
    if (!dataSets) {
      dataSets = new Map()
      this.dataSetsByClient.set(clientId, dataSets)
    }
    return dataSets
  }

  getDataSet(clientId: string, id: string): DataSetState | undefined {
    return this.dataSetsByClient.get(clientId)?.get(id)
  }

  // Dataset removal must account for every chart in the same context.
  isDataSetInUse(clientId: string, dataSetId: string): boolean {
    for (const chart of this.charts.values()) {
      if (chart.clientId !== clientId) continue
      for (const series of chart.series.values()) {
        if (series.config.dataSetId === dataSetId) return true
      }
    }
    return false
  }
}

export const hostState = new HostState()

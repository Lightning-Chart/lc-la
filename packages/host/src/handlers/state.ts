/**
 * Host state: manages LCJS chart instances, datasets, and channels.
 *
 * Each chart has N datasets (each a DataSetXY with shared X + named Y columns).
 * Each channel binds to a dataset column and renders via a PointLineAreaSeries.
 */

import type { Axis, ChartXY, PointLineAreaSeries, LightningChart, DataSetXY, OfficialTheme } from '@lightningchart/lcjs'

export interface DataSetState {
  id: string
  dataSet: DataSetXY
  columns: string[]
}

export interface ChannelState {
  id: string
  series: PointLineAreaSeries
  dataSetId: string
  column: string
}

export interface ChartState {
  id: string
  clientId: string
  chart: ChartXY
  channels: Map<string, ChannelState>
  axes: Map<number, Axis>
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
    return this.charts.delete(id)
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
}

export const hostState = new HostState()

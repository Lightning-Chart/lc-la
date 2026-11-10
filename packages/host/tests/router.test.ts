import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bijEncode, bijDecode } from '../src/bij/index.js'
import type { SeriesConfig, UpdateSeriesConfig, AxisDefaultIntervalConfig } from '../src/types.js'

let handleMessage: typeof import('../src/handlers/router.js').handleMessage
let hostState: typeof import('../src/handlers/state.js').hostState

// Mock LCJS since we're in Node, not browser
vi.mock('@lightningchart/lcjs', () => {
  const mockDataSet = () => ({
    setMaxSampleCount: vi.fn().mockReturnThis(),
    getMaxSampleCount: vi.fn().mockReturnValue(undefined),
    setSamples: vi.fn().mockReturnThis(),
    appendSamples: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
  })

  const mockSeries = () => ({
    setDataSet: vi.fn().mockReturnThis(),
    setAreaFillStyle: vi.fn().mockReturnThis(),
    setName: vi.fn().mockReturnThis(),
    setStrokeStyle: vi.fn().mockReturnThis(),
    setPointFillStyle: vi.fn().mockReturnThis(),
    setPointSize: vi.fn().mockReturnThis(),
    getStrokeStyle: vi.fn(),
    getPointFillStyle: vi.fn(),
    dispose: vi.fn(),
  })

  const mockAxis = () => ({
    setScrollStrategy: vi.fn().mockReturnThis(),
    setInterval: vi.fn().mockReturnThis(),
    setDefaultInterval: vi.fn().mockReturnThis(),
    setTickStrategy: vi.fn().mockReturnThis(),
    setTitle: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
  })

  const mockChart = () => ({
    addPointLineAreaSeries: vi.fn(() => mockSeries()),
    addAxisX: vi.fn(() => mockAxis()),
    addAxisY: vi.fn(() => mockAxis()),
    setTitle: vi.fn().mockReturnThis(),
    setAnimationsEnabled: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
    axisX: mockAxis(),
    axisY: mockAxis(),
  })

  return {
    lightningChart: vi.fn(() => ({
      ChartXY: vi.fn(() => mockChart()),
    })),
    DataSetXY: vi.fn().mockImplementation(mockDataSet),
    AxisScrollStrategies: { scrolling: vi.fn(), fitting: vi.fn(), expansion: vi.fn() },
    AxisTickStrategies: { DateTime: 'DateTime', Time: 'Time', Numeric: 'Numeric' },
    Themes: {
      darkGold: { name: 'darkGold' },
      light: { name: 'light' },
      lightNature: { name: 'lightNature' },
      turquoiseHexagon: { name: 'turquoiseHexagon' },
      cyberSpace: { name: 'cyberSpace' },
    },
    SolidLine: vi.fn(),
    SolidFill: vi.fn(),
    ColorHEX: vi.fn(),
    emptyFill: {},
    emptyLine: {},
  }
})

// Provide a minimal DOM for lifecycle handler
beforeEach(async () => {
  // Give each test independent chart and dataset state
  vi.resetModules()
  hostState = (await import('../src/handlers/state.js')).hostState
  handleMessage = (await import('../src/handlers/router.js')).handleMessage
  // Reset state
  vi.stubGlobal('document', {
    createElement: vi.fn(() => ({
      id: '',
      style: {},
    })),
    body: {
      appendChild: vi.fn(),
    },
    getElementById: vi.fn(() => ({
      remove: vi.fn(),
    })),
  })

  // Initialize host state with mock LCJS
  const lcjs = await import('@lightningchart/lcjs')
  const lc = lcjs.lightningChart()
  hostState.setLcjs(lc as any)
})

/** Helper: create a chart and return its chartId */
function createChart(clientId = 'default'): string {
  const buf = bijEncode({
    meta: { id: '0', category: 'lifecycle', action: 'create', clientId, params: { type: 'xy' } },
  })
  const res = handleMessage(buf)
  return (res.result as any).chartId
}

/** Helper: configure a dataset on a chart */
function configureDataSet(chartId: string, dsId: string, columns: string[], clientId = 'default') {
  const buf = bijEncode({
    meta: {
      id: '0',
      category: 'config',
      action: 'datasets',
      clientId,
      chartId,
      params: {
        datasets: [
          { id: dsId, columns: columns.map((c) => ({ id: c })) },
        ],
      },
    },
  })
  const res = handleMessage(buf)
  expect(res.type).toBe('response')
}

/** Helper: create, update, or explicitly remove series through chart update. */
function configureSeries(chartId: string, series: (SeriesConfig | UpdateSeriesConfig)[]) {
  const buf = bijEncode({
    meta: {
      id: '0',
      category: 'config',
      action: 'update',
      chartId,
      params: { series },
    },
  })
  const res = handleMessage(buf)
  expect(res.type).toBe('response')
}

describe('Message Router', () => {
  it('handles lifecycle/init', async () => {
    hostState.setLcjs(undefined as never)
    const lcjs = await import('@lightningchart/lcjs')
    vi.mocked(lcjs.lightningChart).mockClear()

    const buffer = bijEncode({
      meta: { id: '0', category: 'lifecycle', action: 'init', params: { license: 'test-key' } },
    })
    const response = handleMessage(buffer)

    expect(response.type).toBe('response')
    expect(response.id).toBe('0')
    expect(lcjs.lightningChart).toHaveBeenCalledWith({
      license: 'test-key',
      licenseInformation: {
        appTitle: 'LightningChart JS Trial',
        company: 'LightningChart Ltd.',
      },
    })
  })

  it('handles lifecycle/create', () => {
    const buffer = bijEncode({
      meta: { id: '1', category: 'lifecycle', action: 'create', params: { type: 'xy' } },
    })
    const response = handleMessage(buffer)

    expect(response.type).toBe('response')
    expect(response.id).toBe('1')
    expect((response.result as any).chartId).toMatch(/^chart-/)
  })

  it('returns error for missing meta', () => {
    const buffer = bijEncode({ something: 'else' })
    const response = handleMessage(buffer)

    expect(response.type).toBe('error')
    expect(response.error).toContain('Missing "meta"')
  })

  it('returns error for unknown category', () => {
    const buffer = bijEncode({
      meta: { id: '2', category: 'unknown', action: 'foo' },
    })
    const response = handleMessage(buffer)

    expect(response.type).toBe('error')
    expect(response.error).toContain('Unknown category')
  })

  it('handles lifecycle/create then lifecycle/dispose', () => {
    const chartId = createChart()

    const disposeBuf = bijEncode({
      meta: { id: '2', category: 'lifecycle', action: 'dispose', chartId },
    })
    const disposeRes = handleMessage(disposeBuf)
    expect(disposeRes.type).toBe('response')
  })

  it('handles config/datasets', () => {
    const chartId = createChart()

    const buf = bijEncode({
      meta: {
        id: '2',
        category: 'config',
        action: 'datasets',
        chartId,
        params: {
          datasets: [
            { id: 'sensors', columns: [{ id: 'temperature' }, { id: 'humidity' }], maxSampleCount: 500000 },
          ],
        },
      },
    })
    const res = handleMessage(buf)
    expect(res.type).toBe('response')
  })

  it('handles config/series bound to dataset columns', () => {
    const chartId = createChart()
    configureDataSet(chartId, 'sensors', ['time', 'temperature', 'humidity'])

    configureSeries(chartId, [
      { id: 'temp-line', dataSetId: 'sensors', x: 'time', y: 'temperature' },
      { id: 'humid-line', dataSetId: 'sensors', x: 'time', y: 'humidity' },
    ])
  })

  it('adds and updates individual series without removing omitted series', () => {
    const chartId = createChart()
    configureDataSet(chartId, 'dataset', ['x', 'y'])

    configureSeries(chartId, [
      {
        id: 'series-1',
        dataSetId: 'dataset',
        x: 'x',
        y: 'y',
        name: 'Series 1',
      },
    ])

    const chartState = hostState.getChart(chartId)!
    const first = chartState.series.get('series-1')!

    // Adding another series must preserve the first.
    configureSeries(chartId, [
      {
        id: 'series-2',
        dataSetId: 'dataset',
        x: 'x',
        y: 'y',
        name: 'Series 2',
      },
    ])

    const second = chartState.series.get('series-2')!
    expect(chartState.series.size).toBe(2)
    expect(chartState.series.get('series-1')).toBe(first)

    // Updating the first must leave the second unchanged.
    configureSeries(chartId, [
      {
        id: 'series-1',
        name: 'Updated series',
        color: '#FFFFFF',
      },
    ])

    expect(chartState.series.get('series-1')).toBe(first)
    expect(first.series.setName).toHaveBeenLastCalledWith('Updated series')
    expect(first.config.color).toBe('#FFFFFF')
    expect(chartState.series.get('series-2')).toBe(second)
    expect(second.config.name).toBe('Series 2')

    // An empty configuration must preserve both.
    configureSeries(chartId, [])

    expect(chartState.series.size).toBe(2)
    expect(first.series.dispose).not.toHaveBeenCalled()
    expect(second.series.dispose).not.toHaveBeenCalled()
  })

  it('shares a client dataset across its charts', () => {
    const firstChartId = createChart()
    const secondChartId = createChart()
    configureDataSet(firstChartId, 'sensors', ['time', 'temperature'])

    configureSeries(secondChartId, [
      { id: 'temp-line', dataSetId: 'sensors', x: 'time', y: 'temperature' },
    ])

    expect(hostState.getDataSet('default', 'sensors')).toBeDefined()
  })

  it('preserves client datasets until its final chart is disposed', () => {
    const clientId = 'dataset-lifecycle-test'
    const firstChartId = createChart(clientId)
    const secondChartId = createChart(clientId)

    configureDataSet(firstChartId, 'sensors', ['temperature'], clientId)
    configureDataSet(secondChartId, 'signals', ['value'], clientId)

    // Configuring the second chart must not remove the first dataset
    expect(hostState.getDataSet(clientId, 'sensors')).toBeDefined()
    expect(hostState.getDataSet(clientId, 'signals')).toBeDefined()

    const firstDisposeResponse = handleMessage(bijEncode({
      meta: {
        id: 'dispose-1',
        category: 'lifecycle',
        action: 'dispose',
        clientId,
        chartId: firstChartId,
      },
    }))

    expect(firstDisposeResponse.type).toBe('response')

    // Another chart from this client still exists, so retain its datasets
    expect(hostState.getDataSet(clientId, 'sensors')).toBeDefined()
    expect(hostState.getDataSet(clientId, 'signals')).toBeDefined()

    const secondDisposeResponse = handleMessage(bijEncode({
      meta: {
        id: 'dispose-2',
        category: 'lifecycle',
        action: 'dispose',
        clientId,
        chartId: secondChartId,
      },
    }))

    expect(secondDisposeResponse.type).toBe('response')

    // The final client chart is gone, so its datasets are released
    expect(hostState.getDataSet(clientId, 'sensors')).toBeUndefined()
    expect(hostState.getDataSet(clientId, 'signals')).toBeUndefined()
  })

  it('handles config/series with stacked axes', () => {
    const chartId = createChart()
    configureDataSet(chartId, 'sensors', ['time', 'temperature', 'humidity', 'voltage'])

    const axesResponse = handleMessage(bijEncode({
      meta: {
      id: '2',
      category: 'config',
      action: 'update',
      chartId,
      params: {
        axes: [
          { id: 'humidity-axis', axis: 'y', stackIndex: 1 },
          { id: 'voltage-axis', axis: 'y', stackIndex: 2 },
        ],
      },
      },
    }))
    expect(axesResponse.type).toBe('response')

    configureSeries(chartId, [
      { id: 'temp-line', dataSetId: 'sensors', x: 'time', y: 'temperature' },
      { id: 'humid-line', dataSetId: 'sensors', x: 'time', y: 'humidity', yAxisId: 'humidity-axis' },
      { id: 'volt-line', dataSetId: 'sensors', x: 'time', y: 'voltage', yAxisId: 'voltage-axis' },
    ])

    const chartState = hostState.getChart(chartId)!
    expect(chartState.series.get('temp-line')?.yAxis).toBe(chartState.defaultYAxis)
    expect(chartState.series.get('humid-line')?.yAxis).toBe(chartState.axes.get('humidity-axis'))
    expect(chartState.series.get('volt-line')?.yAxis).toBe(chartState.axes.get('voltage-axis'))
    })

  it('returns error for series referencing nonexistent dataset', () => {
    const chartId = createChart()

    const buf = bijEncode({
      meta: {
        id: '2',
        category: 'config',
        action: 'update',
        chartId,
        params: {
          series: [{ id: 'ch1', dataSetId: 'nonexistent', x: 'time', y: 'temp' }],
        },
      },
    })
    const res = handleMessage(buf)
    expect(res.type).toBe('error')
    expect(res.error).toContain('DataSet not found')
  })

  it('returns error for series referencing nonexistent column', () => {
    const chartId = createChart()
    configureDataSet(chartId, 'sensors', ['time', 'temperature'])

    const buf = bijEncode({
      meta: {
        id: '2',
        category: 'config',
        action: 'update',
        chartId,
        params: {
          series: [{ id: 'ch1', dataSetId: 'sensors', x: 'time', y: 'nonexistent' }],
        },
      },
    })
    const res = handleMessage(buf)
    expect(res.type).toBe('error')
    expect(res.error).toContain('Column')
  })

  it('updates the chart title', () => {
    const chartId = createChart()

    const response = handleMessage(bijEncode({
      meta: {
        id: '2',
        category: 'config',
        action: 'update',
        chartId,
        params: { title: 'My Chart' },
      },
    }))

    expect(response.type).toBe('response')
    expect(hostState.getChart(chartId)!.chart.setTitle)
      .toHaveBeenLastCalledWith('My Chart')
  })

  it('handles data/set with shared timestamps and multiple columns', () => {
    const chartId = createChart()
    configureDataSet(chartId, 'sensors', ['time', 'temperature', 'humidity'])
    configureSeries(chartId, [
      { id: 'temp-line', dataSetId: 'sensors', x: 'time', y: 'temperature' },
      { id: 'humid-line', dataSetId: 'sensors', x: 'time', y: 'humidity' },
    ])

    const x = new Float64Array([1, 2, 3, 4, 5])
    const temperature = new Float64Array([20, 21, 22, 23, 24])
    const humidity = new Float64Array([40, 42, 45, 47, 50])

    const dataBuf = bijEncode([
      { key: 'meta', value: { id: '5', category: 'data', action: 'set', chartId, dataSetId: 'sensors' } },
      { key: 'time', value: x },
      { key: 'temperature', value: temperature },
      { key: 'humidity', value: humidity },
    ])
    const dataRes = handleMessage(dataBuf)
    expect(dataRes.type).toBe('response')
  })

  it('handles data/append with shared timestamps', () => {
    const chartId = createChart()
    configureDataSet(chartId, 'sensors', ['time', 'temperature', 'humidity'])
    configureSeries(chartId, [
      { id: 'temp-line', dataSetId: 'sensors', x: 'time', y: 'temperature' },
    ])

    const dataBuf = bijEncode([
      { key: 'meta', value: { id: '5', category: 'data', action: 'append', chartId, dataSetId: 'sensors' } },
      { key: 'time', value: new Float64Array([1, 2]) },
      { key: 'temperature', value: new Float64Array([20, 21]) },
      { key: 'humidity', value: new Float64Array([40, 42]) },
    ])
    const dataRes = handleMessage(dataBuf)
    expect(dataRes.type).toBe('response')
  })

  it('returns error for data on unknown dataset', () => {
    const chartId = createChart()

    const dataBuf = bijEncode([
      { key: 'meta', value: { id: '2', category: 'data', action: 'set', chartId, dataSetId: 'nonexistent' } },
      { key: 'time', value: new Float64Array([1]) },
    ])
    const dataRes = handleMessage(dataBuf)
    expect(dataRes.type).toBe('error')
    expect(dataRes.error).toContain('DataSet not found')
  })

  it('supports multiple datasets per chart', () => {
    const chartId = createChart()

    // Two independent datasets
    const buf = bijEncode({
      meta: {
        id: '2',
        category: 'config',
        action: 'datasets',
        chartId,
        params: {
          datasets: [
            { id: 'sensors', columns: [ { id: 'time' }, { id: 'temperature' }, { id: 'humidity' }, ],},
            { id: 'gps', columns: [ { id: 'time' }, { id: 'lat' }, { id: 'lon' }, ], },
          ],
        },
      },
    })
    const res = handleMessage(buf)
    expect(res.type).toBe('response')

    // Series from different datasets
    configureSeries(chartId, [
      { id: 'temp-line', dataSetId: 'sensors', x: 'time', y: 'temperature' },
      { id: 'lat-line', dataSetId: 'gps', x: 'time', y: 'lat' },
    ])

    // Push to each dataset independently
    const sensorBuf = bijEncode([
      { key: 'meta', value: { id: '10', category: 'data', action: 'set', chartId, dataSetId: 'sensors' } },
      { key: 'time', value: new Float64Array([1, 2, 3]) },
      { key: 'temperature', value: new Float64Array([20, 21, 22]) },
      { key: 'humidity', value: new Float64Array([40, 42, 45]) },
    ])
    expect(handleMessage(sensorBuf).type).toBe('response')

    const gpsBuf = bijEncode([
      { key: 'meta', value: { id: '11', category: 'data', action: 'set', chartId, dataSetId: 'gps' } },
      { key: 'time', value: new Float64Array([100, 200]) },
      { key: 'lat', value: new Float64Array([60.1, 60.2]) },
      { key: 'lon', value: new Float64Array([24.9, 25.0]) },
    ])
    expect(handleMessage(gpsBuf).type).toBe('response')
  })

  it.each(['x', 'y'] as const)('updates the default %s axis title without an ID', (axis) => {
    const chartId = createChart()
    const chartState = hostState.getChart(chartId)!
    const selected = axis === 'x' ? chartState.defaultXAxis : chartState.defaultYAxis
    const other = axis === 'x' ? chartState.defaultYAxis : chartState.defaultXAxis

    const response = handleMessage(bijEncode({
      meta: {
        id: 'axis-title',
        category: 'config',
        action: 'update',
        chartId,
        params: {
          axes: [{ axis, title: 'Updated title' }],
        },
      },
    }))
    expect(response.type).toBe('response')
    expect(selected.axis.setTitle).toHaveBeenCalledWith('Updated title')
    expect(other.axis.setTitle).not.toHaveBeenCalled()
  })

  it('registers default-axis IDs without creating additional axes', () => {
    const response = handleMessage(bijEncode({
      meta: {
        id: 'create',
        category: 'lifecycle',
        action: 'create',
        params: {
          type: 'xy',
          axes: [
            { id: 'time', axis: 'x', title: 'Time' },
            { id: 'temperature', axis: 'y', title: 'Temperature' },
          ],
        },
      },
    }))
    expect(response.type).toBe('response')

    const chartId = (response.result as { chartId: string }).chartId
    const chartState = hostState.getChart(chartId)!
    expect(chartState.axes.get('time')).toBe(chartState.defaultXAxis)
    expect(chartState.axes.get('temperature')).toBe(chartState.defaultYAxis)
    expect(chartState.chart.addAxisX).not.toHaveBeenCalled()
    expect(chartState.chart.addAxisY).not.toHaveBeenCalled()
    expect(chartState.defaultXAxis.axis.setTitle).toHaveBeenCalledWith('Time')
    expect(chartState.defaultYAxis.axis.setTitle).toHaveBeenCalledWith('Temperature')

    const titleResponse = handleMessage(bijEncode({
      meta: {
        id: 'axis-title',
        category: 'config',
        action: 'update',
        chartId,
        params: {
          axes: [{ id: 'temperature', title: '' }],
        },
      },
    }))
    expect(titleResponse.type).toBe('response')
    expect(chartState.defaultYAxis.axis.setTitle).toHaveBeenLastCalledWith('')
  })

  it.each(['x', 'y'] as const)('updates an additional %s axis title by ID', (axis) => {
    const chartId = createChart()

    const axesResponse = handleMessage(bijEncode({
      meta: {
        id: 'axes',
        category: 'config',
        action: 'update',
        chartId,
        params: {
          axes: [{ id: 'additional', axis, title: 'Original title' }],
        },
      },
    }))
    expect(axesResponse.type).toBe('response')

    const titleResponse = handleMessage(bijEncode({
      meta: {
        id: 'axis-title',
        category: 'config',
        action: 'update',
        chartId,
        params: {
          axes: [{ id: 'additional', title: 'Updated title' }],
        },
      },
    }))
    expect(titleResponse.type).toBe('response')

    const chartState = hostState.getChart(chartId)!
    expect(chartState.axes.get('additional')!.axis.setTitle).toHaveBeenLastCalledWith('Updated title')
    expect(chartState.defaultXAxis.axis.setTitle).not.toHaveBeenCalled()
    expect(chartState.defaultYAxis.axis.setTitle).not.toHaveBeenCalled()
  })

  it('passes default-axis positioning options to chart creation', () => {
    const response = handleMessage(bijEncode({
      meta: {
        id: 'create',
        category: 'lifecycle',
        action: 'create',
        params: {
          type: 'xy',
          axes: [
            { axis: 'x', opposite: true, stackIndex: -1, parallelIndex: 2 },
            { axis: 'y', opposite: true, stackIndex: 1, parallelIndex: -2 },
          ],
        },
      },
    }))
    expect(response.type).toBe('response')
    expect(hostState.getLcjs().ChartXY).toHaveBeenLastCalledWith(
      expect.objectContaining({
        defaultAxisX: expect.objectContaining({ opposite: true, iStack: -1, iParallel: 2 }),
        defaultAxisY: expect.objectContaining({ opposite: true, iStack: 1, iParallel: -2 }),
      }),
    )
  })

  it('updates the current axis interval', () => {
    const chartId = createChart()
    const response = handleMessage(bijEncode({
      meta: {
        id: '2',
        category: 'config',
        action: 'update',
        chartId,
        params: {
          axes: [
            { axis: 'x', interval: { start: 0, end: 10000, stopAxisAfter: false } },
          ],
        },
      },
    }))
    expect(response.type).toBe('response')
    expect(hostState.getChart(chartId)!.defaultXAxis.axis.setInterval)
      .toHaveBeenCalledWith({ start: 0, end: 10000, stopAxisAfter: false })
  })

  it('updates the default axis interval with a trailing length', () => {
    const chartId = createChart()
    const response = handleMessage(bijEncode({
      meta: {
        id: '2',
        category: 'config',
        action: 'update',
        chartId,
        params: {
          axes: [{ axis: 'x', defaultInterval: { length: 5000 } }],
        },
      },
    }))
    expect(response.type).toBe('response')
    expect(hostState.getChart(chartId)!.defaultXAxis.axis.setDefaultInterval)
      .toHaveBeenCalledWith(expect.any(Function))
  })

  it('updates the axis tick strategy', () => {
    const chartId = createChart()
    const response = handleMessage(bijEncode({
      meta: {
        id: '2',
        category: 'config',
        action: 'update',
        chartId,
        params: {
          axes: [{ axis: 'x', tickStrategy: 'dateTime' }],
        },
      },
    }))
    expect(response.type).toBe('response')
    expect(hostState.getChart(chartId)!.defaultXAxis.axis.setTickStrategy)
      .toHaveBeenCalledWith('DateTime')
  })

  it('rebinds an existing series before removing its old dataset', () => {
    const chartId = createChart()
    configureDataSet(chartId, 'old-data', ['x', 'y'])
    configureSeries(chartId, [
      { id: 'series-1', name: 'Original name', dataSetId: 'old-data', x: 'x', y: 'y' },
    ])

    const chartState = hostState.getChart(chartId)!
    const existing = chartState.series.get('series-1')!

    const response = handleMessage(bijEncode({
      meta: {
        id: 'replace-data',
        category: 'config',
        action: 'update',
        chartId,
        params: {
          dataSets: [
            { id: 'old-data', remove: true },
            { id: 'new-data', columns: [{ id: 'new-x' }, { id: 'new-y' }] },
          ],
          series: [
            { id: 'series-1', dataSetId: 'new-data', x: 'new-x', y: 'new-y' },
          ],
        },
      },
    }))
    expect(response.type).toBe('response')
    expect(hostState.getDataSet('default', 'old-data')).toBeUndefined()

    const newDataSet = hostState.getDataSet('default', 'new-data')!
    expect(newDataSet).toBeDefined()
    expect(chartState.series.get('series-1')).toBe(existing)
    expect(existing.series.dispose).not.toHaveBeenCalled()
    expect(existing.series.setDataSet)
      .toHaveBeenLastCalledWith(newDataSet.dataSet, { x: 'new-x', y: 'new-y' })
    expect(existing.config)
      .toMatchObject({ name: 'Original name', dataSetId: 'new-data', x: 'new-x', y: 'new-y' })
  })

  it.each(['update', 'datasets'] as const)('protects datasets used by another chart through config/%s',
    (action) => {
      const firstChartId = createChart()
      const secondChartId = createChart()

      configureDataSet(firstChartId, 'shared-data', ['x', 'y'])
      configureSeries(secondChartId, [
        { id: 'series-1', dataSetId: 'shared-data', x: 'x', y: 'y' },
      ])

      const dataSet = hostState.getDataSet('default', 'shared-data')!
      const secondChart = hostState.getChart(secondChartId)!
      const series = secondChart.series.get('series-1')!
      const removals = [{ id: 'shared-data', remove: true }]

      const request = bijEncode({
        meta: {
          id: 'remove-dataset',
          category: 'config',
          action,
          clientId: 'default',
          chartId: firstChartId,
          params: action === 'update'
            ? { dataSets: removals }
            : { datasets: removals },
        },
      })

      const rejected = handleMessage(request)
      expect(rejected.type).toBe('error')
      expect(rejected.error).toContain('while it is used by a series')
      expect(hostState.getDataSet('default', 'shared-data')).toBe(dataSet)
      expect(secondChart.series.get('series-1')).toBe(series)
      expect(series.series.dispose).not.toHaveBeenCalled()

      // Explicitly removing the last attached series permits dataset removal
      configureSeries(secondChartId, [
        { id: 'series-1', remove: true },
      ])
      expect(series.series.dispose).toHaveBeenCalledTimes(1)
      expect(secondChart.series.has('series-1')).toBe(false)

      const removed = handleMessage(request)
      expect(removed.type).toBe('response')
      expect(hostState.getDataSet('default', 'shared-data')).toBeUndefined()
    },
  )

  it.each(['x', 'y'] as const)('prevents removing the default %s axis by orientation or ID',
    (axis) => {
      const response = handleMessage(bijEncode({
        meta: {
          id: 'create',
          category: 'lifecycle',
          action: 'create',
          params: {
            type: 'xy',
            axes: [{ axis, id: 'default-axis' }],
          },
        },
      }))
      expect(response.type).toBe('response')

      const chartId = (response.result as { chartId: string }).chartId
      const chartState = hostState.getChart(chartId)!
      const selected = chartState.axes.get('default-axis')!

      for (const selector of [{ axis }, { id: 'default-axis' }]) {
        const result = handleMessage(bijEncode({
          meta: {
            id: 'remove-default',
            category: 'config',
            action: 'update',
            chartId,
            params: {
              axes: [{ ...selector, remove: true }],
            },
          },
        }))
        expect(result.type).toBe('error')
        expect(result.error).toContain('Default axes cannot be removed')
        expect(chartState.axes.get('default-axis')).toBe(selected)
        expect(selected.axis.dispose).not.toHaveBeenCalled()
      }
    },
  )

  it.each(['x', 'y'] as const)('removes an additional %s axis only after its series is removed',
    (axis) => {
      const response = handleMessage(bijEncode({
        meta: {
          id: 'create',
          category: 'lifecycle',
          action: 'create',
          params: {
            type: 'xy',
            dataSets: [
              { id: 'dataset', columns: [{ id: 'x' }, { id: 'y' }] },
            ],
            axes: [
              { axis },
              { axis, id: 'additional' },
            ],
            series: [
              {
                id: 'series-1',
                dataSetId: 'dataset',
                x: 'x',
                y: 'y',
                [axis === 'x' ? 'xAxisId' : 'yAxisId']: 'additional',
              },
            ],
          },
        },
      }))
      expect(response.type).toBe('response')

      const chartId = (response.result as { chartId: string }).chartId
      const chartState = hostState.getChart(chartId)!
      const additional = chartState.axes.get('additional')!
      const series = chartState.series.get('series-1')!

      const rejected = handleMessage(bijEncode({
        meta: {
          id: 'remove-axis',
          category: 'config',
          action: 'update',
          chartId,
          params: {
            axes: [{ id: 'additional', remove: true }],
          },
        },
      }))
      expect(rejected.type).toBe('error')
      expect(rejected.error).toContain('while it is used by a series')
      expect(chartState.axes.get('additional')).toBe(additional)
      expect(additional.axis.dispose).not.toHaveBeenCalled()
      expect(series.series.dispose).not.toHaveBeenCalled()

      const removed = handleMessage(bijEncode({
        meta: {
          id: 'remove-both',
          category: 'config',
          action: 'update',
          chartId,
          params: {
            axes: [{ id: 'additional', remove: true }],
            series: [{ id: 'series-1', remove: true }],
          },
        },
      }))
      expect(removed.type).toBe('response')
      expect(chartState.axes.has('additional')).toBe(false)
      expect(chartState.series.has('series-1')).toBe(false)
      expect(additional.axis.dispose).toHaveBeenCalledTimes(1)
      expect(series.series.dispose).toHaveBeenCalledTimes(1)
    },
  )

  it.each([
    { axis: 'x' }, { opposite: true }, { stackIndex: 1 }, { parallelIndex: 1 },
  ])('rejects changes to axis creation settings: %j', (change) => {
    const response = handleMessage(bijEncode({
      meta: {
        id: 'create',
        category: 'lifecycle',
        action: 'create',
        params: {
          type: 'xy',
          axes: [
            { id: 'axis-1', axis: 'y', title: 'Original title', opposite: false, stackIndex: 0, parallelIndex: 0 },
          ],
        },
      },
    }))
    expect(response.type).toBe('response')

    const chartId = (response.result as { chartId: string }).chartId
    const chartState = hostState.getChart(chartId)!
    const existing = chartState.axes.get('axis-1')!
    const originalConfig = { ...existing.config }

    const rejected = handleMessage(bijEncode({
      meta: {
        id: 'change-axis',
        category: 'config',
        action: 'update',
        chartId,
        params: {
          axes: [{ id: 'axis-1', title: 'Changed title', ...change }],
        },
      },
    }))
    expect(rejected.type).toBe('error')
    expect(rejected.error).toContain('Axis orientation and positioning cannot be changed after creation')
    expect(chartState.axes.get('axis-1')).toBe(existing)
    expect(existing.config).toEqual(originalConfig)
    expect(existing.axis.setTitle).toHaveBeenLastCalledWith('Original title')
    expect(existing.axis.dispose).not.toHaveBeenCalled()
  })

  it.each([
    { type: 'scatter' }, { xAxisId: 'another-x' }, { yAxisId: 'another-y' },
  ])('rejects changes to series creation settings: %j', (change) => {
    const chartId = createChart()
    configureDataSet(chartId, 'dataset', ['x', 'y'])
    configureSeries(chartId, [
      {
        id: 'series-1',
        name: 'Original name',
        dataSetId: 'dataset',
        x: 'x',
        y: 'y',
      },
    ])

    const chartState = hostState.getChart(chartId)!
    const existing = chartState.series.get('series-1')!
    const originalConfig = existing.config

    const rejected = handleMessage(bijEncode({
      meta: {
        id: 'change-series',
        category: 'config',
        action: 'update',
        chartId,
        params: {
          series: [{ id: 'series-1', name: 'Changed name', ...change }],
        },
      },
    }))

    expect(rejected.type).toBe('error')
    expect(rejected.error).toContain('Series type and assigned axes cannot be changed after creation')
    expect(chartState.series.get('series-1')).toBe(existing)
    expect(existing.config).toBe(originalConfig)
    expect(existing.series.setName).toHaveBeenLastCalledWith('Original name')
    expect(existing.series.dispose).not.toHaveBeenCalled()
    expect(chartState.chart.addPointLineAreaSeries).toHaveBeenCalledTimes(1)
  })

  it('switches between trailing and fixed default intervals', () => {
    const chartId = createChart()
    const selected = hostState.getChart(chartId)!.defaultXAxis
    const setDefaultInterval = vi.mocked(selected.axis.setDefaultInterval)

    function updateInterval(defaultInterval: AxisDefaultIntervalConfig) {
      const response = handleMessage(bijEncode({
      meta: {
        id: 'default-interval',
        category: 'config',
        action: 'update',
        chartId,
        params: {
          axes: [{ axis: 'x', defaultInterval }],
        },
      },
      }))
      expect(response.type).toBe('response')
    }

    updateInterval({ length: 20 })
    expect(setDefaultInterval).toHaveBeenLastCalledWith(expect.any(Function))
    expect(selected.config.defaultInterval).toEqual({ length: 20 })

    // Fixed bounds replace the previous trailing window
    updateInterval({ start: 0, end: 100 })
    expect(setDefaultInterval).toHaveBeenLastCalledWith({ start: 0, end: 100 })
    expect(selected.config.defaultInterval).toEqual({ start: 0, end: 100 })

    // A partial fixed-range update preserves the other bound
    updateInterval({ end: 200 })
    expect(setDefaultInterval).toHaveBeenLastCalledWith({ start: 0, end: 200 })

    // A trailing window replaces the previous fixed bounds
    updateInterval({ length: 50 })
    expect(setDefaultInterval).toHaveBeenLastCalledWith(expect.any(Function))
    expect(selected.config.defaultInterval).toEqual({ length: 50 })

    // An empty update leaves the configuration unchanged
    const callCount = setDefaultInterval.mock.calls.length
    updateInterval({})
    expect(setDefaultInterval).toHaveBeenCalledTimes(callCount)
    expect(selected.config.defaultInterval).toEqual({ length: 50 })
  })

  it.each([
    {
      name: 'removing an unknown axis',
      params: { axes: [{ id: 'missing', remove: true }] },
      error: 'Axis to remove was not found',
    },
    {
      name: 'removing an unknown series',
      params: { series: [{ id: 'missing', remove: true }] },
      error: 'Series not found: missing',
    },
    {
      name: 'removing an unknown dataset',
      params: { dataSets: [{ id: 'missing', remove: true }] },
      error: 'DataSet not found: missing',
    },
    {
      name: 'an unknown tick strategy',
      params: { axes: [{ axis: 'x', tickStrategy: 'unknown' }] },
      error: 'Unknown tick strategy: unknown',
    },
  ])('returns an error for $name', ({ params, error }) => {
    const chartId = createChart()

    const response = handleMessage(bijEncode({
      meta: {
        id: 'invalid-update',
        category: 'config',
        action: 'update',
        chartId,
        params,
      },
    }))
    expect(response.type).toBe('error')
    expect(response.error).toBe(error)
  })

  it('handles lifecycle/init with theme', () => {
    const buf = bijEncode({
      meta: { id: '0', category: 'lifecycle', action: 'init', params: { license: 'test-key', theme: 'light' } },
    })
    // init is idempotent (already initialized in beforeEach), so this succeeds silently
    expect(handleMessage(buf).type).toBe('response')
  })
})
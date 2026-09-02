import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bijEncode, bijDecode } from '../src/bij/index.js'
import { handleMessage } from '../src/handlers/router.js'
import { hostState } from '../src/handlers/state.js'

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
    dispose: vi.fn(),
  })

  const mockAxis = () => ({
    setScrollStrategy: vi.fn().mockReturnThis(),
    setInterval: vi.fn().mockReturnThis(),
    setDefaultInterval: vi.fn().mockReturnThis(),
    setTickStrategy: vi.fn().mockReturnThis(),
  })

  const mockChart = () => ({
    addPointLineAreaSeries: vi.fn().mockReturnValue(mockSeries()),
    addAxisY: vi.fn().mockReturnValue(mockAxis()),
    setTitle: vi.fn().mockReturnThis(),
    setAnimationsEnabled: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
    axisX: mockAxis(),
    axisY: mockAxis(),
  })

  return {
    lightningChart: vi.fn(() => ({
      ChartXY: vi.fn().mockReturnValue(mockChart()),
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
function createChart(): string {
  const buf = bijEncode({
    meta: { id: '0', category: 'lifecycle', action: 'create', params: { type: 'xy' } },
  })
  const res = handleMessage(buf)
  return (res.result as any).chartId
}

/** Helper: configure a dataset on a chart */
function configureDataSet(chartId: string, dsId: string, columns: string[]) {
  const buf = bijEncode({
    meta: {
      id: '0',
      category: 'config',
      action: 'datasets',
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

/** Helper: configure channels on a chart */
function configureChannels(chartId: string, channels: Array<{ id: string; dataSetId: string; column: string; stackIndex?: number }>) {
  const buf = bijEncode({
    meta: {
      id: '0',
      category: 'config',
      action: 'channels',
      chartId,
      params: { channels },
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

  it('handles config/channels bound to dataset columns', () => {
    const chartId = createChart()
    configureDataSet(chartId, 'sensors', ['temperature', 'humidity'])

    configureChannels(chartId, [
      { id: 'temp-line', dataSetId: 'sensors', column: 'temperature' },
      { id: 'humid-line', dataSetId: 'sensors', column: 'humidity' },
    ])
  })

  it('shares a client dataset across its charts', () => {
    const firstChartId = createChart()
    const secondChartId = createChart()
    configureDataSet(firstChartId, 'sensors', ['temperature'])

    configureChannels(secondChartId, [
      { id: 'temp-line', dataSetId: 'sensors', column: 'temperature' },
    ])

    expect(hostState.getDataSet('default', 'sensors')).toBeDefined()
  })

  it('handles config/channels with stacked axes', () => {
    const chartId = createChart()
    configureDataSet(chartId, 'sensors', ['temperature', 'humidity', 'voltage'])

    configureChannels(chartId, [
      { id: 'temp-line', dataSetId: 'sensors', column: 'temperature', stackIndex: 0 },
      { id: 'humid-line', dataSetId: 'sensors', column: 'humidity', stackIndex: 1 },
      { id: 'volt-line', dataSetId: 'sensors', column: 'voltage', stackIndex: 2 },
    ])
  })

  it('returns error for channel referencing nonexistent dataset', () => {
    const chartId = createChart()

    const buf = bijEncode({
      meta: {
        id: '2',
        category: 'config',
        action: 'channels',
        chartId,
        params: {
          channels: [{ id: 'ch1', dataSetId: 'nonexistent', column: 'temp' }],
        },
      },
    })
    const res = handleMessage(buf)
    expect(res.type).toBe('error')
    expect(res.error).toContain('DataSet not found')
  })

  it('returns error for channel referencing nonexistent column', () => {
    const chartId = createChart()
    configureDataSet(chartId, 'sensors', ['temperature'])

    const buf = bijEncode({
      meta: {
        id: '2',
        category: 'config',
        action: 'channels',
        chartId,
        params: {
          channels: [{ id: 'ch1', dataSetId: 'sensors', column: 'nonexistent' }],
        },
      },
    })
    const res = handleMessage(buf)
    expect(res.type).toBe('error')
    expect(res.error).toContain('Column')
  })

  it('handles config/title', () => {
    const chartId = createChart()

    const titleBuf = bijEncode({
      meta: { id: '2', category: 'config', action: 'title', chartId, params: { title: 'My Chart' } },
    })
    const titleRes = handleMessage(titleBuf)
    expect(titleRes.type).toBe('response')
  })

  it('handles data/set with shared timestamps and multiple columns', () => {
    const chartId = createChart()
    configureDataSet(chartId, 'sensors', ['temperature', 'humidity'])
    configureChannels(chartId, [
      { id: 'temp-line', dataSetId: 'sensors', column: 'temperature' },
      { id: 'humid-line', dataSetId: 'sensors', column: 'humidity' },
    ])

    const x = new Float64Array([1, 2, 3, 4, 5])
    const temperature = new Float64Array([20, 21, 22, 23, 24])
    const humidity = new Float64Array([40, 42, 45, 47, 50])

    const dataBuf = bijEncode([
      { key: 'meta', value: { id: '5', category: 'data', action: 'set', chartId, dataSetId: 'sensors' } },
      { key: 'x', value: x },
      { key: 'temperature', value: temperature },
      { key: 'humidity', value: humidity },
    ])
    const dataRes = handleMessage(dataBuf)
    expect(dataRes.type).toBe('response')
  })

  it('handles data/append with shared timestamps', () => {
    const chartId = createChart()
    configureDataSet(chartId, 'sensors', ['temperature', 'humidity'])
    configureChannels(chartId, [
      { id: 'temp-line', dataSetId: 'sensors', column: 'temperature' },
    ])

    const dataBuf = bijEncode([
      { key: 'meta', value: { id: '5', category: 'data', action: 'append', chartId, dataSetId: 'sensors' } },
      { key: 'x', value: new Float64Array([1, 2]) },
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
      { key: 'x', value: new Float64Array([1]) },
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
            { id: 'sensors', columns: [{ id: 'temperature' }, { id: 'humidity' }] },
            { id: 'gps', columns: [{ id: 'lat' }, { id: 'lon' }] },
          ],
        },
      },
    })
    const res = handleMessage(buf)
    expect(res.type).toBe('response')

    // Channels from different datasets
    configureChannels(chartId, [
      { id: 'temp-line', dataSetId: 'sensors', column: 'temperature' },
      { id: 'lat-line', dataSetId: 'gps', column: 'lat' },
    ])

    // Push to each dataset independently
    const sensorBuf = bijEncode([
      { key: 'meta', value: { id: '10', category: 'data', action: 'set', chartId, dataSetId: 'sensors' } },
      { key: 'x', value: new Float64Array([1, 2, 3]) },
      { key: 'temperature', value: new Float64Array([20, 21, 22]) },
      { key: 'humidity', value: new Float64Array([40, 42, 45]) },
    ])
    expect(handleMessage(sensorBuf).type).toBe('response')

    const gpsBuf = bijEncode([
      { key: 'meta', value: { id: '11', category: 'data', action: 'set', chartId, dataSetId: 'gps' } },
      { key: 'x', value: new Float64Array([100, 200]) },
      { key: 'lat', value: new Float64Array([60.1, 60.2]) },
      { key: 'lon', value: new Float64Array([24.9, 25.0]) },
    ])
    expect(handleMessage(gpsBuf).type).toBe('response')
  })

  it('handles config/axisInterval', () => {
    const chartId = createChart()

    const buf = bijEncode({
      meta: { id: '2', category: 'config', action: 'axisInterval', chartId, params: { axis: 'x', start: 0, end: 10000 } },
    })
    expect(handleMessage(buf).type).toBe('response')
  })

  it('handles config/defaultAxisInterval with length', () => {
    const chartId = createChart()

    const buf = bijEncode({
      meta: { id: '2', category: 'config', action: 'defaultAxisInterval', chartId, params: { axis: 'x', length: 5000 } },
    })
    expect(handleMessage(buf).type).toBe('response')
  })

  it('handles config/tickStrategy', () => {
    const chartId = createChart()

    const buf = bijEncode({
      meta: { id: '2', category: 'config', action: 'tickStrategy', chartId, params: { axis: 'x', strategy: 'dateTime' } },
    })
    expect(handleMessage(buf).type).toBe('response')
  })

  it('handles lifecycle/init with theme', () => {
    const buf = bijEncode({
      meta: { id: '0', category: 'lifecycle', action: 'init', params: { license: 'test-key', theme: 'light' } },
    })
    // init is idempotent (already initialized in beforeEach), so this succeeds silently
    expect(handleMessage(buf).type).toBe('response')
  })
})

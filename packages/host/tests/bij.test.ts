import { describe, it, expect } from 'vitest'
import { bijEncode, bijDecode } from '../src/bij/index.js'

describe('BIJ round-trip', () => {
  it('encodes and decodes pure JSON parts', () => {
    const input = {
      meta: { category: 'lifecycle', action: 'create', id: '1' },
      params: { type: 'xy', title: 'Test Chart' },
    }
    const buffer = bijEncode(input)
    const output = bijDecode(buffer)

    expect(output['meta']).toEqual(input.meta)
    expect(output['params']).toEqual(input.params)
  })

  it('encodes and decodes Float64Array data', () => {
    const x = new Float64Array([1.0, 2.0, 3.0, 4.0, 5.0])
    const y = new Float64Array([10.0, 20.0, 30.0, 40.0, 50.0])
    const buffer = bijEncode([
      { key: 'meta', value: { category: 'data', action: 'set', channelId: 'ch1' } },
      { key: 'x', value: x },
      { key: 'y', value: y },
    ])
    const output = bijDecode(buffer)

    expect(output['meta']).toEqual({ category: 'data', action: 'set', channelId: 'ch1' })
    expect(output['x']).toBeInstanceOf(Float64Array)
    expect(output['y']).toBeInstanceOf(Float64Array)
    expect(Array.from(output['x'] as Float64Array)).toEqual([1, 2, 3, 4, 5])
    expect(Array.from(output['y'] as Float64Array)).toEqual([10, 20, 30, 40, 50])
  })

  it('encodes and decodes Float32Array data', () => {
    const values = new Float32Array([1.5, 2.5, 3.5])
    const buffer = bijEncode([
      { key: 'meta', value: { id: '5' } },
      { key: 'values', value: values },
    ])
    const output = bijDecode(buffer)

    expect(output['values']).toBeInstanceOf(Float32Array)
    const decoded = output['values'] as Float32Array
    expect(decoded.length).toBe(3)
    expect(decoded[0]).toBeCloseTo(1.5)
    expect(decoded[1]).toBeCloseTo(2.5)
    expect(decoded[2]).toBeCloseTo(3.5)
  })

  it('handles mixed JSON + float32 + float64', () => {
    const f32 = new Float32Array([1.0, 2.0])
    const f64 = new Float64Array([100.0, 200.0, 300.0])
    const buffer = bijEncode([
      { key: 'config', value: { title: 'Mixed' } },
      { key: 'f32data', value: f32 },
      { key: 'f64data', value: f64 },
      { key: 'extra', value: [1, 2, 3] },
    ])
    const output = bijDecode(buffer)

    expect(output['config']).toEqual({ title: 'Mixed' })
    expect(output['f32data']).toBeInstanceOf(Float32Array)
    expect(output['f64data']).toBeInstanceOf(Float64Array)
    expect(Array.from(output['f32data'] as Float32Array)).toEqual([1, 2])
    expect(Array.from(output['f64data'] as Float64Array)).toEqual([100, 200, 300])
    expect(output['extra']).toEqual([1, 2, 3])
  })

  it('handles empty parts list', () => {
    const buffer = bijEncode([])
    const output = bijDecode(buffer)
    expect(Object.keys(output)).toHaveLength(0)
  })

  it('handles single JSON-only message', () => {
    const buffer = bijEncode({ message: { category: 'lifecycle', action: 'dispose', id: '99' } })
    const output = bijDecode(buffer)
    expect(output['message']).toEqual({ category: 'lifecycle', action: 'dispose', id: '99' })
  })

  it('handles large Float64Array (1M elements)', () => {
    const big = new Float64Array(1_000_000)
    for (let i = 0; i < big.length; i++) big[i] = i * 0.1
    const buffer = bijEncode([
      { key: 'meta', value: { id: '1' } },
      { key: 'data', value: big },
    ])
    const output = bijDecode(buffer)
    const decoded = output['data'] as Float64Array
    expect(decoded.length).toBe(1_000_000)
    expect(decoded[0]).toBeCloseTo(0)
    expect(decoded[999_999]).toBeCloseTo(99999.9)
  })

  it('handles Unicode strings in JSON', () => {
    const buffer = bijEncode({ text: { title: 'Temperatur \u00b0C \u2014 M\u00e4\u00dfig' } })
    const output = bijDecode(buffer)
    expect(output['text']).toEqual({ title: 'Temperatur \u00b0C \u2014 M\u00e4\u00dfig' })
  })

  it('preserves object input format (Record)', () => {
    const buffer = bijEncode({
      a: 'hello',
      b: 42,
      c: [true, false],
    })
    const output = bijDecode(buffer)
    expect(output['a']).toBe('hello')
    expect(output['b']).toBe(42)
    expect(output['c']).toEqual([true, false])
  })
})

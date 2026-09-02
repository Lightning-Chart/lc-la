/**
 * Binary Interleaved JSON decoder.
 *
 * Unpacks an ArrayBuffer produced by bijEncode back into key-value pairs.
 * JSON parts are parsed, typed array parts are returned as views over the original buffer (zero-copy).
 */

interface PartMeta {
  key: string
  start: number
  length: number
  type: 'json' | 'float32' | 'float64'
}

export function bijDecode(buffer: ArrayBuffer): Record<string, unknown> {
  const metadataByteLength = new Uint16Array(buffer, 0, 1)[0]!
  const metadataBytes = new Uint8Array(buffer, 8, metadataByteLength)
  const decoder = new TextDecoder()
  const metadata: PartMeta[] = JSON.parse(decoder.decode(metadataBytes))

  const dataStart = 8 + Math.ceil(metadataByteLength / 8) * 8
  const result: Record<string, unknown> = {}

  for (const part of metadata) {
    const firstByte = dataStart + part.start

    if (part.type === 'json') {
      const jsonBytes = new Uint8Array(buffer, firstByte, part.length)
      result[part.key] = JSON.parse(decoder.decode(jsonBytes))
    } else if (part.type === 'float32') {
      result[part.key] = new Float32Array(buffer, firstByte, part.length / Float32Array.BYTES_PER_ELEMENT)
    } else if (part.type === 'float64') {
      result[part.key] = new Float64Array(buffer, firstByte, part.length / Float64Array.BYTES_PER_ELEMENT)
    }
  }

  return result
}

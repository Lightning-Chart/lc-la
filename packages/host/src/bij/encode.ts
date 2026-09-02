/**
 * Binary Interleaved JSON encoder.
 *
 * Packs a list of key-value pairs into a single ArrayBuffer.
 * Values can be JSON-serializable objects, Float32Arrays, or Float64Arrays.
 * Binary arrays are stored as raw bytes (zero-copy on decode), JSON values as UTF-8 strings.
 *
 * Format:
 *  [0..8)     Uint16 at offset 0: metadata byte length. Rest of 8 bytes unused (alignment pad).
 *  [8..8+M)   UTF-8 metadata JSON: array of { key, start, length, type }.
 *             Padded to 8-byte boundary.
 *  [data...]  Each part's bytes, 8-byte aligned.
 */

export interface BijPart {
  key: string
  value: unknown | Float32Array | Float64Array
}

interface PartMeta {
  key: string
  start: number
  length: number
  type: 'json' | 'float32' | 'float64'
}

const align8 = (n: number) => Math.ceil(n / 8) * 8

export function bijEncode(parts: BijPart[] | Record<string, unknown>): ArrayBuffer {
  // Normalize object input to array form
  const list: BijPart[] = Array.isArray(parts)
    ? parts
    : Object.entries(parts).map(([key, value]) => ({ key, value }))

  const encoder = new TextEncoder()

  // Compute byte length for each part's value
  const partBytes: Uint8Array[] = []
  const partByteLengths: number[] = []
  const partTypes: PartMeta['type'][] = []

  for (const part of list) {
    if (part.value instanceof Float32Array) {
      partByteLengths.push(part.value.byteLength)
      partTypes.push('float32')
      partBytes.push(new Uint8Array(part.value.buffer, part.value.byteOffset, part.value.byteLength))
    } else if (part.value instanceof Float64Array) {
      partByteLengths.push(part.value.byteLength)
      partTypes.push('float64')
      partBytes.push(new Uint8Array(part.value.buffer, part.value.byteOffset, part.value.byteLength))
    } else {
      const encoded = encoder.encode(JSON.stringify(part.value))
      partByteLengths.push(encoded.length)
      partTypes.push('json')
      partBytes.push(encoded)
    }
  }

  // Build metadata: start offsets are relative to the data region start (after metadata)
  let offset = 0
  const metadata: PartMeta[] = list.map((part, i) => {
    const meta: PartMeta = {
      key: part.key,
      start: offset,
      length: partByteLengths[i]!,
      type: partTypes[i]!,
    }
    offset += align8(partByteLengths[i]!)
    return meta
  })

  const metadataBytes = encoder.encode(JSON.stringify(metadata))
  const metadataPrefixByteLength = 8
  const metadataByteLength = metadataBytes.length

  // Total message size
  const totalByteLength =
    metadataPrefixByteLength +
    align8(metadataByteLength) +
    partByteLengths.reduce((sum, len) => sum + align8(len), 0)

  // Assemble buffer
  const buffer = new ArrayBuffer(totalByteLength)

  // Write metadata length prefix (Uint16 at offset 0)
  new Uint16Array(buffer, 0, 1)[0] = metadataByteLength

  // Write metadata bytes
  new Uint8Array(buffer, metadataPrefixByteLength, metadataByteLength).set(metadataBytes)

  // Write each part's data
  let dataStart = metadataPrefixByteLength + align8(metadataByteLength)
  for (let i = 0; i < partBytes.length; i++) {
    new Uint8Array(buffer, dataStart, partByteLengths[i]!).set(partBytes[i]!)
    dataStart += align8(partByteLengths[i]!)
  }

  return buffer
}

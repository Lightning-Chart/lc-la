/**
 * Blazor Server interop layer.
 * Uses .NET 8 optimized byte array interop — byte[] arrives as Uint8Array, no base64.
 */

declare global {
  interface Window {
    __lcla_blazor: {
      processMessage: (data: Uint8Array) => Uint8Array
      processMessageFireAndForget: (data: Uint8Array) => void
    }
  }
}

export function initBlazorInterop(processMessage: (buffer: ArrayBuffer) => ArrayBuffer) {
  window.__lcla_blazor = {
    processMessage(data: Uint8Array): Uint8Array {
      // Slice to own ArrayBuffer: data may be a view into a larger Blazor-internal buffer
      // with a non-zero byteOffset. Using data.buffer directly would include the prefix bytes.
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      const responseBuffer = processMessage(buffer as ArrayBuffer)
      return new Uint8Array(responseBuffer)
    },
    processMessageFireAndForget(data: Uint8Array): void {
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      processMessage(buffer as ArrayBuffer)
    },
  }
}

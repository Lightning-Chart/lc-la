/**
 * LCLA Host entry point.
 * Loaded in browser alongside LightningChart JS.
 * Initializes LCJS, exposes message handling to the transport layer.
 */

import { hostState } from './handlers/state.js'
import { handleMessage } from './handlers/router.js'
import { bijEncode } from './bij/index.js'
import { initBlazorInterop } from './blazor-interop.js'
import type { ResponseEnvelope } from './types.js'

/**
 * Process an incoming BIJ-encoded message buffer.
 * Returns a BIJ-encoded response buffer.
 */
function processMessage(buffer: ArrayBuffer): ArrayBuffer {
  const response = handleMessage(buffer)
  return bijEncode({ meta: response })
}

// Expose to global scope for transport layers to call
declare global {
  interface Window {
    __lcla: {
      processMessage: (buffer: ArrayBuffer) => ArrayBuffer
    }
    // __lcla_blazor is declared in blazor-interop.ts
  }
}

window.__lcla = {
  processMessage,
}

// Initialize Blazor interop layer
initBlazorInterop(processMessage)

export { processMessage }
export { bijEncode, bijDecode } from './bij/index.js'
export type { ResponseEnvelope, MessageEnvelope } from './types.js'

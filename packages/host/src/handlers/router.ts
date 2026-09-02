/**
 * Message router: decodes incoming BIJ messages and dispatches to the correct handler.
 */

import { bijDecode } from '../bij/index.js'
import type { MessageEnvelope, ResponseEnvelope } from '../types.js'
import { handleLifecycle } from './lifecycle.js'
import { handleConfig } from './config.js'
import { handleData } from './data.js'

export function handleMessage(buffer: ArrayBuffer): ResponseEnvelope {
  const decoded = bijDecode(buffer)
  const envelope = decoded['meta'] as MessageEnvelope | undefined

  if (!envelope) {
    return { id: '0', type: 'error', error: 'Missing "meta" key in BIJ message' }
  }

  // All non-meta parts are passed as binary/json parts to handlers
  const parts: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(decoded)) {
    if (key !== 'meta') {
      parts[key] = value
    }
  }

  switch (envelope.category) {
    case 'lifecycle':
      return handleLifecycle(envelope)
    case 'config':
      return handleConfig(envelope)
    case 'data':
      return handleData(envelope, parts)
    default:
      return { id: envelope.id, type: 'error', error: `Unknown category: ${envelope.category}` }
  }
}

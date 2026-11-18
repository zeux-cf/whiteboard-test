import handler from '@tanstack/react-start/server-entry'
import { handleApi } from './server/api'
import type { WorkerEnv } from './server/env'

export { BoardRoom } from './server/board-room'

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url, ctx)
    return handler.fetch(request)
  },
} satisfies ExportedHandler<WorkerEnv>

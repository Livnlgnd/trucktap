import { api, preflight } from '../_lib/http.js'
import { importWorkspace } from '../_lib/routes.js'

export const runtime = 'nodejs'
export const POST = api(importWorkspace)
export const OPTIONS = preflight

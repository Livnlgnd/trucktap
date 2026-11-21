import { api, preflight } from '../_lib/http.js'
import { pushSync } from '../_lib/routes.js'

export const runtime = 'nodejs'
export const POST = api(pushSync)
export const OPTIONS = preflight

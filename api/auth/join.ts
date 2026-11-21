import { api, preflight } from '../_lib/http.js'
import { join } from '../_lib/routes.js'

export const runtime = 'nodejs'
export const POST = api(join)
export const OPTIONS = preflight

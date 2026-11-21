import { api, preflight } from '../_lib/http.js'
import { snapshot } from '../_lib/routes.js'

export const runtime = 'nodejs'
export const GET = api(snapshot)
export const OPTIONS = preflight

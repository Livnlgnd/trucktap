import { api, preflight } from './_lib/http.js'
import { healthResponse } from './_lib/routes.js'

export const runtime = 'nodejs'
export const GET = api(healthResponse)
export const OPTIONS = preflight

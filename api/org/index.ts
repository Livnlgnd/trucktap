import { api, preflight } from '../_lib/http.js'
import { getOrg } from '../_lib/routes.js'

export const runtime = 'nodejs'
export const GET = api(getOrg)
export const OPTIONS = preflight

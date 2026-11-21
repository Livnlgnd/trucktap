import { api, preflight } from '../_lib/http.js'
import { register } from '../_lib/routes.js'

export const runtime = 'nodejs'
export const POST = api(register)
export const OPTIONS = preflight

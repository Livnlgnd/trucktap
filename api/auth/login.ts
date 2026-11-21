import { api, preflight } from '../_lib/http.js'
import { login } from '../_lib/routes.js'

export const runtime = 'nodejs'
export const POST = api(login)
export const OPTIONS = preflight

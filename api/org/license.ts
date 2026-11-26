import { api, preflight } from '../_lib/http.js'
import { updateOrgLicense } from '../_lib/routes.js'

export const runtime = 'nodejs'
export const PATCH = api(updateOrgLicense)
export const OPTIONS = preflight
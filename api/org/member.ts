import { api, preflight } from '../_lib/http.js'
import { removeMember, updateMemberRole } from '../_lib/routes.js'

export const runtime = 'nodejs'
export const PATCH = api(updateMemberRole)
export const DELETE = api(removeMember)
export const OPTIONS = preflight

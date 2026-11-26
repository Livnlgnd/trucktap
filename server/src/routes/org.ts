import { Router, type Request } from 'express'
import { db, bumpRevision } from '../db.js'
import { getAuth, requireAuth, requireOwner } from '../middleware/auth.js'
import { memberRoleSchema } from '../lib/validation.js'
import {
  getOrganization,
  listMembers,
} from '../lib/workspace.js'

export const orgRouter = Router()

orgRouter.use(requireAuth)

orgRouter.get('/', (_request, response) => {
  const auth = getAuth(response)
  const organization = getOrganization(auth.orgId)
  if (!organization) {
    response.status(404).json({ error: 'Workspace not found.' })
    return
  }

  response.json({
    organization: {
      id: organization.id,
      name: organization.name,
      joinCode: organization.join_code,
      plan: organization.plan,
      revision: organization.revision,
      role: auth.role,
      licenseKey: organization.license_key ?? undefined,
    },
    members: listMembers(auth.orgId),
  })
})

orgRouter.patch('/license', requireOwner, (request, response) => {
  const auth = getAuth(response)
  const licenseKey =
    typeof request.body?.licenseKey === 'string'
      ? request.body.licenseKey.trim()
      : ''
  if (!licenseKey || licenseKey.length > 5000) {
    response.status(400).json({ error: 'Enter a valid license key.' })
    return
  }
  db.prepare('UPDATE organizations SET license_key = ? WHERE id = ?').run(
    licenseKey,
    auth.orgId,
  )
  const organization = getOrganization(auth.orgId)
  if (!organization) {
    response.status(404).json({ error: 'Workspace not found.' })
    return
  }
  response.json({
    organization: {
      id: organization.id,
      name: organization.name,
      joinCode: organization.join_code,
      plan: organization.plan,
      revision: organization.revision,
      role: auth.role,
      licenseKey: organization.license_key ?? undefined,
    },
  })
})

function memberIdFromRequest(request: Request): string {
  const value = request.params.userId ?? request.query.userId
  if (typeof value !== 'string' || value.length === 0 || value.length > 120) {
    throw new Error('Member ID is required.')
  }
  return value
}

orgRouter.patch(
  ['/member', '/members/:userId'],
  requireOwner,
  (request, response) => {
    const auth = getAuth(response)
    const parsed = memberRoleSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: 'Choose a valid member role.' })
      return
    }

    let targetUserId: string
    try {
      targetUserId = memberIdFromRequest(request)
    } catch (error) {
      response.status(400).json({ error: (error as Error).message })
      return
    }

    if (targetUserId === auth.userId) {
      response.status(400).json({ error: 'Change your own role from another owner account.' })
      return
    }

    const membership = db
      .prepare('SELECT role FROM memberships WHERE org_id = ? AND user_id = ?')
      .get(auth.orgId, targetUserId) as { role: string } | undefined

    if (!membership) {
      response.status(404).json({ error: 'Member not found.' })
      return
    }

    if (membership.role === 'owner') {
      response.status(400).json({ error: 'The workspace owner role cannot be changed.' })
      return
    }

    db.prepare(
      'UPDATE memberships SET role = ? WHERE org_id = ? AND user_id = ?',
    ).run(parsed.data.role, auth.orgId, targetUserId)
    bumpRevision(auth.orgId)

    response.json({ members: listMembers(auth.orgId) })
  },
)

orgRouter.delete(
  ['/member', '/members/:userId'],
  (request, response) => {
    const auth = getAuth(response)
    if (auth.role !== 'owner') {
      response.status(403).json({ error: 'Only the workspace owner can remove members.' })
      return
    }

    let targetUserId: string
    try {
      targetUserId = memberIdFromRequest(request)
    } catch (error) {
      response.status(400).json({ error: (error as Error).message })
      return
    }

    if (targetUserId === auth.userId) {
      response.status(400).json({ error: 'You cannot remove yourself from the workspace.' })
      return
    }

    const membership = db
      .prepare('SELECT role FROM memberships WHERE org_id = ? AND user_id = ?')
      .get(auth.orgId, targetUserId) as { role: string } | undefined

    if (!membership) {
      response.status(404).json({ error: 'Member not found.' })
      return
    }

    if (membership.role === 'owner') {
      response.status(400).json({ error: 'The workspace owner cannot be removed.' })
      return
    }

    db.prepare('DELETE FROM memberships WHERE org_id = ? AND user_id = ?').run(
      auth.orgId,
      targetUserId,
    )
    bumpRevision(auth.orgId)

    response.json({ members: listMembers(auth.orgId) })
  },
)

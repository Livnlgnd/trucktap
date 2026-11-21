import { Router } from 'express'
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
    },
    members: listMembers(auth.orgId),
  })
})

orgRouter.patch(
  '/members/:userId',
  requireOwner,
  (request, response) => {
    const auth = getAuth(response)
    const parsed = memberRoleSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: 'Choose a valid member role.' })
      return
    }

    if (request.params.userId === auth.userId) {
      response.status(400).json({ error: 'Change your own role from another owner account.' })
      return
    }

    const targetUserId = String(request.params.userId)
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

orgRouter.delete('/members/:userId', (request, response) => {
  const auth = getAuth(response)
  if (auth.role !== 'owner') {
    response.status(403).json({ error: 'Only the workspace owner can remove members.' })
    return
  }

  if (request.params.userId === auth.userId) {
    response.status(400).json({ error: 'You cannot remove yourself from the workspace.' })
    return
  }

  const targetUserId = String(request.params.userId)
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
})

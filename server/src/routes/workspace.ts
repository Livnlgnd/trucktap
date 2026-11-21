import { Router } from 'express'
import { transaction } from '../db.js'
import { getAuth, requireAuth, requireOwner } from '../middleware/auth.js'
import { workspaceImportSchema } from '../lib/validation.js'
import {
  importWorkspaceRows,
  WorkspaceImportError,
} from '../lib/workspaceImport.js'
import { getSnapshot } from '../lib/workspace.js'

export const workspaceRouter = Router()

workspaceRouter.post(
  '/import',
  requireAuth,
  requireOwner,
  (request, response) => {
    const auth = getAuth(response)
    const parsed = workspaceImportSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({
        error: 'The local workspace data is not valid.',
        issues: parsed.error.issues,
      })
      return
    }

    try {
      transaction(() => {
        importWorkspaceRows(auth.orgId, parsed.data)
      })
    } catch (error) {
      if (error instanceof WorkspaceImportError) {
        response.status(error.status).json({ error: error.message })
        return
      }
      throw error
    }

    response.status(201).json({ snapshot: getSnapshot(auth) })
  },
)

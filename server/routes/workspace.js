import { Router } from 'express';
import { generateTimetableDetailed } from '../../shared/scheduler.js';
import { buildSeatPlan } from '../utils/seatAllotment.js';
import {
  createWorkspace,
  deleteWorkspace,
  getSharedWorkspace,
  listWorkspaces,
  loadWorkspace,
  saveGeneratedTimetable,
  saveWorkspace,
  setWorkspaceShareState,
  updateWorkspaceMeta,
} from '../storage/workspaceStore.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sanitizeWorkspaceMeta, validateWorkspacePayload } from '../utils/validation.js';

const router = Router();

router.get('/shared', (req, res) => {
  res.status(400).json({ message: 'Share token is required.' });
});

router.get('/shared/:token', async (req, res) => {
  try {
    const workspace = await getSharedWorkspace(req.params.token);
    res.json({
      workspace: {
        id: workspace.id || workspace._id?.toString(),
        title: workspace.title,
        semester: workspace.semester,
        payload: workspace.payload,
      },
    });
  } catch (error) {
    res.status(404).json({ message: error?.message || 'Shared workspace not found.' });
  }
});


router.use(requireAuth);

router.get('/list', async (req, res) => {
  try {
    const workspaces = await listWorkspaces(req.user);
    res.json({ workspaces });
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to load workspaces.' });
  }
});

router.post('/list', requireRole('admin', 'faculty'), async (req, res) => {
  try {
    const meta = sanitizeWorkspaceMeta(req.body || {});
    const workspace = await createWorkspace(req.user, meta);
    res.status(201).json({ workspace });
  } catch (error) {
    res.status(400).json({ message: error?.message || 'Failed to create workspace.' });
  }
});

router.get('/:workspaceId', async (req, res) => {
  try {
    const workspace = await loadWorkspace(req.user, req.params.workspaceId);
    res.json({ workspace });
  } catch (error) {
    const status = /access denied/i.test(error?.message || '') ? 403 : 404;
    res.status(status).json({ message: error?.message || 'Failed to load workspace.' });
  }
});

router.put('/:workspaceId', requireRole('admin', 'faculty'), async (req, res) => {
  const incomingPayload = req.body?.payload ?? req.body;
  const clientRevision = req.body?.clientRevision || null;
  const validation = validateWorkspacePayload(incomingPayload);
  if (!validation.ok) {
    res.status(400).json({ message: validation.message, code: 'WORKSPACE_VALIDATION_FAILED' });
    return;
  }

  try {
    const workspace = await saveWorkspace(req.user, req.params.workspaceId, incomingPayload, 'workspace-save', clientRevision);
    res.json({ workspace });
  } catch (error) {
    const status = error?.statusCode || (/access denied/i.test(error?.message || '') ? 403 : 404);
    res.status(status).json({ message: error?.message || 'Failed to save workspace.' });
  }
});

router.patch('/:workspaceId/meta', requireRole('admin', 'faculty'), async (req, res) => {
  try {
    const meta = sanitizeWorkspaceMeta(req.body || {});
    const workspace = await updateWorkspaceMeta(req.user, req.params.workspaceId, meta);
    res.json({ workspace });
  } catch (error) {
    const status = /access denied/i.test(error?.message || '') ? 403 : 400;
    res.status(status).json({ message: error?.message || 'Failed to update workspace metadata.' });
  }
});

router.delete('/:workspaceId', requireRole('admin', 'faculty'), async (req, res) => {
  try {
    await deleteWorkspace(req.user, req.params.workspaceId);
    res.status(204).end();
  } catch (error) {
    const status = /access denied/i.test(error?.message || '') ? 403 : 404;
    res.status(status).json({ message: error?.message || 'Failed to delete workspace.' });
  }
});

router.post('/:workspaceId/share', requireRole('admin', 'faculty'), async (req, res) => {
  const enableShare = Boolean(req.body?.enabled);
  try {
    const workspace = await setWorkspaceShareState(req.user, req.params.workspaceId, enableShare);
    res.json({ workspace });
  } catch (error) {
    const status = /access denied/i.test(error?.message || '') ? 403 : 400;
    res.status(status).json({ message: error?.message || 'Failed to update share settings.' });
  }
});

router.post('/:workspaceId/generate', requireRole('admin', 'faculty'), async (req, res) => {
  const incomingPayload = req.body?.payload ?? req.body;
  const clientRevision = req.body?.clientRevision || null;
  const payload = incomingPayload && typeof incomingPayload === 'object' ? incomingPayload : {};

  const validation = validateWorkspacePayload(payload);
  if (!validation.ok) {
    res.status(400).json({ message: validation.message, code: 'WORKSPACE_VALIDATION_FAILED' });
    return;
  }

  try {
    const generation = generateTimetableDetailed(
      Array.isArray(payload.exams) ? payload.exams : [],
      Array.isArray(payload.rooms) ? payload.rooms : [],
      Array.isArray(payload.slots) ? payload.slots : [],
      {
        ...(payload.constraintConfig && typeof payload.constraintConfig === 'object' ? payload.constraintConfig : {}),
        holidays: Array.isArray(payload.holidays) ? payload.holidays : [],
        lockedAssignments: Array.isArray(payload.lockedAssignments) ? payload.lockedAssignments : [],
      }
    );

    if (!generation.timetable) {
      res.status(422).json({
        message: 'No feasible schedule found with current constraints.',
        trace: generation.trace,
      });
      return;
    }

    const seatPlan = buildSeatPlan(generation.timetable);
    const workspace = await saveGeneratedTimetable(req.user, req.params.workspaceId, {
      ...payload,
      seatPlan,
    }, generation.timetable, clientRevision);

    res.json({
      workspace,
      timetable: generation.timetable,
      seatPlan,
      trace: generation.trace,
    });
  } catch (error) {
    console.error(`[Generation Error] Workspace: ${req.params.workspaceId}`, error);
    const status = error?.statusCode || (/access denied/i.test(error?.message || '') ? 403 : 500);
    res.status(status).json({
      message: error?.message || 'Failed to generate timetable.',
      details: error?.stack,
    });
  }
});

router.get('/:workspaceId/reports', async (req, res) => {
  try {
    const workspace = await loadWorkspace(req.user, req.params.workspaceId);
    const payload = workspace.payload || {};
    const seatPlan = payload.seatPlan || buildSeatPlan(payload.timetable || []);

    res.json({
      seatPlan,
      roomWise: seatPlan.roomWise,
      studentWise: seatPlan.studentWise,
    });
  } catch (error) {
    const status = /access denied/i.test(error?.message || '') ? 403 : 404;
    res.status(status).json({ message: error?.message || 'Failed to build reports.' });
  }
});

export default router;

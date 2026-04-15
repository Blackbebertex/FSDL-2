import { Router } from 'express';
import { generateTimetable } from '../../shared/scheduler.js';
import { generateSlots } from '../data/defaultWorkspace.js';
import { normalizeWorkspacePayload } from '../data/defaultWorkspace.js';
import { loadWorkspace, saveGeneratedTimetable, saveWorkspace } from '../storage/workspaceStore.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const workspace = await loadWorkspace();
    res.json({ success: true, workspace });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to load workspace.', error: error.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const workspace = await saveWorkspace(req.body?.payload || req.body || {});

    res.json({ success: true, workspace });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to save workspace.', error: error.message });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const payload = normalizeWorkspacePayload(req.body?.payload || req.body || {});
    const slots = Array.isArray(payload.slots) && payload.slots.length
      ? payload.slots
      : generateSlots(payload.startDateStr);

    const timetable = generateTimetable(payload.exams, payload.rooms, slots, {
      ...payload.constraintConfig,
      holidays: payload.holidays,
    });

    if (!timetable) {
      return res.status(422).json({
        success: false,
        message: 'Could not generate a conflict-free timetable with the current data.',
      });
    }

    const workspace = await saveGeneratedTimetable({ ...payload, slots }, timetable);

    res.json({ success: true, timetable, workspace });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to generate timetable.', error: error.message });
  }
});

export default router;
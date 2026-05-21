import { Router }           from 'express';
import { generateTimetable }  from '../../shared/scheduler.js';

const router = Router();

router.post('/', async (req, res) => {
  const { exams, rooms, slots, constraints } = req.body;
  const result = generateTimetable(exams, rooms, slots, constraints);
  if (!result) {
    return res.status(422).json({
      error: 'No feasible schedule found with current constraints.'
    });
  }
  res.json({ timetable: result });
});

export default router;

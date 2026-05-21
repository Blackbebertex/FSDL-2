import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTimetableDetailed } from '../shared/scheduler.js';

const exams = [
  { id: 'E1', name: 'Operating Systems', students: ['A', 'B', 'C'], marks: 60, durationMinutes: 120 },
  { id: 'E2', name: 'Algorithms', students: ['D', 'E'], marks: 30, durationMinutes: 60 },
];

const rooms = [
  { id: 'R1', name: '6201', capacity: 2 },
  { id: 'R2', name: '6202', capacity: 4 },
];

const slots = [
  { id: 'S1', date: '2026-05-04T00:00:00.000Z', name: 'May 4 - 10:00 AM - 12:00 PM', time: '10:00 AM', endTime: '12:00 PM' },
  { id: 'S2', date: '2026-05-05T00:00:00.000Z', name: 'May 5 - 10:00 AM - 12:00 PM', time: '10:00 AM', endTime: '12:00 PM' },
];

test('generateTimetableDetailed respects locked assignment', () => {
  const result = generateTimetableDetailed(exams, rooms, slots, {
    lockedAssignments: [{ examId: 'E1', slotId: 'S2', roomIds: ['R2'] }],
    minGapDays: 1,
    holidays: [],
  });

  assert.ok(result.timetable);
  const e1 = result.timetable.find((item) => item.exam.id === 'E1');
  assert.equal(e1.slot.id, 'S2');
});

test('generateTimetableDetailed rejects slot shorter than exam duration', () => {
  const shortSlot = [{ id: 'S1', date: '2026-05-04T00:00:00.000Z', name: 'May 4 - 10:00 AM - 11:00 AM', time: '10:00 AM', endTime: '11:00 AM' }];
  const longExam = [{ id: 'E1', name: 'Networks', students: ['A'], marks: 60, durationMinutes: 180 }];
  const result = generateTimetableDetailed(longExam, rooms, shortSlot, {});

  assert.equal(result.timetable, null);
  assert.ok(result.trace.some((item) => item.reason === 'duration-overflow'));
});

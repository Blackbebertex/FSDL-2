import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAssignExam,
  detectConflicts,
  normalizeConstraints,
} from '../shared/conflictDetector.js';

test('normalizeConstraints keeps defaults while preserving overrides', () => {
  const constraints = normalizeConstraints({
    minGapDays: 5,
    holidays: ['2026-05-04'],
  });

  assert.equal(constraints.minGapDays, 5);
  assert.equal(constraints.enforceSingleExamPerDay, true);
  assert.deepEqual(constraints.holidays, ['2026-05-04']);
  assert.deepEqual(constraints.lockedAssignments, []);
});

test('canAssignExam blocks shared students on the same day', () => {
  const assignments = [
    {
      exam: { name: 'Mathematics', students: ['A', 'B'], marks: 30 },
      slot: { date: '2026-05-04T00:00:00.000Z' },
    },
  ];

  const result = canAssignExam(
    { name: 'Physics', students: ['B', 'C'], marks: 30 },
    { date: '2026-05-04T00:00:00.000Z' },
    assignments,
    {
      enforceSingleExamPerDay: false,
      minGapDays: 0,
      preventSameDayStudentConflict: true,
      holidays: [],
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'student-conflict');
});

test('detectConflicts reports 60-mark gap violations independently', () => {
  const assignments = [
    {
      exam: { name: 'Operating Systems', students: ['A'], marks: 60 },
      slot: { date: '2026-05-04T00:00:00.000Z' },
    },
    {
      exam: { name: 'Networks', students: ['B'], marks: 60 },
      slot: { date: '2026-05-05T00:00:00.000Z' },
    },
  ];

  const conflicts = detectConflicts(assignments, {
    enforceSingleExamPerDay: false,
    minGapDays: 0,
    enforceFridaySaturdayRule: false,
    enforceSixtyMarkGap: true,
    sixtyMarkMinGap: 3,
    preventSameDayStudentConflict: false,
  });

  assert.equal(conflicts.length, 1);
  assert.match(conflicts[0], /60-mark gap violation/);
});
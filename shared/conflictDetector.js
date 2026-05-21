import { differenceInCalendarDays } from 'date-fns';

export const DEFAULT_CONSTRAINTS = {
  checkCapacity: true,
  enforceSingleExamPerDay: true,
  minGapDays: 2,
  enforceFridaySaturdayRule: true,
  fridaySaturdayMinGap: 3,
  enforceSixtyMarkGap: true,
  sixtyMarkMinGap: 3,
  preventSameDayStudentConflict: true,
  lockedAssignments: [],
  holidays: [],
};

export const normalizeConstraints = (constraints = {}) => ({
  ...DEFAULT_CONSTRAINTS, ...constraints,
  holidays: Array.isArray(constraints.holidays)
    ? constraints.holidays : DEFAULT_CONSTRAINTS.holidays,
  lockedAssignments: Array.isArray(constraints.lockedAssignments)
    ? constraints.lockedAssignments
    : DEFAULT_CONSTRAINTS.lockedAssignments,
});

export const canAssignExam = (exam, slot, assignments,
                                rawConstraints = {}) => {
  const c = normalizeConstraints(rawConstraints);
  const examStudents = Array.isArray(exam?.students) ? exam.students : [];
  const currDate = new Date(slot.date);
  const currDateStr = currDate.toISOString().split('T')[0];
  
  if (c.holidays.includes(currDateStr))
    return { ok: false, reason: 'holiday' };
  
  if (c.enforceSingleExamPerDay) {
    const clash = assignments.some(a =>
      differenceInCalendarDays(new Date(a.slot.date), currDate) === 0);
    if (clash) return { ok: false, reason: 'single-exam-per-day' };
  }
  for (const a of assignments) {
    const aDate = new Date(a.slot.date);
    const diff  = Math.abs(differenceInCalendarDays(currDate, aDate));
    if (diff < c.minGapDays)
      return { ok: false, reason: 'min-gap-violation' };
    const aDay = aDate.getDay();
    const currDay = currDate.getDay();
    if (c.enforceFridaySaturdayRule &&
        (aDay === 5 || aDay === 6 || currDay === 5 || currDay === 6) && 
        diff < c.fridaySaturdayMinGap)
      return { ok: false, reason: 'friday-saturday-gap' };
    if (c.enforceSixtyMarkGap && exam.marks === 60 &&
        a.exam.marks === 60 && diff < c.sixtyMarkMinGap)
      return { ok: false, reason: 'sixty-mark-gap' };
    if (c.preventSameDayStudentConflict &&
        differenceInCalendarDays(currDate, aDate) === 0) {
      const otherStudents = Array.isArray(a.exam?.students) ? a.exam.students : [];
      const shared = examStudents.some(s => otherStudents.includes(s));
      if (shared) return { ok: false, reason: 'student-conflict' };
    }
  }
  return { ok: true, reason: null };
};

export const detectConflicts = (assignments, constraints) => {
  const conflicts = [];
  const c = normalizeConstraints(constraints);
  for (let i = 0; i < assignments.length; i++) {
    for (let j = i + 1; j < assignments.length; j++) {
      const a = assignments[i];
      const b = assignments[j];
      const dateA = new Date(a.slot.date);
      const dateB = new Date(b.slot.date);
      const diff = Math.abs(differenceInCalendarDays(dateA, dateB));
      
      if (diff === 0 && c.enforceSingleExamPerDay) {
        conflicts.push(`Single exam per day violation: ${a.exam.name} and ${b.exam.name}`);
      }
      if (diff < c.minGapDays) {
        conflicts.push(`Min gap violation: ${a.exam.name} and ${b.exam.name}`);
      }
      if (c.enforceFridaySaturdayRule) {
        const dayA = dateA.getDay();
        const dayB = dateB.getDay();
        if ((dayA === 5 || dayA === 6 || dayB === 5 || dayB === 6) && diff < c.fridaySaturdayMinGap) {
          conflicts.push(`Friday/Saturday gap violation: ${a.exam.name} and ${b.exam.name}`);
        }
      }
      if (c.enforceSixtyMarkGap && a.exam.marks === 60 && b.exam.marks === 60 && diff < c.sixtyMarkMinGap) {
        conflicts.push(`60-mark gap violation: ${a.exam.name} and ${b.exam.name}`);
      }
      if (diff === 0 && c.preventSameDayStudentConflict) {
        const shared = a.exam.students.some(s => b.exam.students.includes(s));
        if (shared) conflicts.push(`Student conflict: ${a.exam.name} and ${b.exam.name}`);
      }
    }
  }
  return conflicts;
};
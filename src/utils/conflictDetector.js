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
  holidays: [],
};

export const normalizeConstraints = (constraints = {}) => {
  return {
    ...DEFAULT_CONSTRAINTS,
    ...constraints,
    holidays: Array.isArray(constraints.holidays) ? constraints.holidays : DEFAULT_CONSTRAINTS.holidays,
  };
};

export const canAssignExam = (exam, slot, assignments, rawConstraints = {}) => {
  const constraints = normalizeConstraints(rawConstraints);
  const currentSlotDate = new Date(slot.date);

  if (constraints.enforceSingleExamPerDay) {
    const hasExamSameDay = assignments.some(
      a => differenceInCalendarDays(new Date(a.slot.date), currentSlotDate) === 0
    );
    if (hasExamSameDay) {
      return { ok: false, reason: 'single-exam-per-day' };
    }
  }

  for (const assignment of assignments) {
    const assignedDate = new Date(assignment.slot.date);
    const dayDiff = Math.abs(differenceInCalendarDays(currentSlotDate, assignedDate));

    if (dayDiff < constraints.minGapDays) {
      return { ok: false, reason: 'min-gap-violation' };
    }

    if (constraints.enforceFridaySaturdayRule && assignedDate < currentSlotDate) {
      const dayName = assignedDate.getDay();
      const isFriday = dayName === 5;
      const isSaturday = dayName === 6;
      if ((isFriday || isSaturday) && dayDiff < constraints.fridaySaturdayMinGap) {
        return { ok: false, reason: 'friday-saturday-gap-violation' };
      }
    }

    if (
      constraints.enforceSixtyMarkGap &&
      exam.marks === 60 &&
      assignment.exam.marks === 60 &&
      dayDiff < constraints.sixtyMarkMinGap
    ) {
      return { ok: false, reason: 'sixty-mark-gap-violation' };
    }

    if (constraints.preventSameDayStudentConflict && dayDiff === 0) {
      const hasCommonStudents = assignment.exam.students.some(student => exam.students.includes(student));
      if (hasCommonStudents) {
        return { ok: false, reason: 'same-day-student-conflict' };
      }
    }
  }

  return { ok: true, reason: null };
};

export const detectConflicts = (timetable = [], rawConstraints = {}) => {
  const constraints = normalizeConstraints(rawConstraints);
  const conflicts = [];

  for (let i = 0; i < timetable.length; i++) {
    const current = timetable[i];
    const currentDate = new Date(current.slot.date);

    if (constraints.checkCapacity) {
      const assignedCapacity = current.totalCapacity ?? current.rooms.reduce((sum, room) => sum + room.capacity, 0);
      if (assignedCapacity < current.exam.students.length) {
        conflicts.push({
          type: 'capacity-shortage',
          examId: current.exam.id,
          date: current.slot.date,
          details: `Capacity ${assignedCapacity} is less than ${current.exam.students.length}`,
        });
      }
    }

    for (let j = i + 1; j < timetable.length; j++) {
      const other = timetable[j];
      const otherDate = new Date(other.slot.date);
      const dayDiff = Math.abs(differenceInCalendarDays(currentDate, otherDate));

      if (dayDiff === 0) {
        const occupiedCurrent = new Set(current.rooms.map(room => room.id));
        const overlappingRoom = other.rooms.find(room => occupiedCurrent.has(room.id));
        if (overlappingRoom) {
          conflicts.push({
            type: 'room-overlap',
            roomId: overlappingRoom.id,
            date: current.slot.date,
            details: `${current.exam.name} and ${other.exam.name}`,
          });
        }

        if (constraints.preventSameDayStudentConflict) {
          const hasCommonStudents = current.exam.students.some(student => other.exam.students.includes(student));
          if (hasCommonStudents) {
            conflicts.push({
              type: 'student-overlap',
              date: current.slot.date,
              details: `${current.exam.name} and ${other.exam.name}`,
            });
          }
        }
      }

      if (dayDiff < constraints.minGapDays) {
        conflicts.push({
          type: 'min-gap-violation',
          date: current.slot.date,
          details: `${current.exam.name} and ${other.exam.name}`,
        });
      }
    }
  }

  return conflicts;
};

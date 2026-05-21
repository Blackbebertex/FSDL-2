import { canAssignExam, detectConflicts,
          normalizeConstraints } from './conflictDetector.js';

const getDurationMinutes = (exam) => {
  const explicit = Number(exam?.durationMinutes);
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }

  return Number(exam?.marks) === 60 ? 180 : 120;
};

const getSlotDurationMinutes = (slot) => {
  const start = parseTimeToMinutes(slot?.time);
  const end = parseTimeToMinutes(slot?.endTime);
  if (start === null || end === null || end <= start) {
    return null;
  }
  return end - start;
};

const slotCanFitExamDuration = (exam, slot) => {
  const slotMinutes = getSlotDurationMinutes(slot);
  if (!slotMinutes) return true;
  return getDurationMinutes(exam) <= slotMinutes;
};

function selectRoomsForExam(exam, date, assignments, rooms) {
  const dateStr = date ? new Date(date).toISOString().split('T')[0] : null;
  if (!dateStr) return null;

  const usedRoomIds = assignments
    .filter(a => a.slot?.date && new Date(a.slot.date).toISOString().split('T')[0] === dateStr)
    .flatMap(a => (a.rooms || []).map(r => r.id));
  const available = rooms
    .filter(r => !usedRoomIds.includes(r.id))
    .sort((a, b) => b.capacity - a.capacity);
  const selected = [];
  let covered = 0;
  for (const room of available) {
    selected.push(room);
    covered += room.capacity;
    if (covered >= exam.students.length) break;
  }
  return covered >= exam.students.length ? selected : null;
}

const parseTimeToMinutes = (timeLabel) => {
  if (typeof timeLabel !== 'string') {
    return null;
  }

  const match = timeLabel.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }

  const hoursRaw = Number.parseInt(match[1], 10);
  const minutesRaw = Number.parseInt(match[2] || '0', 10);
  const meridiem = match[3].toUpperCase();

  if (!Number.isFinite(hoursRaw) || !Number.isFinite(minutesRaw)) {
    return null;
  }

  const hoursNormalized = hoursRaw % 12;
  const hours24 = meridiem === 'PM' ? hoursNormalized + 12 : hoursNormalized;
  return hours24 * 60 + minutesRaw;
};

const formatDuration = (startLabel, endLabel) => {
  const startMinutes = parseTimeToMinutes(startLabel);
  const endMinutes = parseTimeToMinutes(endLabel);

  if (startMinutes === null || endMinutes === null) {
    return '';
  }

  const diff = Math.max(0, endMinutes - startMinutes);
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;

  if (hours > 0 && minutes === 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes} min`;
};

export function generateTimetable(exams, rooms, slots,
                                   rawConstraints = {}) {
  const constraints = normalizeConstraints(rawConstraints);
  const sorted = [...exams].sort((a, b) => {
    const degA = exams.filter(e => e.id !== a.id &&
      e.students.some(s => a.students.includes(s))).length;
    const degB = exams.filter(e => e.id !== b.id &&
      e.students.some(s => b.students.includes(s))).length;
    return degB - degA;
  });
  const assignments = [];
  function solve(index) {
    if (index === sorted.length) return true;
    const exam = sorted[index];
    for (const slot of slots) {
      const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
      if (constraints.holidays.includes(slotDateStr)) continue;
      const check = canAssignExam(exam, slot, assignments, constraints);
      if (!check.ok) continue;
      const rooms_ = selectRoomsForExam(
        exam, slot.date, assignments, rooms);
      if (!rooms_) continue;
      assignments.push({ exam, slot, rooms: rooms_ });
      if (solve(index + 1)) return true;
      assignments.pop();
    }
    return false;
  }
  if (!solve(0)) return null;
  const conflicts = detectConflicts(assignments, constraints);
  return conflicts.length > 0 ? null : assignments;
}

export function generateTimetableDetailed(exams, rooms, slots, rawConstraints = {}) {
  const constraints = normalizeConstraints(rawConstraints);
  const trace = [];

  const safeExams = Array.isArray(exams) ? exams : [];
  const safeRooms = Array.isArray(rooms) ? rooms : [];
  const safeSlots = Array.isArray(slots) ? slots : [];

  const sortedExams = [...safeExams].sort((a, b) => {
    const studentsA = Array.isArray(a?.students) ? a.students : [];
    const studentsB = Array.isArray(b?.students) ? b.students : [];

    const degreeA = safeExams.filter((exam) => {
      if (!exam || exam.id === a?.id) return false;
      const roster = Array.isArray(exam.students) ? exam.students : [];
      return roster.some(student => studentsA.includes(student));
    }).length;

    const degreeB = safeExams.filter((exam) => {
      if (!exam || exam.id === b?.id) return false;
      const roster = Array.isArray(exam.students) ? exam.students : [];
      return roster.some(student => studentsB.includes(student));
    }).length;

    return degreeB - degreeA;
  });

  const assignments = [];
  const lockedAssignments = Array.isArray(constraints.lockedAssignments) ? constraints.lockedAssignments : [];

  const safeLockedAssignments = lockedAssignments
    .map((item) => {
      const exam = safeExams.find((currentExam) => currentExam.id === item.examId);
      const slot = safeSlots.find((currentSlot) => currentSlot.id === item.slotId);
      if (!exam || !slot) return null;

      const selectedRooms = Array.isArray(item.roomIds) && item.roomIds.length
        ? safeRooms.filter((room) => item.roomIds.includes(room.id))
        : selectRoomsForExam(exam, slot?.date, assignments, safeRooms);

      if (!selectedRooms || !selectedRooms.length) {
        return null;
      }

      return {
        exam,
        slot,
        rooms: selectedRooms,
        locked: true,
      };
    })
    .filter(Boolean);

  const pushTrace = (entry) => {
    trace.push(entry);
  };

  const mapReason = (reason) => {
    if (reason === 'student-conflict') return 'same-day-student-conflict';
    return reason;
  };

  for (const lockedItem of safeLockedAssignments) {
    if (!slotCanFitExamDuration(lockedItem.exam, lockedItem.slot)) {
      return {
        timetable: null,
        trace: [{
          type: 'reject',
          reason: 'duration-overflow',
          examName: lockedItem.exam?.name || '',
          slotName: lockedItem.slot?.name || '',
        }],
      };
    }

    const check = canAssignExam(lockedItem.exam, lockedItem.slot, assignments, constraints);
    if (!check.ok) {
      return {
        timetable: null,
        trace: [{
          type: 'reject',
          reason: `locked-${mapReason(check.reason)}`,
          examName: lockedItem.exam?.name || '',
          slotName: lockedItem.slot?.name || '',
        }],
      };
    }

    assignments.push(lockedItem);
  }

  const unlockedExams = sortedExams.filter((exam) => !safeLockedAssignments.some((locked) => locked.exam.id === exam.id));

  const solve = (index) => {
    if (index === unlockedExams.length) {
      return true;
    }

    const exam = unlockedExams[index];

    for (const slot of safeSlots) {
      if (!slot?.date) continue;
      const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
      if (Array.isArray(constraints.holidays) && constraints.holidays.includes(slotDateStr)) {
        pushTrace({
          type: 'reject',
          reason: 'holiday',
          examName: exam?.name || '',
          slotName: slot?.name || slotDateStr,
        });
        continue;
      }

      const check = canAssignExam(exam, slot, assignments, constraints);
      if (!check.ok) {
        pushTrace({
          type: 'reject',
          reason: mapReason(check.reason),
          examName: exam?.name || '',
          slotName: slot?.name || slotDateStr,
        });
        continue;
      }

      if (!slotCanFitExamDuration(exam, slot)) {
        pushTrace({
          type: 'reject',
          reason: 'duration-overflow',
          examName: exam?.name || '',
          slotName: slot?.name || slotDateStr,
        });
        continue;
      }

      const selectedRooms = selectRoomsForExam(exam, slot?.date, assignments, safeRooms);
      if (!selectedRooms) {
        pushTrace({
          type: 'reject',
          reason: 'insufficient-capacity',
          examName: exam?.name || '',
          slotName: slot?.name || slotDateStr,
        });
        continue;
      }

      assignments.push({ exam, slot, rooms: selectedRooms });
      if (solve(index + 1)) {
        return true;
      }

      assignments.pop();
      pushTrace({
        type: 'backtrack',
        reason: 'backtrack',
        examName: exam?.name || '',
        slotName: slot?.name || slotDateStr,
      });
    }

    return false;
  };

  const solved = solve(0);
  if (!solved) {
    return { timetable: null, trace };
  }

  const conflicts = detectConflicts(assignments, constraints);
  if (conflicts.length > 0) {
    return { timetable: null, trace };
  }

  const sortedAssignments = [...assignments].sort((a, b) => {
    const dateA = new Date(a.slot?.date);
    const dateB = new Date(b.slot?.date);
    const diff = dateA - dateB;
    if (diff !== 0) return diff;

    const timeA = parseTimeToMinutes(a.slot?.time) ?? 0;
    const timeB = parseTimeToMinutes(b.slot?.time) ?? 0;
    return timeA - timeB;
  });

  const timetable = sortedAssignments.map((item) => {
    const startTime = item.slot?.time || '';
    const endTime = item.slot?.endTime || '';
    const totalCapacity = Array.isArray(item.rooms)
      ? item.rooms.reduce((sum, room) => sum + (Number(room?.capacity) || 0), 0)
      : 0;

    return {
      ...item,
      startTime,
      endTime,
      duration: formatDuration(startTime, endTime),
      examDurationMinutes: getDurationMinutes(item.exam),
      totalCapacity,
    };
  });

  return { timetable, trace };
}

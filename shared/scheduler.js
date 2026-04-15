import { differenceInCalendarDays, format } from 'date-fns';
import { canAssignExam, detectConflicts, normalizeConstraints } from './conflictDetector.js';

/**
 * Automated Exam Timetable Generator - Backtracking Engine (v6 Multi-Room)
 */

export const generateTimetable = (exams, rooms, slots, constraints = {}) => {
  const normalizedConstraints = normalizeConstraints(constraints);
  const assignments = [];
  const { holidays = [] } = normalizedConstraints;

  const examsWithMetadata = exams.map(exam => {
    const conflicts = exams.filter(other =>
      other.id !== exam.id &&
      other.students.some(s => exam.students.includes(s))
    ).length;
    return { ...exam, degree: conflicts };
  });

  const sortedExams = [...examsWithMetadata].sort((a, b) => b.degree - a.degree);

  const selectRoomsForExam = (exam, slot) => {
    const slotDate = new Date(slot.date);
    const occupiedRoomIds = new Set(
      assignments
        .filter(a => differenceInCalendarDays(new Date(a.slot.date), slotDate) === 0)
        .flatMap(a => a.rooms.map(r => r.id))
    );

    const availableRooms = rooms
      .filter(room => !occupiedRoomIds.has(room.id))
      .sort((a, b) => b.capacity - a.capacity);

    if (!normalizedConstraints.checkCapacity) {
      return availableRooms.length ? { selectedRooms: [availableRooms[0]], totalCapacity: availableRooms[0].capacity } : null;
    }

    const selectedRooms = [];
    let totalCapacity = 0;
    for (const room of availableRooms) {
      selectedRooms.push(room);
      totalCapacity += room.capacity;
      if (totalCapacity >= exam.students.length) {
        return { selectedRooms, totalCapacity };
      }
    }

    return null;
  };

  const solve = (index) => {
    if (index === sortedExams.length) {
      return true;
    }

    const exam = sortedExams[index];

    for (const slot of slots) {
      const dateStr = format(new Date(slot.date), 'yyyy-MM-dd');
      if (holidays.includes(dateStr)) continue;

      const safetyCheck = canAssignExam(exam, slot, assignments, normalizedConstraints);
      if (!safetyCheck.ok) {
        continue;
      }

      const roomSelection = selectRoomsForExam(exam, slot);
      if (!roomSelection) {
        continue;
      }

      assignments.push({
        exam,
        slot,
        rooms: roomSelection.selectedRooms,
        totalCapacity: roomSelection.totalCapacity,
        startTime: '10:00 AM',
        endTime: exam.marks === 60 ? '12:00 PM' : '11:00 AM',
        duration: exam.marks === 60 ? '2 Hours' : '1 Hour'
      });

      if (solve(index + 1)) return true;

      assignments.pop();
    }

    return false;
  };

  if (!solve(0)) {
    return null;
  }

  const conflicts = detectConflicts(assignments, normalizedConstraints);
  return conflicts.length ? null : assignments;
};
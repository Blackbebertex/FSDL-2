import { generateTimetable } from './shared/scheduler.js';
import { detectConflicts } from './shared/conflictDetector.js';
import { format, differenceInCalendarDays } from 'date-fns';

const STUDENT_POOL = Array.from({ length: 400 }, (_, idx) => `Student ${String(idx + 1).padStart(3, '0')}`);
const pickStudents = (pool, start, count) => Array.from({ length: count }, (_, offset) => pool[(start + offset) % pool.length]);
const mergeStudentGroups = (...groups) => [...new Set(groups.flat())];

const INITIAL_EXAMS = [
  { id: '1', name: 'BCE26PC01 : Operating System', students: mergeStudentGroups(pickStudents(STUDENT_POOL, 0, 180), pickStudents(STUDENT_POOL, 220, 40)), marks: 60, type: 'THEORY' },
  { id: '2', name: 'BCE26PC02 : Design and Analysis of Algorithms', students: mergeStudentGroups(pickStudents(STUDENT_POOL, 120, 180), pickStudents(STUDENT_POOL, 0, 40)), marks: 60, type: 'THEORY' },
  { id: '3', name: 'BCE26PC03 : Software Engineering', students: mergeStudentGroups(pickStudents(STUDENT_POOL, 240, 160), pickStudents(STUDENT_POOL, 80, 50)), marks: 60, type: 'THEORY' },
  { id: '4', name: 'BCE26VS01 : Full Stack Development', students: mergeStudentGroups(pickStudents(STUDENT_POOL, 60, 140), pickStudents(STUDENT_POOL, 300, 60)), marks: 30, type: 'LAB' },
  { id: '5', name: 'BCE26PE02 : Blockchain Technology', students: mergeStudentGroups(pickStudents(STUDENT_POOL, 170, 170), pickStudents(STUDENT_POOL, 20, 30)), marks: 60, type: 'THEORY' },
  { id: '6', name: 'BCE26PE05 : Cyber Security and Forensics', students: mergeStudentGroups(pickStudents(STUDENT_POOL, 20, 140), pickStudents(STUDENT_POOL, 240, 70)), marks: 60, type: 'THEORY' },
  { id: '7', name: 'BCS26MD05 : Generative AI Applications', students: mergeStudentGroups(pickStudents(STUDENT_POOL, 100, 160), pickStudents(STUDENT_POOL, 320, 50)), marks: 60, type: 'THEORY' },
];

const INITIAL_ROOMS = [
  { id: 'R1', name: '6201', capacity: 35 },
  { id: 'R2', name: '6202', capacity: 35 },
  { id: 'R3', name: '6204', capacity: 35 },
  { id: 'R4', name: '6205', capacity: 35 },
  { id: 'R5', name: '6102', capacity: 35 },
  { id: 'R6', name: '6103', capacity: 35 },
  { id: 'R7', name: '6301', capacity: 35 },
  { id: 'R8', name: '6302', capacity: 35 },
  { id: 'R9', name: '6304', capacity: 35 },
  { id: 'R10', name: '6305', capacity: 35 },
  { id: 'R11', name: '6402', capacity: 35 },
  { id: 'R12', name: '6403', capacity: 35 },
];

const generateSlots = (startDateStr, count = 50) => {
  const slots = [];
  let current = new Date(startDateStr);
  let i = 0;
  const slotTimes = [
    { time: '10:00 AM', endTime: '11:00 AM' },
    { time: '2:00 PM', endTime: '3:00 PM' },
  ];

  while (slots.length < count) {
    const dayName = format(current, 'EEEE');
    if (dayName !== 'Sunday') {
      const slotDate = new Date(current);
      const dateLabel = format(slotDate, 'MMM d, EEEE');

      for (const [slotIndex, slotWindow] of slotTimes.entries()) {
        if (slots.length >= count) break;

        slots.push({
          id: `S${i}-${slotIndex}`,
          date: new Date(slotDate),
          name: `${dateLabel} • ${slotWindow.time}-${slotWindow.endTime}`,
          day: dayName,
          time: slotWindow.time,
          endTime: slotWindow.endTime,
        });
      }
    }
    current.setDate(current.getDate() + 1);
    i++;
  }
  return slots;
};

const slots = generateSlots('2026-05-04');
const result = generateTimetable(INITIAL_EXAMS, INITIAL_ROOMS, slots, { checkCapacity: true });

if (result) {
  console.log('--- TEST PASSED: TIMETABLE GENERATED ---');
  result.sort((a,b) => new Date(a.slot.date) - new Date(b.slot.date));
  const conflicts = detectConflicts(result, { checkCapacity: true });
  if (conflicts.length > 0) {
    throw new Error(`Conflict detector found ${conflicts.length} conflicts.`);
  }

  const firstExam = result.find(item => item.exam.id === '1');
  console.log(`Exam 1 student count: ${firstExam.exam.students.length}`);
  console.log(`Exam 1 rooms used: ${firstExam.rooms.length}`);

  if (firstExam.rooms.length < 1) {
    throw new Error('Expected at least one room assignment for exam 1.');
  }

  const roomDayKeys = new Set();
  result.forEach((item, idx) => {
    console.log(`${format(new Date(item.slot.date), 'yyyy-MM-dd')} (${item.slot.day}): ${item.exam.name} [${item.exam.marks} Marks] | Rooms (${item.rooms.length})`);
    const dateKey = format(new Date(item.slot.date), 'yyyy-MM-dd');
    for (const room of item.rooms) {
      const key = `${dateKey}-${room.id}`;
      if (roomDayKeys.has(key)) {
        throw new Error(`Room overlap detected for ${room.name} on ${dateKey}`);
      }
      roomDayKeys.add(key);
    }
    if (idx > 0) {
      const diff = differenceInCalendarDays(new Date(item.slot.date), new Date(result[idx-1].slot.date));
      console.log(`   (Gap: ${diff} days)`);
    }
  });
} else {
  console.error('--- TEST FAILED: NO TIMETABLE GENERATED ---');
}

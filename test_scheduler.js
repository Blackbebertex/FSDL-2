import { generateTimetable } from './src/utils/scheduler.js';
import { detectConflicts } from './src/utils/conflictDetector.js';
import { format, differenceInCalendarDays } from 'date-fns';

const MOCK_STUDENTS = Array.from({ length: 400 }, (_, idx) => `Student ${String(idx + 1).padStart(3, '0')}`);

const INITIAL_EXAMS = [
  { id: '1', name: 'BCE26PC01 : Operating System', students: MOCK_STUDENTS, marks: 60, type: 'THEORY' },
  { id: '2', name: 'BCE26PC02 : Design and Analysis of Algorithms', students: MOCK_STUDENTS, marks: 60, type: 'THEORY' },
  { id: '3', name: 'BCE26PC03 : Software Engineering', students: MOCK_STUDENTS, marks: 60, type: 'THEORY' },
  { id: '4', name: 'BCE26VS01 : Full Stack Development', students: MOCK_STUDENTS, marks: 30, type: 'LAB' },
  { id: '5', name: 'BCE26PE02 : Blockchain Technology', students: MOCK_STUDENTS, marks: 60, type: 'THEORY' },
  { id: '6', name: 'BCE26PE05 : Cyber Security and Forensics', students: MOCK_STUDENTS, marks: 60, type: 'THEORY' },
  { id: '7', name: 'BCS26MD05 : Generative AI Applications', students: MOCK_STUDENTS, marks: 60, type: 'THEORY' },
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
  while (slots.length < count) {
    const dayName = format(current, 'EEEE');
    if (dayName !== 'Sunday') {
      slots.push({
        id: `S${i}`,
        date: new Date(current),
        name: format(current, 'MMM d, EEEE'),
        day: dayName,
        time: '10:00 AM'
      });
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

  if (firstExam.rooms.length < 11) {
    throw new Error('Expected approximately 12 rooms for 400 students.');
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

const DEFAULT_START_DATE = '2026-05-04';
const DEFAULT_MONTH = '2026-05-01';

const buildStudentIds = (prefix, count) => {
  const normalizedPrefix = prefix || 'exam';
  const total = Number.isFinite(count) && count > 0 ? count : 1;

  return Array.from({ length: total }, (_, index) => (
    `${normalizedPrefix}-Student-${String(index + 1).padStart(3, '0')}`
  ));
};

export const DEFAULT_CONSTRAINTS = {
  checkCapacity: true,
  enforceSingleExamPerDay: true,
  minGapDays: 2,
  enforceFridaySaturdayRule: true,
  fridaySaturdayMinGap: 3,
  enforceSixtyMarkGap: true,
  sixtyMarkMinGap: 3,
  preventSameDayStudentConflict: true,
};

export const generateSlots = (startDateStr, count = 30) => {
  const slots = [];
  let current = new Date(startDateStr);
  let index = 0;

  while (slots.length < count) {
    const dayName = current.toLocaleDateString('en-US', { weekday: 'long' });
    if (dayName !== 'Sunday') {
      slots.push({
        id: `S${index}`,
        date: new Date(current).toISOString(),
        name: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }),
        day: dayName,
        time: '10:00 AM',
      });
    }

    current.setDate(current.getDate() + 1);
    index += 1;
  }

  return slots;
};

export const createDefaultWorkspacePayload = () => {
  const mockStudents = buildStudentIds('student', 400);

  const exams = [
    { id: '1', name: 'BCE26PC01 : Operating System', students: mockStudents, marks: 30, type: 'THEORY' },
    { id: '2', name: 'BCE26PC02 : Design and Analysis of Algorithms', students: mockStudents, marks: 30, type: 'THEORY' },
    { id: '3', name: 'BCE26PC03 : Software Engineering', students: mockStudents, marks: 30, type: 'THEORY' },
    { id: '4', name: 'BCE26VS01 : Full Stack Development', students: mockStudents, marks: 30, type: 'LAB' },
    { id: '5', name: 'BCE26PE02 : Blockchain Technology', students: mockStudents, marks: 30, type: 'THEORY' },
    { id: '6', name: 'BCE26PE05 : Cyber Security and Forensics', students: mockStudents, marks: 30, type: 'THEORY' },
    { id: '7', name: 'BCS26MD05 : Generative AI Applications', students: mockStudents, marks: 30, type: 'THEORY' },
  ];

  const rooms = [
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

  return {
    exams,
    rooms,
    startDateStr: DEFAULT_START_DATE,
    slots: generateSlots(DEFAULT_START_DATE),
    timetable: null,
    constraintConfig: { ...DEFAULT_CONSTRAINTS },
    holidays: [],
    currentMonth: new Date(DEFAULT_MONTH).toISOString(),
    theme: 'dark',
    density: 'comfortable',
    savedProfiles: [],
    auditTrail: [],
    version: 1,
  };
};

export const normalizeWorkspacePayload = (payload = {}) => ({
  ...createDefaultWorkspacePayload(),
  ...payload,
  slots: Array.isArray(payload.slots) ? payload.slots : generateSlots(payload.startDateStr || DEFAULT_START_DATE),
  constraintConfig: {
    ...DEFAULT_CONSTRAINTS,
    ...(payload.constraintConfig || {}),
  },
  holidays: Array.isArray(payload.holidays) ? payload.holidays : [],
  currentMonth: typeof payload.currentMonth === 'string' ? payload.currentMonth : new Date(DEFAULT_MONTH).toISOString(),
  savedProfiles: Array.isArray(payload.savedProfiles) ? payload.savedProfiles : [],
  auditTrail: Array.isArray(payload.auditTrail) ? payload.auditTrail : [],
  timetable: Array.isArray(payload.timetable) ? payload.timetable : null,
});
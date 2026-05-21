const DEFAULT_START_DATE = '2026-05-04';
const DEFAULT_MONTH = '2026-05-01';

const buildStudentIds = (prefix, count) => {
  const normalizedPrefix = prefix || 'exam';
  const total = Number.isFinite(count) && count > 0 ? count : 1;

  return Array.from({ length: total }, (_, index) => (
    `${normalizedPrefix}-Student-${String(index + 1).padStart(3, '0')}`
  ));
};

const pickStudents = (pool, start, count) => Array.from({ length: count }, (_, offset) => pool[(start + offset) % pool.length]);

const mergeStudentGroups = (...groups) => [...new Set(groups.flat())];

const buildExamStudentGroups = (pool = [], examCount = 7) => {
  const safePool = Array.isArray(pool) && pool.length ? pool : buildStudentIds('student', 400);
  const templates = [
    mergeStudentGroups(pickStudents(safePool, 0, 180), pickStudents(safePool, 220, 40)),
    mergeStudentGroups(pickStudents(safePool, 120, 180), pickStudents(safePool, 0, 40)),
    mergeStudentGroups(pickStudents(safePool, 240, 160), pickStudents(safePool, 80, 50)),
    mergeStudentGroups(pickStudents(safePool, 60, 140), pickStudents(safePool, 300, 60)),
    mergeStudentGroups(pickStudents(safePool, 170, 170), pickStudents(safePool, 20, 30)),
    mergeStudentGroups(pickStudents(safePool, 20, 140), pickStudents(safePool, 240, 70)),
    mergeStudentGroups(pickStudents(safePool, 100, 160), pickStudents(safePool, 320, 50)),
  ];

  return Array.from({ length: examCount }, (_, index) => {
    if (index < templates.length) {
      return templates[index];
    }

    return mergeStudentGroups(
      pickStudents(safePool, (index * 37) % safePool.length, 160),
      pickStudents(safePool, (index * 61 + 90) % safePool.length, 40)
    );
  });
};

const hasDualSlotTimes = (slotList = []) => {
  if (!Array.isArray(slotList) || slotList.length === 0) {
    return false;
  }

  const windows = new Set(slotList.map(slot => `${slot.time || ''}-${slot.endTime || ''}`));
  return windows.has('10:00 AM-11:00 AM') && windows.has('2:00 PM-3:00 PM');
};

const normalizeSlotWindows = (slotList = []) => {
  if (!Array.isArray(slotList)) {
    return [];
  }

  return slotList.map((slot) => {
    if (slot.time === '10:00 AM') {
      return {
        ...slot,
        endTime: '11:00 AM',
        name: `${slot.name?.split('-')[0]?.trim() || ''} - 10:00 AM - 11:00 AM`.trim(),
      };
    }

    if (slot.time === '2:00 PM') {
      return {
        ...slot,
        endTime: '3:00 PM',
        name: `${slot.name?.split('-')[0]?.trim() || ''} - 2:00 PM - 3:00 PM`.trim(),
      };
    }

    return slot;
  });
};

export const DEFAULT_CONSTRAINTS = {
  checkCapacity: true,
  enforceSingleExamPerDay: false,
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
  const slotTimes = [
    { time: '10:00 AM', endTime: '11:00 AM' },
    { time: '2:00 PM', endTime: '3:00 PM' },
  ];

  while (slots.length < count) {
    const dayName = current.toLocaleDateString('en-US', { weekday: 'long' });
    if (dayName !== 'Sunday') {
      const slotDate = new Date(current);
      const dateLabel = slotDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });

      for (const [slotIndex, slotWindow] of slotTimes.entries()) {
        if (slots.length >= count) break;

        slots.push({
          id: `S${index}-${slotIndex}`,
          date: slotDate.toISOString(),
          name: `${dateLabel} - ${slotWindow.time} - ${slotWindow.endTime}`,
          day: dayName,
          time: slotWindow.time,
          endTime: slotWindow.endTime,
        });
      }
    }

    current.setDate(current.getDate() + 1);
    index += 1;
  }

  return slots;
};

export const createDefaultWorkspacePayload = () => {
  const mockStudents = buildStudentIds('student', 400);
  const studentGroups = buildExamStudentGroups(mockStudents, 7);

  const exams = [
    { id: '1', name: 'BCE26PC01 : Operating System', students: studentGroups[0], marks: 30, type: 'THEORY' },
    { id: '2', name: 'BCE26PC02 : Design and Analysis of Algorithms', students: studentGroups[1], marks: 30, type: 'THEORY' },
    { id: '3', name: 'BCE26PC03 : Software Engineering', students: studentGroups[2], marks: 30, type: 'THEORY' },
    { id: '4', name: 'BCE26VS01 : Full Stack Development', students: studentGroups[3], marks: 30, type: 'LAB' },
    { id: '5', name: 'BCE26PE02 : Blockchain Technology', students: studentGroups[4], marks: 30, type: 'THEORY' },
    { id: '6', name: 'BCE26PE05 : Cyber Security and Forensics', students: studentGroups[5], marks: 30, type: 'THEORY' },
    { id: '7', name: 'BCS26MD05 : Generative AI Applications', students: studentGroups[6], marks: 30, type: 'THEORY' },
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
    lockedAssignments: [],
    holidays: [],
    currentMonth: new Date(DEFAULT_MONTH).toISOString(),
    sessionConfig: {
      startDate: DEFAULT_START_DATE,
      endDate: null,
      slotsPerDay: 2,
      timeWindows: [
        { startTime: '10:00 AM', endTime: '11:00 AM' },
        { startTime: '2:00 PM', endTime: '3:00 PM' },
      ],
    },
    seatPlan: null,
    roster: [],
    theme: 'dark',
    density: 'comfortable',
    savedProfiles: [],
    auditTrail: [],
    version: 1,
  };
};

export const normalizeWorkspacePayload = (payload = {}) => {
  const defaults = createDefaultWorkspacePayload();
  const resolvedStartDate = typeof payload.startDateStr === 'string' ? payload.startDateStr : DEFAULT_START_DATE;

  return {
    ...defaults,
    ...payload,
    exams: Array.isArray(payload.exams) && payload.exams.length
      ? payload.exams.map(exam => ({ ...exam, students: [...new Set(exam.students || [])] }))
      : defaults.exams,
    rooms: Array.isArray(payload.rooms) && payload.rooms.length ? payload.rooms : defaults.rooms,
    startDateStr: resolvedStartDate,
    slots: Array.isArray(payload.slots) && payload.slots.length && hasDualSlotTimes(payload.slots)
      ? normalizeSlotWindows(payload.slots)
      : generateSlots(resolvedStartDate),
    constraintConfig: {
      ...DEFAULT_CONSTRAINTS,
      ...(payload.constraintConfig || {}),
    },
    holidays: Array.isArray(payload.holidays) ? payload.holidays : [],
    currentMonth: typeof payload.currentMonth === 'string' ? payload.currentMonth : new Date(DEFAULT_MONTH).toISOString(),
    savedProfiles: Array.isArray(payload.savedProfiles) ? payload.savedProfiles : [],
    auditTrail: Array.isArray(payload.auditTrail) ? payload.auditTrail : [],
    timetable: Array.isArray(payload.timetable) ? payload.timetable : null,
  };
};
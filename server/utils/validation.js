const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const isIsoDate = (value) => {
  if (typeof value !== 'string') return false;
  return !Number.isNaN(new Date(value).valueOf());
};

const isPositiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

export const sanitizeText = (value, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  return value.trim().replace(/\s+/g, ' ');
};

export const sanitizeWorkspaceMeta = (incoming = {}) => {
  const title = sanitizeText(incoming.title, 'Exam Workspace');
  const semester = sanitizeText(incoming.semester, 'General');
  return { title: title.slice(0, 120), semester: semester.slice(0, 80) };
};

export const validateWorkspacePayload = (payload) => {
  if (!isObject(payload)) {
    return { ok: false, message: 'Payload must be an object.' };
  }

  const exams = Array.isArray(payload.exams) ? payload.exams : [];
  const rooms = Array.isArray(payload.rooms) ? payload.rooms : [];
  const slots = Array.isArray(payload.slots) ? payload.slots : [];
  const lockedAssignments = Array.isArray(payload.lockedAssignments) ? payload.lockedAssignments : [];

  if (!exams.length) {
    return { ok: false, message: 'At least one exam is required.' };
  }

  if (!rooms.length) {
    return { ok: false, message: 'At least one room is required.' };
  }

  if (!slots.length) {
    return { ok: false, message: 'At least one slot is required.' };
  }

  if (exams.some((exam) => !exam || typeof exam !== 'object' || !sanitizeText(exam.name))) {
    return { ok: false, message: 'Each exam must include a valid name.' };
  }

  if (exams.some((exam) => !exam.id)) {
    return { ok: false, message: 'Each exam must include an id.' };
  }

  if (exams.some((exam) => !isPositiveNumber(exam.marks))) {
    return { ok: false, message: 'Each exam must include valid marks.' };
  }

  if (exams.some((exam) => exam.durationMinutes !== undefined && !isPositiveNumber(exam.durationMinutes))) {
    return { ok: false, message: 'Exam duration must be a positive number.' };
  }

  if (exams.some((exam) => !Array.isArray(exam.students))) {
    return { ok: false, message: 'Each exam must include a students array.' };
  }

  if (rooms.some((room) => !room || typeof room !== 'object' || !sanitizeText(room.name))) {
    return { ok: false, message: 'Each room must include a valid name.' };
  }

  if (rooms.some((room) => !room.id)) {
    return { ok: false, message: 'Each room must include an id.' };
  }

  if (rooms.some((room) => !isPositiveNumber(room.capacity))) {
    return { ok: false, message: 'Each room capacity must be a positive number.' };
  }

  if (slots.some((slot) => !slot?.id || !isIsoDate(slot?.date) || !sanitizeText(slot?.name))) {
    return { ok: false, message: 'Each slot must include id, valid date, and name.' };
  }

  if (slots.some((slot) => !sanitizeText(slot?.time) || !sanitizeText(slot?.endTime))) {
    return { ok: false, message: 'Each slot must include start and end time.' };
  }

  const examIds = new Set(exams.map((exam) => exam.id));
  const roomIds = new Set(rooms.map((room) => room.id));
  const slotIds = new Set(slots.map((slot) => slot.id));

  if (lockedAssignments.some((item) => !item || !examIds.has(item.examId) || !slotIds.has(item.slotId))) {
    return { ok: false, message: 'Locked assignments must reference valid exam and slot ids.' };
  }

  if (lockedAssignments.some((item) => !Array.isArray(item.roomIds))) {
    return { ok: false, message: 'Locked assignment roomIds must be an array.' };
  }

  if (lockedAssignments.some((item) => item.roomIds.some((roomId) => !roomIds.has(roomId)))) {
    return { ok: false, message: 'Locked assignment contains unknown room id.' };
  }

  if (payload.sessionConfig && !isObject(payload.sessionConfig)) {
    return { ok: false, message: 'sessionConfig must be an object when provided.' };
  }

  if (payload.sessionConfig?.startDate && !isIsoDate(payload.sessionConfig.startDate)) {
    return { ok: false, message: 'sessionConfig.startDate must be a valid date.' };
  }

  if (payload.sessionConfig?.endDate && !isIsoDate(payload.sessionConfig.endDate)) {
    return { ok: false, message: 'sessionConfig.endDate must be a valid date.' };
  }

  if (payload.sessionConfig?.slotsPerDay !== undefined && !isPositiveNumber(payload.sessionConfig.slotsPerDay)) {
    return { ok: false, message: 'sessionConfig.slotsPerDay must be a positive number.' };
  }

  return { ok: true };
};

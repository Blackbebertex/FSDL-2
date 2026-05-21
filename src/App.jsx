import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createWorkspace,
  deleteWorkspace,
  fetchCurrentUser,
  fetchWorkspaceReports,
  generateWorkspaceTimetable,
  getSharedWorkspace,
  listWorkspaces,
  loadWorkspace,
  login,
  logout,
  saveWorkspace,
  setWorkspaceShare,
  updateWorkspaceMeta,
} from './services/workspaceApi';
import ModalDialog from './components/ModalDialog';
import ListBlock from './components/ListBlock';
import PinLockEntry from './components/PinLockEntry';
import SyllabusUpload from './components/SyllabusUpload';
import './App.css';

const DEFAULT_CONSTRAINTS = {
  checkCapacity: true,
  enforceSingleExamPerDay: false,
  minGapDays: 2,
  enforceFridaySaturdayRule: true,
  fridaySaturdayMinGap: 3,
  enforceSixtyMarkGap: true,
  sixtyMarkMinGap: 3,
  preventSameDayStudentConflict: true,
};

const DEFAULT_SESSION_CONFIG = {
  startDate: '2026-05-04',
  endDate: '2026-05-30',
  slotsPerDay: 2,
  timeWindows: [
    { startTime: '10:00 AM', endTime: '12:00 PM' },
    { startTime: '2:00 PM', endTime: '5:00 PM' },
  ],
};

const safeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const parseCsv = (raw) => {
  const lines = String(raw || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];

  const [header, ...rows] = lines;
  const columns = header.split(',').map((item) => item.trim().toLowerCase());
  const index = {
    exam: columns.indexOf('exam'),
    student: columns.indexOf('student'),
  };

  if (index.exam < 0 || index.student < 0) {
    throw new Error('CSV header must include exam,student');
  }

  return rows.map((line) => {
    const parts = line.split(',').map((item) => item.trim());
    return {
      exam: safeText(parts[index.exam]),
      student: safeText(parts[index.student]),
    };
  }).filter((row) => row.exam && row.student);
};

const toCsv = (rows, headers) => {
  const esc = (value) => `"${String(value).replace(/"/g, '""')}"`;
  return [
    headers.map(esc).join(','),
    ...rows.map((row) => headers.map((key) => esc(row[key] ?? '')).join(',')),
  ].join('\n');
};

const buildSlots = (sessionConfig) => {
  const slots = [];
  const startDate = new Date(sessionConfig.startDate);
  const endDate = new Date(sessionConfig.endDate || sessionConfig.startDate);

  if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) {
    return slots;
  }

  let cursor = new Date(startDate);
  let index = 0;

  while (cursor <= endDate) {
    const dayName = cursor.toLocaleDateString('en-US', { weekday: 'long' });
    if (dayName !== 'Sunday') {
      const dateLabel = cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
      for (let i = 0; i < Math.max(1, Number(sessionConfig.slotsPerDay) || 1); i += 1) {
        const window = sessionConfig.timeWindows[i] || sessionConfig.timeWindows[sessionConfig.timeWindows.length - 1];
        if (!window) continue;

        slots.push({
          id: `S-${index}-${i}`,
          date: new Date(cursor).toISOString(),
          day: dayName,
          time: window.startTime,
          endTime: window.endTime,
          name: `${dateLabel} - ${window.startTime} - ${window.endTime}`,
        });
      }
    }

    cursor.setDate(cursor.getDate() + 1);
    index += 1;
  }

  return slots;
};

const suggestionByReason = {
  'insufficient-capacity': 'Increase room capacity or add more rooms for this slot.',
  'min-gap-violation': 'Reduce minimum gap days or add more slots across dates.',
  'same-day-student-conflict': 'Move one exam to another day or split student roster.',
  'duration-overflow': 'Extend slot time window or reduce exam duration.',
  'locked-min-gap-violation': 'Remove one lock or reduce min-gap settings.',
  'holiday': 'Change holiday selection or create additional non-holiday slots.',
};

function App() {
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState('');

  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [workspaceMeta, setWorkspaceMeta] = useState({ title: '', semester: '' });

  const [exams, setExams] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [constraintConfig, setConstraintConfig] = useState(DEFAULT_CONSTRAINTS);
  const [sessionConfig, setSessionConfig] = useState(DEFAULT_SESSION_CONFIG);
  const [holidays, setHolidays] = useState([]);
  const [lockedAssignments, setLockedAssignments] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [seatPlan, setSeatPlan] = useState(null);
  const [trace, setTrace] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [feedbackKind, setFeedbackKind] = useState('info');
  const [syncStatus, setSyncStatus] = useState('idle');
  const [retryCount, setRetryCount] = useState(0);
  const [serverRevision, setServerRevision] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [examFilter, setExamFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');

  const [newExam, setNewExam] = useState({ name: '', marks: 30, durationMinutes: 120 });
  const [newRoom, setNewRoom] = useState({ name: '', capacity: 35 });
  const [rosterCsv, setRosterCsv] = useState('');
  const [reports, setReports] = useState({ roomWise: {}, studentWise: {} });
  const [showSyllabusUpload, setShowSyllabusUpload] = useState(false);

  const [historyPast, setHistoryPast] = useState([]);
  const [historyFuture, setHistoryFuture] = useState([]);

  const [shareLink, setShareLink] = useState('');
  const [sharedTokenInput, setSharedTokenInput] = useState('');
  const [examEditDraft, setExamEditDraft] = useState(null);
  const [roomEditDraft, setRoomEditDraft] = useState(null);
  const [studentReportQuery, setStudentReportQuery] = useState('');
  const [studentReportPage, setStudentReportPage] = useState(1);
  const [studentReportSort, setStudentReportSort] = useState('student-asc');
  const serverRevisionRef = useRef(null);
  const syncStatusRef = useRef(syncStatus);

  const STUDENT_REPORT_PAGE_SIZE = 15;

  useEffect(() => {
    serverRevisionRef.current = serverRevision;
  }, [serverRevision]);

  useEffect(() => {
    syncStatusRef.current = syncStatus;
  }, [syncStatus]);

  const slots = useMemo(() => buildSlots(sessionConfig), [sessionConfig]);

  const filteredExams = useMemo(() => {
    const query = safeText(examFilter).toLowerCase();
    if (!query) return exams;
    return exams.filter((exam) => (
      String(exam.name || '').toLowerCase().includes(query)
      || String(exam.marks || '').includes(query)
    ));
  }, [examFilter, exams]);

  const filteredRooms = useMemo(() => {
    const query = safeText(roomFilter).toLowerCase();
    if (!query) return rooms;
    return rooms.filter((room) => (
      String(room.name || '').toLowerCase().includes(query)
      || String(room.capacity || '').includes(query)
    ));
  }, [roomFilter, rooms]);

  const snapshot = useMemo(() => ({
    exams,
    rooms,
    slots,
    timetable,
    seatPlan,
    holidays,
    sessionConfig,
    lockedAssignments,
    constraintConfig,
    roster: exams.flatMap((exam) => (exam.students || []).map((student) => ({ examId: exam.id, student }))),
  }), [constraintConfig, exams, holidays, lockedAssignments, rooms, seatPlan, sessionConfig, slots, timetable]);

  const pushHistory = (nextState) => {
    setHistoryPast((prev) => [...prev.slice(-29), snapshot]);
    setHistoryFuture([]);

    setExams(nextState.exams);
    setRooms(nextState.rooms);
    setConstraintConfig(nextState.constraintConfig);
    setSessionConfig(nextState.sessionConfig);
    setHolidays(nextState.holidays);
    setLockedAssignments(nextState.lockedAssignments);
    setTimetable(nextState.timetable || []);
    setSeatPlan(nextState.seatPlan || null);
  };

  const hydrateWorkspace = async (workspaceId) => {
    const response = await loadWorkspace(workspaceId);
    const payload = response.workspace?.payload || response.workspace || {};

    setExams(Array.isArray(payload.exams) ? payload.exams : []);
    setRooms(Array.isArray(payload.rooms) ? payload.rooms : []);
    setConstraintConfig({ ...DEFAULT_CONSTRAINTS, ...(payload.constraintConfig || {}) });
    setSessionConfig({ ...DEFAULT_SESSION_CONFIG, ...(payload.sessionConfig || {}) });
    setHolidays(Array.isArray(payload.holidays) ? payload.holidays : []);
    setLockedAssignments(Array.isArray(payload.lockedAssignments) ? payload.lockedAssignments : []);
    setTimetable(Array.isArray(payload.timetable) ? payload.timetable : []);
    setSeatPlan(payload.seatPlan || null);
    setServerRevision(response.workspace?.updatedAt || null);
    setSyncStatus('synced');
    setHistoryPast([]);
    setHistoryFuture([]);
  };

  const bootstrap = useCallback(async () => {
    try {
      const me = await fetchCurrentUser();
      setCurrentUser(me.user);

      const list = await listWorkspaces();
      const items = list.workspaces || [];
      setWorkspaces(items);

      if (items.length) {
        setActiveWorkspaceId(items[0].id);
        setWorkspaceMeta({ title: items[0].title, semester: items[0].semester });
        await hydrateWorkspace(items[0].id);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setIsBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      bootstrap();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [bootstrap]);

  useEffect(() => {
    if (!currentUser || !activeWorkspaceId || syncStatusRef.current === 'conflict') return;

    const timeout = syncStatusRef.current === 'error'
      ? Math.min(1000 * Math.pow(2, retryCount), 30000) // Exponential backoff max 30s
      : 350; // Normal debounce

    const timer = window.setTimeout(() => {
      setSyncStatus('syncing');
      saveWorkspace(activeWorkspaceId, snapshot, serverRevisionRef.current)
        .then((response) => {
          setServerRevision(response.workspace?.updatedAt || serverRevisionRef.current);
          setSyncStatus('synced');
          setRetryCount(0);
        })
        .catch((error) => {
          if (error?.status === 401) {
            setCurrentUser(null);
            setFeedbackKind('error');
            setFeedback('Session expired. Please sign in again.');
            return;
          }

          if (error?.status === 409) {
            setSyncStatus('conflict');
            setFeedbackKind('error');
            setFeedback('Autosave conflict detected. Reload server version or force save.');
            return;
          }

          setSyncStatus('error');
          setRetryCount((c) => c + 1);
          setFeedbackKind('error');
          setFeedback(`Autosave failed. Retrying in ${Math.round(timeout / 1000)}s...`);
        });
    }, timeout);

    return () => window.clearTimeout(timer);
  }, [activeWorkspaceId, currentUser, snapshot, retryCount]);

  const handleLogin = async () => {
    setAuthError('');
    try {
      await login(loginForm.username, loginForm.password);
      await bootstrap();
      setFeedbackKind('success');
      setFeedback('Signed in successfully.');
    } catch (error) {
      setAuthError(error.message || 'Login failed.');
    }
  };

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    setWorkspaces([]);
    setActiveWorkspaceId('');
  };

  const selectWorkspace = async (workspaceId) => {
    const target = workspaces.find((item) => item.id === workspaceId);
    setActiveWorkspaceId(workspaceId);
    setWorkspaceMeta({ title: target?.title || '', semester: target?.semester || '' });
    await hydrateWorkspace(workspaceId);
  };

  const handleCreateWorkspace = async () => {
    if (!safeText(workspaceMeta.title) || !safeText(workspaceMeta.semester)) {
      setFeedback('Workspace title and semester are required.');
      return;
    }

    try {
      const response = await createWorkspace(workspaceMeta);
      const created = response.workspace;
      const list = await listWorkspaces();
      setWorkspaces(list.workspaces || []);
      await selectWorkspace(created.id);
      setFeedbackKind('success');
      setFeedback('Workspace created.');
    } catch (error) {
      setFeedbackKind('error');
      setFeedback(error.message || 'Failed to create workspace.');
    }
  };

  const handleRenameWorkspace = async () => {
    if (!activeWorkspaceId) return;
    try {
      await updateWorkspaceMeta(activeWorkspaceId, workspaceMeta);
      const list = await listWorkspaces();
      setWorkspaces(list.workspaces || []);
      setFeedbackKind('success');
      setFeedback('Workspace metadata updated.');
    } catch (error) {
      setFeedbackKind('error');
      setFeedback(error.message || 'Failed to rename workspace.');
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!activeWorkspaceId) return;
    if (!window.confirm('Delete this workspace permanently?')) return;

    try {
      await deleteWorkspace(activeWorkspaceId);
      const list = await listWorkspaces();
      const items = list.workspaces || [];
      setWorkspaces(items);
      if (items.length) {
        await selectWorkspace(items[0].id);
      } else {
        setActiveWorkspaceId('');
        setExams([]);
        setRooms([]);
      }
      setFeedbackKind('success');
      setFeedback('Workspace deleted.');
    } catch (error) {
      setFeedbackKind('error');
      setFeedback(error.message || 'Failed to delete workspace.');
    }
  };

  const addExam = () => {
    const name = safeText(newExam.name);
    if (!name) {
      setFeedbackKind('error');
      setFeedback('Exam name is required.');
      return;
    }
    const next = {
      ...snapshot,
      exams: [...exams, {
        id: `E-${Date.now()}`,
        name,
        marks: Number(newExam.marks) || 30,
        durationMinutes: Number(newExam.durationMinutes) || 120,
        students: [],
      }],
    };
    pushHistory(next);
    setNewExam({ name: '', marks: 30, durationMinutes: 120 });
    setFeedbackKind('success');
    setFeedback('Exam added.');
  };

  const handleSyllabusDetailsExtracted = (details) => {
    // Auto-add extracted exam to the workspace so it appears immediately
    const added = {
      id: `E-${Date.now()}`,
      name: details.subjectName || '',
      marks: Number(details.marks) || 30,
      durationMinutes: Number(details.durationMinutes) || 120,
      students: [],
    };

    const next = {
      ...snapshot,
      exams: [...exams, added],
    };

    pushHistory(next);
    setShowSyllabusUpload(false);
    setFeedbackKind('success');
    setFeedback(`Extracted and added exam: ${details.subjectName || 'Exam'}.`);
  };

  const addRoom = () => {
    const name = safeText(newRoom.name);
    if (!name) {
      setFeedbackKind('error');
      setFeedback('Room name is required.');
      return;
    }
    const next = {
      ...snapshot,
      rooms: [...rooms, {
        id: `R-${Date.now()}`,
        name,
        capacity: Number(newRoom.capacity) || 35,
      }],
    };
    pushHistory(next);
    setNewRoom({ name: '', capacity: 35 });
    setFeedbackKind('success');
    setFeedback('Room added.');
  };

  const startEditExam = (examId) => {
    const target = exams.find((exam) => exam.id === examId);
    if (!target) return;

    setExamEditDraft({
      id: target.id,
      name: target.name,
      marks: Number(target.marks) || 30,
      durationMinutes: Number(target.durationMinutes) || 120,
    });
  };

  const saveExamEdit = () => {
    if (!examEditDraft) return;

    const cleanedName = safeText(examEditDraft.name);
    if (!cleanedName) {
      setFeedback('Exam name cannot be empty.');
      return;
    }

    pushHistory({
      ...snapshot,
      exams: exams.map((exam) => exam.id === examEditDraft.id ? {
        ...exam,
        name: cleanedName,
        marks: Number(examEditDraft.marks) || exam.marks,
        durationMinutes: Number(examEditDraft.durationMinutes) || exam.durationMinutes || 120,
      } : exam),
    });
    setExamEditDraft(null);
  };

  const startEditRoom = (roomId) => {
    const target = rooms.find((room) => room.id === roomId);
    if (!target) return;

    setRoomEditDraft({
      id: target.id,
      name: target.name,
      capacity: Number(target.capacity) || 1,
    });
  };

  const saveRoomEdit = () => {
    if (!roomEditDraft) return;

    const cleanedName = safeText(roomEditDraft.name);
    const capacity = Number(roomEditDraft.capacity) || 0;
    if (!cleanedName || capacity <= 0) {
      setFeedback('Room name and positive capacity are required.');
      return;
    }

    pushHistory({
      ...snapshot,
      rooms: rooms.map((room) => room.id === roomEditDraft.id ? {
        ...room,
        name: cleanedName,
        capacity,
      } : room),
    });
    setRoomEditDraft(null);
  };

  const removeExam = (examId) => {
    if (!window.confirm('Remove this exam?')) return;
    pushHistory({ ...snapshot, exams: exams.filter((exam) => exam.id !== examId) });
  };

  const removeRoom = (roomId) => {
    if (!window.confirm('Remove this room?')) return;
    pushHistory({ ...snapshot, rooms: rooms.filter((room) => room.id !== roomId) });
  };

  const exportRosterCsv = () => {
    const rows = exams.flatMap((exam) => (exam.students || []).map((student) => ({ exam: exam.name, student })));
    const csv = toCsv(rows, ['exam', 'student']);
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'student-roster.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importRosterCsv = () => {
    try {
      const rows = parseCsv(rosterCsv);
      const byExam = rows.reduce((acc, row) => {
        if (!acc[row.exam]) acc[row.exam] = [];
        acc[row.exam].push(row.student);
        return acc;
      }, {});

      pushHistory({
        ...snapshot,
        exams: exams.map((exam) => {
          const merged = [...new Set([...(exam.students || []), ...(byExam[exam.name] || [])])];
          return { ...exam, students: merged };
        }),
      });
      setFeedbackKind('success');
      setFeedback('Roster imported.');
    } catch (error) {
      setFeedbackKind('error');
      setFeedback(error.message || 'CSV import failed.');
    }
  };

  const exportTimetableCsv = () => {
    const rows = timetable.map((item) => ({
      date: item.slot.name,
      time: `${item.startTime} - ${item.endTime}`,
      exam: item.exam.name,
      rooms: (item.rooms || []).map((room) => room.name).join(' | '),
      seats: `${item.exam.students.length}/${item.totalCapacity}`,
    }));
    const csv = toCsv(rows, ['date', 'time', 'exam', 'rooms', 'seats']);
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'timetable.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportSeatPlanCsv = () => {
    const rows = (seatPlan?.byExam || []).flatMap((examEntry) => examEntry.students.map((row) => ({
      student: row.student,
      exam: row.examName,
      slot: row.slotName,
      room: row.roomName,
    })));
    const csv = toCsv(rows, ['student', 'exam', 'slot', 'room']);
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'seat-plan.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleGenerate = async () => {
    if (!activeWorkspaceId) return;

    try {
      setIsGenerating(true);
      const payload = { ...snapshot, slots };
      const response = await generateWorkspaceTimetable(activeWorkspaceId, payload, serverRevisionRef.current);
      setTimetable(response.timetable || []);
      setSeatPlan(response.seatPlan || null);
      setTrace(Array.isArray(response.trace) ? response.trace : []);
      setServerRevision(response.workspace?.updatedAt || serverRevisionRef.current);
      setSyncStatus('synced');
      setFeedbackKind('success');
      setFeedback('Timetable generated.');

      const reportPayload = await fetchWorkspaceReports(activeWorkspaceId);
      setReports({
        roomWise: reportPayload.roomWise || {},
        studentWise: reportPayload.studentWise || {},
      });
      setStudentReportPage(1);
    } catch (error) {
      setSyncStatus('error');
      setFeedbackKind('error');
      if (error?.status === 422) {
        setFeedback('No feasible schedule found with current constraints. Try adding more slots or relaxing gap rules.');
      } else {
        setFeedback(error.message || 'Generation failed.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const pinExam = (examId, slotId) => {
    const exists = lockedAssignments.some((item) => item.examId === examId);
    const nextLocks = exists
      ? lockedAssignments.map((item) => item.examId === examId ? { ...item, slotId } : item)
      : [...lockedAssignments, { examId, slotId, roomIds: [] }];

    pushHistory({ ...snapshot, lockedAssignments: nextLocks });
  };

  const setPinnedRooms = (examId, roomIds) => {
    const nextLocks = lockedAssignments.map((item) => item.examId === examId ? {
      ...item,
      roomIds,
    } : item);

    pushHistory({ ...snapshot, lockedAssignments: nextLocks });
  };

  const selectAllPinnedRooms = (examId) => {
    setPinnedRooms(examId, rooms.map((room) => room.id));
  };

  const clearAllPinnedRooms = (examId) => {
    setPinnedRooms(examId, []);
  };

  const clearPin = (examId) => {
    pushHistory({
      ...snapshot,
      lockedAssignments: lockedAssignments.filter((item) => item.examId !== examId),
    });
  };

  const studentReportRows = useMemo(() => {
    const entries = Object.entries(reports.studentWise || {});
    const query = safeText(studentReportQuery).toLowerCase();

    const filtered = entries.filter(([student, items]) => {
      if (!query) return true;
      const inStudent = student.toLowerCase().includes(query);
      const inExam = items.some((entry) => String(entry.examName || '').toLowerCase().includes(query));
      const inRoom = items.some((entry) => String(entry.roomName || '').toLowerCase().includes(query));
      return inStudent || inExam || inRoom;
    });

    const sorted = [...filtered].sort((a, b) => {
      const [studentA, entriesA] = a;
      const [studentB, entriesB] = b;

      if (studentReportSort === 'room') {
        const roomA = String(entriesA?.[0]?.roomName || '');
        const roomB = String(entriesB?.[0]?.roomName || '');
        return roomA.localeCompare(roomB) || studentA.localeCompare(studentB);
      }

      if (studentReportSort === 'exam-count') {
        return entriesB.length - entriesA.length || studentA.localeCompare(studentB);
      }

      return studentA.localeCompare(studentB);
    });

    const totalPages = Math.max(1, Math.ceil(sorted.length / STUDENT_REPORT_PAGE_SIZE));
    const safePage = Math.min(studentReportPage, totalPages);
    const start = (safePage - 1) * STUDENT_REPORT_PAGE_SIZE;
    const end = start + STUDENT_REPORT_PAGE_SIZE;

    return {
      totalPages,
      currentPage: safePage,
      totalRows: sorted.length,
      rows: sorted.slice(start, end),
    };
  }, [reports.studentWise, studentReportPage, studentReportQuery, studentReportSort]);

  const handleUndo = () => {
    const prev = historyPast[historyPast.length - 1];
    if (!prev) return;

    setHistoryFuture((f) => [snapshot, ...f]);
    setHistoryPast((p) => p.slice(0, -1));

    setExams(prev.exams || []);
    setRooms(prev.rooms || []);
    setConstraintConfig(prev.constraintConfig || DEFAULT_CONSTRAINTS);
    setSessionConfig(prev.sessionConfig || DEFAULT_SESSION_CONFIG);
    setHolidays(prev.holidays || []);
    setLockedAssignments(prev.lockedAssignments || []);
    setTimetable(prev.timetable || []);
    setSeatPlan(prev.seatPlan || null);
  };

  const handleRedo = () => {
    const next = historyFuture[0];
    if (!next) return;

    setHistoryPast((p) => [...p, snapshot]);
    setHistoryFuture((f) => f.slice(1));

    setExams(next.exams || []);
    setRooms(next.rooms || []);
    setConstraintConfig(next.constraintConfig || DEFAULT_CONSTRAINTS);
    setSessionConfig(next.sessionConfig || DEFAULT_SESSION_CONFIG);
    setHolidays(next.holidays || []);
    setLockedAssignments(next.lockedAssignments || []);
    setTimetable(next.timetable || []);
    setSeatPlan(next.seatPlan || null);
  };

  const toggleShare = async (enabled) => {
    if (!activeWorkspaceId) return;
    const response = await setWorkspaceShare(activeWorkspaceId, enabled);
    const token = response.workspace?.shareToken;
    if (token) {
      setShareLink(`${window.location.origin}?shared=${token}`);
    } else {
      setShareLink('');
    }
  };

  const loadShared = async () => {
    const token = sharedTokenInput.trim();
    if (!token) {
      setFeedbackKind('error');
      setFeedback('Please enter a share token.');
      return;
    }

    try {
      const response = await getSharedWorkspace(token);
      const payload = response.workspace?.payload || {};
      setExams(payload.exams || []);
      setRooms(payload.rooms || []);
      setTimetable(payload.timetable || []);
      setSeatPlan(payload.seatPlan || null);
      setSyncStatus('idle');
      setFeedbackKind('success');
      setFeedback('Loaded shared workspace snapshot in view mode.');
    } catch (error) {
      setFeedbackKind('error');
      setFeedback(error.message || 'Failed to load shared workspace.');
    }
  };

  const handleReloadServerVersion = async () => {
    if (!activeWorkspaceId) return;
    try {
      await hydrateWorkspace(activeWorkspaceId);
      setFeedbackKind('info');
      setFeedback('Reloaded latest server version.');
    } catch (error) {
      setFeedbackKind('error');
      setFeedback(error.message || 'Failed to reload server version.');
    }
  };

  const handleForceSave = async () => {
    if (!activeWorkspaceId) return;
    try {
      setSyncStatus('syncing');
      const response = await saveWorkspace(activeWorkspaceId, snapshot, null);
      setServerRevision(response.workspace?.updatedAt || null);
      setSyncStatus('synced');
      setFeedbackKind('success');
      setFeedback('Force save completed. Local changes are now on server.');
    } catch (error) {
      setSyncStatus('error');
      setFeedbackKind('error');
      setFeedback(error.message || 'Force save failed.');
    }
  };

  if (isBootstrapping) {
    return (
      <div className="app-container">
        <main className="content">
          <section className="card glass-card max-w-md mx-auto mt-20">
            <h2>Loading ExamFlow</h2>
            <p>Preparing your session, workspaces, and role access...</p>
          </section>
        </main>
      </div>
    );
  }

  if (!currentUser) {
    const demoNote = import.meta.env.DEV
      ? 'Development demo accounts are available locally.'
      : 'Contact your administrator for login credentials.';

    return (
      <div className="app-container">
        <main className="content">
          <section className="card glass-card max-w-sm mx-auto mt-20">
            <h2>ExamFlow Login</h2>
            <p>{demoNote}</p>
            <input
              value={loginForm.username}
              onChange={(e) => setLoginForm((p) => ({ ...p, username: e.target.value }))}
              placeholder="Username"
            />
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
              placeholder="Password"
            />
            <button className="btn-primary" onClick={handleLogin}>Sign In</button>
            {authError ? <p className="text-muted">{authError}</p> : null}
          </section>
        </main>
      </div>
    );
  }

  const canEdit = currentUser.role === 'admin' || currentUser.role === 'faculty';

  return (
    <div className="app-container density-comfortable">
      <nav className="sidebar glass-card">
        <h1>ExamFlow</h1>
        <p>Role: {currentUser.role}</p>
        <button className="btn-secondary" onClick={handleLogout}>Logout</button>

        <hr />
        <h3>Workspaces</h3>
        <select value={activeWorkspaceId} onChange={(e) => selectWorkspace(e.target.value)}>
          <option value="">Select workspace</option>
          {workspaces.map((item) => <option key={item.id} value={item.id}>{item.title} ({item.semester})</option>)}
        </select>

        <input
          placeholder="Workspace title"
          value={workspaceMeta.title}
          onChange={(e) => setWorkspaceMeta((p) => ({ ...p, title: e.target.value }))}
        />
        <input
          placeholder="Semester"
          value={workspaceMeta.semester}
          onChange={(e) => setWorkspaceMeta((p) => ({ ...p, semester: e.target.value }))}
        />

        {canEdit ? <button className="btn-secondary" onClick={handleCreateWorkspace}>Create</button> : null}
        {canEdit ? <button className="btn-secondary" onClick={handleRenameWorkspace}>Rename/Update</button> : null}
        {canEdit ? <button className="btn-secondary" onClick={handleDeleteWorkspace}>Delete</button> : null}

        {canEdit ? <button className="btn-secondary" onClick={() => toggleShare(true)}>Enable Share Link</button> : null}
        {canEdit ? <button className="btn-secondary" onClick={() => toggleShare(false)}>Disable Share Link</button> : null}
        {shareLink ? <p>Share: {shareLink}</p> : null}

        <input
          placeholder="Shared token"
          value={sharedTokenInput}
          onChange={(e) => setSharedTokenInput(e.target.value)}
        />
        <button className="btn-secondary" onClick={loadShared}>Load Shared</button>
      </nav>

      <main className="content">
        <header className="top-bar hero-shell">
          <div>
            <h2>Workspace Editor</h2>
            <p>Login, role permissions, multi-workspace, CRUD, slots, locks, reports, and exports.</p>
            {feedback ? <p className={`status-${feedbackKind}`}>{feedback}</p> : null}
            <p><span className={`sync-pill ${syncStatus}`}>Sync: {syncStatus}</span></p>
            {syncStatus === 'conflict' ? (
              <div className="action-row mt-10">
                <button className="btn-secondary btn-small" onClick={handleReloadServerVersion}>Reload Server Version</button>
                <button className="btn-secondary btn-small" onClick={handleForceSave}>Force Save Local</button>
              </div>
            ) : null}
          </div>
          <div className="hero-actions">
            <button className="btn-secondary" onClick={handleUndo} disabled={!historyPast.length}>Undo</button>
            <button className="btn-secondary" onClick={handleRedo} disabled={!historyFuture.length}>Redo</button>
            <button className="btn-primary" onClick={handleGenerate} disabled={!canEdit || !activeWorkspaceId || isGenerating}>{isGenerating ? 'Generating...' : 'Generate'}</button>
            <button className="btn-secondary" onClick={() => window.print()}>Print / PDF</button>
          </div>
        </header>

        <section className="input-grid">
          <article className="card glass-card span-full">
            <h3>Session Configurator</h3>
            <div className="add-form">
              <label>Start</label>
              <input type="date" value={sessionConfig.startDate} onChange={(e) => setSessionConfig((p) => ({ ...p, startDate: e.target.value }))} disabled={!canEdit} />
              <label>End</label>
              <input type="date" value={sessionConfig.endDate} onChange={(e) => setSessionConfig((p) => ({ ...p, endDate: e.target.value }))} disabled={!canEdit} />
              <label>Slots/Day</label>
              <input type="number" value={sessionConfig.slotsPerDay} onChange={(e) => setSessionConfig((p) => ({ ...p, slotsPerDay: Number(e.target.value) || 1 }))} disabled={!canEdit} />
            </div>
            <div className="list-container mt-10">
              {sessionConfig.timeWindows.map((window, idx) => (
                <div key={`${window.startTime}-${idx}`} className="list-item">
                  <span>Window {idx + 1}</span>
                  <input value={window.startTime} disabled={!canEdit} onChange={(e) => setSessionConfig((p) => ({
                    ...p,
                    timeWindows: p.timeWindows.map((w, i) => i === idx ? { ...w, startTime: e.target.value } : w),
                  }))} />
                  <input value={window.endTime} disabled={!canEdit} onChange={(e) => setSessionConfig((p) => ({
                    ...p,
                    timeWindows: p.timeWindows.map((w, i) => i === idx ? { ...w, endTime: e.target.value } : w),
                  }))} />
                </div>
              ))}
            </div>
          </article>

          <ListBlock title="Exams" className="">
            {canEdit ? (
              <div className="add-form">
                <input placeholder="Exam name" value={newExam.name} onChange={(e) => setNewExam((p) => ({ ...p, name: e.target.value }))} />
                <input type="number" placeholder="Marks" value={newExam.marks} onChange={(e) => setNewExam((p) => ({ ...p, marks: Number(e.target.value) || 30 }))} />
                <input type="number" placeholder="Duration min" value={newExam.durationMinutes} onChange={(e) => setNewExam((p) => ({ ...p, durationMinutes: Number(e.target.value) || 120 }))} />
                <button className="btn-secondary" onClick={addExam}>Add</button>
                <button className="btn-secondary" onClick={() => setShowSyllabusUpload(true)}>📄 Upload Syllabus</button>
              </div>
            ) : null}
            <input
              className="mt-10"
              value={examFilter}
              onChange={(event) => setExamFilter(event.target.value)}
              placeholder="Filter exams by name or marks"
            />
            <div className="list-container mt-10">
              {filteredExams.map((exam) => (
                <div key={exam.id} className="list-item">
                  <span>{exam.name} ({exam.marks}M, {exam.durationMinutes || 120}m)</span>
                  <div className="item-actions">
                    {canEdit ? <button className="btn-secondary btn-small" onClick={() => startEditExam(exam.id)}>Edit</button> : null}
                    {canEdit ? <button className="btn-secondary btn-small" onClick={() => removeExam(exam.id)}>Delete</button> : null}
                    {canEdit ? <button className="btn-secondary btn-small" onClick={() => clearPin(exam.id)}>Unpin</button> : null}
                  </div>
                </div>
              ))}
            </div>
          </ListBlock>

          <ListBlock title="Rooms" className="">
            {canEdit ? (
              <div className="add-form">
                <input placeholder="Room name" value={newRoom.name} onChange={(e) => setNewRoom((p) => ({ ...p, name: e.target.value }))} />
                <input type="number" placeholder="Capacity" value={newRoom.capacity} onChange={(e) => setNewRoom((p) => ({ ...p, capacity: Number(e.target.value) || 35 }))} />
                <button className="btn-secondary" onClick={addRoom}>Add</button>
              </div>
            ) : null}
            <input
              className="mt-10"
              value={roomFilter}
              onChange={(event) => setRoomFilter(event.target.value)}
              placeholder="Filter rooms by name or capacity"
            />
            <div className="list-container mt-10">
              {filteredRooms.map((room) => (
                <div key={room.id} className="list-item">
                  <span>{room.name} (Cap {room.capacity})</span>
                  <div className="item-actions">
                    {canEdit ? <button className="btn-secondary btn-small" onClick={() => startEditRoom(room.id)}>Edit</button> : null}
                    {canEdit ? <button className="btn-secondary btn-small" onClick={() => removeRoom(room.id)}>Delete</button> : null}
                  </div>
                </div>
              ))}
            </div>
          </ListBlock>

          <article className="card glass-card span-full">
            <h3>Roster CSV (exam,student)</h3>
            <textarea value={rosterCsv} onChange={(e) => setRosterCsv(e.target.value)} rows={4} placeholder="exam,student" />
            <div className="action-row">
              {canEdit ? <button className="btn-secondary" onClick={importRosterCsv}>Import CSV</button> : null}
              <button className="btn-secondary" onClick={exportRosterCsv}>Export CSV</button>
            </div>
          </article>

          <article className="card glass-card span-full">
            <h3>Manual Pin / Lock</h3>
            <p>Lock an exam into a fixed slot and optionally locked room set before generating.</p>
            <div className="list-container mt-10">
              {exams.map((exam) => (
                <PinLockEntry
                  key={`pin-${exam.id}`}
                  exam={exam}
                  slots={slots}
                  rooms={rooms}
                  lockedAssignments={lockedAssignments}
                  canEdit={canEdit}
                  onPin={pinExam}
                  onClearPin={clearPin}
                  onSelectAllRooms={selectAllPinnedRooms}
                  onClearRooms={clearAllPinnedRooms}
                  onToggleRoom={(examId, roomId, checked) => {
                    const current = lockedAssignments.find((i) => i.examId === examId);
                    const selected = current?.roomIds || [];
                    const next = checked ? [...selected, roomId] : selected.filter((id) => id !== roomId);
                    setPinnedRooms(examId, next);
                  }}
                />
              ))}
            </div>
          </article>

          <article className="card glass-card span-full">
            <h3>Constraint Config</h3>
            <div className="constraints-grid">
              {Object.keys(DEFAULT_CONSTRAINTS).map((key) => {
                const value = constraintConfig[key];
                if (typeof value === 'boolean') {
                  return (
                    <label key={key} className="constraint-item">
                      <span>{key}</span>
                      <input type="checkbox" checked={Boolean(value)} disabled={!canEdit} onChange={(e) => setConstraintConfig((p) => ({ ...p, [key]: e.target.checked }))} />
                    </label>
                  );
                }

                return (
                  <label key={key} className="constraint-item">
                    <span>{key}</span>
                    <input type="number" value={value} disabled={!canEdit} onChange={(e) => setConstraintConfig((p) => ({ ...p, [key]: Number(e.target.value) || p[key] }))} />
                  </label>
                );
              })}
            </div>
          </article>
        </section>

        <section className="output-section">
          <div className="section-header output-header">
            <h3>Timetable + Seat Allotment Reports</h3>
            <div className="output-actions">
              <button className="btn-secondary" onClick={exportTimetableCsv}>Export Timetable CSV</button>
              <button className="btn-secondary" onClick={exportSeatPlanCsv}>Export Seatplan CSV</button>
            </div>
          </div>

          <div className="grid-container glass-card mt-10">
            <table className="timetable-table">
              <thead>
                <tr>
                  <th>Slot</th>
                  <th>Exam</th>
                  <th>Rooms</th>
                  <th>Students</th>
                </tr>
              </thead>
              <tbody>
                {timetable.map((item) => (
                  <tr key={`${item.slot.id}-${item.exam.id}`}>
                    <td>{item.slot.name}</td>
                    <td>{item.exam.name}</td>
                    <td>{(item.rooms || []).map((room) => room.name).join(' | ')}</td>
                    <td>{item.exam.students.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="status-card glass-card mt-10">
            <h3>Constraint Failure Trace</h3>
            <div className="list-container mt-10">
              {trace.slice(-10).reverse().map((item, idx) => (
                <div className="list-item" key={`${item.reason}-${idx}`}>
                  <span>{item.examName} @ {item.slotName} - {item.reason}</span>
                  <span className="badge badge-warning">{suggestionByReason[item.reason] || 'Try adding slots, rooms, or relaxing constraints.'}</span>
                </div>
              ))}
            </div>
          </div>

          <ListBlock title="Room-wise Report" className="status-card mt-10">
            <div className="list-container mt-10">
              {Object.entries(reports.roomWise || {}).map(([roomName, entries]) => (
                <div key={roomName} className="list-item">
                  <strong>{roomName}</strong>
                  <span>{entries.length} seat allocations</span>
                </div>
              ))}
            </div>
          </ListBlock>

          <ListBlock title="Student-wise Report" className="status-card mt-10">
            <div className="add-form mt-10">
              <input
                value={studentReportQuery}
                onChange={(e) => {
                  setStudentReportQuery(e.target.value);
                  setStudentReportPage(1);
                }}
                placeholder="Filter by student, exam, or room"
              />
              <select
                value={studentReportSort}
                onChange={(e) => {
                  setStudentReportSort(e.target.value);
                  setStudentReportPage(1);
                }}
              >
                <option value="student-asc">Sort: Student A-Z</option>
                <option value="room">Sort: Room</option>
                <option value="exam-count">Sort: Exam Count</option>
              </select>
              <span className="badge">{studentReportRows.totalRows} matched</span>
            </div>
            <div className="list-container mt-10">
              {studentReportRows.rows.map(([student, entries]) => (
                <div key={student} className="list-item">
                  <strong>{student}</strong>
                  <span>{entries.map((entry) => `${entry.examName} (${entry.roomName})`).join('; ')}</span>
                </div>
              ))}
            </div>
            <div className="action-row mt-10">
              <button
                className="btn-secondary btn-small"
                disabled={studentReportRows.currentPage <= 1}
                onClick={() => setStudentReportPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span className="badge">Page {studentReportRows.currentPage} / {studentReportRows.totalPages}</span>
              <button
                className="btn-secondary btn-small"
                disabled={studentReportRows.currentPage >= studentReportRows.totalPages}
                onClick={() => setStudentReportPage((p) => Math.min(studentReportRows.totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </ListBlock>
        </section>

        {examEditDraft ? (
          <ModalDialog
            title="Edit Exam"
            size="sm"
            onCancel={() => setExamEditDraft(null)}
            onConfirm={saveExamEdit}
            confirmLabel="Save Exam"
          >
            <div className="add-form">
              <label>Name</label>
              <input value={examEditDraft.name} onChange={(e) => setExamEditDraft((p) => ({ ...p, name: e.target.value }))} />
              <label>Marks</label>
              <input type="number" value={examEditDraft.marks} onChange={(e) => setExamEditDraft((p) => ({ ...p, marks: Number(e.target.value) || 30 }))} />
              <label>Duration (min)</label>
              <input type="number" value={examEditDraft.durationMinutes} onChange={(e) => setExamEditDraft((p) => ({ ...p, durationMinutes: Number(e.target.value) || 120 }))} />
            </div>
          </ModalDialog>
        ) : null}

        {roomEditDraft ? (
          <ModalDialog
            title="Edit Room"
            size="sm"
            onCancel={() => setRoomEditDraft(null)}
            onConfirm={saveRoomEdit}
            confirmLabel="Save Room"
          >
            <div className="add-form">
              <label>Name</label>
              <input value={roomEditDraft.name} onChange={(e) => setRoomEditDraft((p) => ({ ...p, name: e.target.value }))} />
              <label>Capacity</label>
              <input type="number" value={roomEditDraft.capacity} onChange={(e) => setRoomEditDraft((p) => ({ ...p, capacity: Number(e.target.value) || 1 }))} />
            </div>
          </ModalDialog>
        ) : null}

        {showSyllabusUpload ? (
          <ModalDialog
            title=""
            size="md"
            onCancel={() => setShowSyllabusUpload(false)}
            hideActions
          >
            <SyllabusUpload
              onDetailsExtracted={handleSyllabusDetailsExtracted}
              onCancel={() => setShowSyllabusUpload(false)}
            />
          </ModalDialog>
        ) : null}
      </main>
    </div>
  );
}

export default App;

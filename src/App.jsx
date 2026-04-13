import React, { useEffect, useMemo, useRef, useState } from 'react';
import { generateTimetable } from './utils/scheduler';
import { detectConflicts } from './utils/conflictDetector';
import CalendarGrid from './components/CalendarGrid';
import './App.css';

const MOCK_STUDENTS = Array.from({ length: 400 }, (_, idx) => `Student ${String(idx + 1).padStart(3, '0')}`);

const INITIAL_EXAMS = [
  { id: '1', name: 'BCE26PC01 : Operating System', students: MOCK_STUDENTS, marks: 30, type: 'THEORY' },
  { id: '2', name: 'BCE26PC02 : Design and Analysis of Algorithms', students: MOCK_STUDENTS, marks: 30, type: 'THEORY' },
  { id: '3', name: 'BCE26PC03 : Software Engineering', students: MOCK_STUDENTS, marks: 30, type: 'THEORY' },
  { id: '4', name: 'BCE26VS01 : Full Stack Development', students: MOCK_STUDENTS, marks: 30, type: 'LAB' },
  { id: '5', name: 'BCE26PE02 : Blockchain Technology', students: MOCK_STUDENTS, marks: 30, type: 'THEORY' },
  { id: '6', name: 'BCE26PE05 : Cyber Security and Forensics', students: MOCK_STUDENTS, marks: 30, type: 'THEORY' },
  { id: '7', name: 'BCS26MD05 : Generative AI Applications', students: MOCK_STUDENTS, marks: 30, type: 'THEORY' },
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

const generateSlots = (startDateStr, count = 30) => {
  const slots = [];
  let current = new Date(startDateStr);
  let i = 0;
  while (slots.length < count) {
    const dayName = current.toLocaleDateString('en-US', { weekday: 'long' });
    if (dayName !== 'Sunday') {
      slots.push({
        id: `S${i}`,
        date: new Date(current),
        name: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }),
        day: dayName,
        time: '10:00 AM'
      });
    }
    current.setDate(current.getDate() + 1);
    i++;
  }
  return slots;
};

const DEFAULT_START_DATE = '2026-05-04';
const DEFAULT_MONTH = '2026-05-01';
const THEME_STORAGE_KEY = 'examflow.theme';
const DENSITY_STORAGE_KEY = 'examflow.density';
const PROFILE_STORAGE_KEY = 'examflow.profiles';
const AUDIT_STORAGE_KEY = 'examflow.audit';
const MAX_AUDIT_EVENTS = 120;

const DEFAULT_CONSTRAINTS = {
  checkCapacity: true,
  enforceSingleExamPerDay: true,
  minGapDays: 2,
  enforceFridaySaturdayRule: true,
  fridaySaturdayMinGap: 3,
  enforceSixtyMarkGap: true,
  sixtyMarkMinGap: 3,
  preventSameDayStudentConflict: true,
};

const readStoredValue = (key, fallback) => {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : fallback;
  } catch {
    return fallback;
  }
};

const saveStoredValue = (key, value) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures so the app still works in restricted browsers.
  }
};

const normalizeText = (value) => value.trim().replace(/\s+/g, ' ');

const csvEscape = (value) => `"${String(value).replace(/"/g, '""')}"`;

const buildStudentIds = (prefix, count) => {
  const normalizedPrefix = prefix || 'exam';
  const total = Number.isFinite(count) && count > 0 ? count : 1;

  return Array.from({ length: total }, (_, index) => (
    `${normalizedPrefix}-Student-${String(index + 1).padStart(3, '0')}`
  ));
};

const getDefaultTheme = () => {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

const cloneDefaultExams = () => INITIAL_EXAMS.map(exam => ({ ...exam, students: [...exam.students] }));

const cloneDefaultRooms = () => INITIAL_ROOMS.map(room => ({ ...room }));

const cloneDefaultConstraints = () => ({ ...DEFAULT_CONSTRAINTS });

const buildExportPayload = ({ exams, rooms, startDateStr, slots, timetable, constraintConfig, holidays, currentMonth }) => ({
  exams,
  rooms,
  startDateStr,
  slots,
  timetable,
  constraintConfig,
  holidays,
  currentMonth: currentMonth.toISOString(),
  exportedAt: new Date().toISOString(),
});

const formatDateTime = (iso) => new Date(iso).toLocaleString('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const downloadTextFile = (filename, content, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};


function App() {
  const importInputRef = useRef(null);
  const hasMountedRef = useRef(false);

  const [exams, setExams] = useState(() => readStoredValue('examflow.exams', cloneDefaultExams()));
  const [rooms, setRooms] = useState(() => readStoredValue('examflow.rooms', cloneDefaultRooms()));
  const [startDateStr, setStartDateStr] = useState(() => readStoredValue('examflow.startDateStr', DEFAULT_START_DATE));
  const [slots, setSlots] = useState(() => generateSlots(readStoredValue('examflow.startDateStr', DEFAULT_START_DATE)));
  const [timetable, setTimetable] = useState(() => readStoredValue('examflow.timetable', null));
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('input');
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [constraintConfig, setConstraintConfig] = useState(() => readStoredValue('examflow.constraints', cloneDefaultConstraints()));

  useEffect(() => {
    setSlots(generateSlots(startDateStr));
    if (hasMountedRef.current) {
      setTimetable(null);
    } else {
      hasMountedRef.current = true;
    }
  }, [startDateStr]);

  const [holidays, setHolidays] = useState(() => readStoredValue('examflow.holidays', []));
  const [currentMonth, setCurrentMonth] = useState(() => {
    const storedMonth = readStoredValue('examflow.currentMonth', DEFAULT_MONTH);
    return new Date(storedMonth);
  });

  const [newExamName, setNewExamName] = useState('');
  const [newExamMarks, setNewExamMarks] = useState(30);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCap, setNewRoomCap] = useState(35);
  const [examSearch, setExamSearch] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [profileName, setProfileName] = useState('');
  const [savedProfiles, setSavedProfiles] = useState(() => readStoredValue(PROFILE_STORAGE_KEY, []));
  const [auditTrail, setAuditTrail] = useState(() => readStoredValue(AUDIT_STORAGE_KEY, []));
  const [theme, setTheme] = useState(() => readStoredValue(THEME_STORAGE_KEY, getDefaultTheme()));
  const [density, setDensity] = useState(() => readStoredValue(DENSITY_STORAGE_KEY, 'comfortable'));

  useEffect(() => {
    saveStoredValue('examflow.exams', exams);
  }, [exams]);

  useEffect(() => {
    saveStoredValue('examflow.rooms', rooms);
  }, [rooms]);

  useEffect(() => {
    saveStoredValue('examflow.startDateStr', startDateStr);
  }, [startDateStr]);

  useEffect(() => {
    saveStoredValue('examflow.constraints', constraintConfig);
  }, [constraintConfig]);

  useEffect(() => {
    saveStoredValue('examflow.holidays', holidays);
  }, [holidays]);

  useEffect(() => {
    saveStoredValue('examflow.currentMonth', currentMonth.toISOString());
  }, [currentMonth]);

  useEffect(() => {
    saveStoredValue('examflow.timetable', timetable);
  }, [timetable]);

  useEffect(() => {
    saveStoredValue(THEME_STORAGE_KEY, theme);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    saveStoredValue(DENSITY_STORAGE_KEY, density);
  }, [density]);

  useEffect(() => {
    saveStoredValue(PROFILE_STORAGE_KEY, savedProfiles);
  }, [savedProfiles]);

  useEffect(() => {
    saveStoredValue(AUDIT_STORAGE_KEY, auditTrail);
  }, [auditTrail]);

  const filteredExams = useMemo(() => {
    const query = examSearch.trim().toLowerCase();
    if (!query) {
      return exams;
    }

    return exams.filter(exam => (
      exam.name.toLowerCase().includes(query) || String(exam.marks).includes(query)
    ));
  }, [examSearch, exams]);

  const filteredRooms = useMemo(() => {
    const query = roomSearch.trim().toLowerCase();
    if (!query) {
      return rooms;
    }

    return rooms.filter(room => (
      room.name.toLowerCase().includes(query) || String(room.capacity).includes(query)
    ));
  }, [roomSearch, rooms]);

  const clearSchedule = () => {
    setTimetable(null);
    setError(null);
  };

  const pushAuditEvent = (event, details) => {
    setAuditTrail(prev => [{
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      event,
      details,
    }, ...prev].slice(0, MAX_AUDIT_EVENTS));
  };

  const applyWorkspacePayload = (payload, sourceLabel = 'workspace') => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid workspace payload.');
    }

    if (Array.isArray(payload.exams)) setExams(payload.exams);
    if (Array.isArray(payload.rooms)) setRooms(payload.rooms);
    if (typeof payload.startDateStr === 'string') setStartDateStr(payload.startDateStr);
    if (Array.isArray(payload.holidays)) setHolidays(payload.holidays);
    if (payload.constraintConfig && typeof payload.constraintConfig === 'object') {
      setConstraintConfig({ ...DEFAULT_CONSTRAINTS, ...payload.constraintConfig });
    }
    if (payload.currentMonth) {
      setCurrentMonth(new Date(payload.currentMonth));
    }
    setTimetable(Array.isArray(payload.timetable) ? payload.timetable : null);
    setActiveTab(Array.isArray(payload.timetable) ? 'output' : 'input');
    pushAuditEvent('workspace-loaded', `Loaded from ${sourceLabel}`);
  };

  const toggleHoliday = (dateStr) => {
    setHolidays(prev => (prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]));
    clearSchedule();
    pushAuditEvent('holiday-toggled', dateStr);
  };

  const addExam = () => {
    const cleanedName = normalizeText(newExamName);
    if (!cleanedName) {
      setFeedback({ type: 'error', text: 'Enter an exam name before adding it.' });
      return;
    }

    if (exams.some(exam => exam.name.toLowerCase() === cleanedName.toLowerCase())) {
      setFeedback({ type: 'error', text: 'That exam already exists in the list.' });
      return;
    }

    const parsedMarks = Number.parseInt(newExamMarks, 10);
    if (![30, 60].includes(parsedMarks)) {
      setFeedback({ type: 'error', text: 'Marks must be either 30 or 60.' });
      return;
    }

    const newExam = {
      id: Date.now().toString(),
      name: cleanedName,
      students: buildStudentIds(cleanedName.replace(/[^a-z0-9]+/gi, '-').toLowerCase(), 400),
      marks: parsedMarks,
      type: parsedMarks === 60 ? 'THEORY' : 'LAB',
    };
    setExams([...exams, newExam]);
    setNewExamName('');
    clearSchedule();
    setFeedback({ type: 'success', text: 'Exam added and timetable cleared for regeneration.' });
    pushAuditEvent('exam-added', cleanedName);
  };

  const addRoom = () => {
    const cleanedName = normalizeText(newRoomName);
    const parsedCapacity = Number.parseInt(newRoomCap, 10);

    if (!cleanedName) {
      setFeedback({ type: 'error', text: 'Enter a room name before adding it.' });
      return;
    }

    if (!Number.isFinite(parsedCapacity) || parsedCapacity <= 0) {
      setFeedback({ type: 'error', text: 'Room capacity must be a positive number.' });
      return;
    }

    if (rooms.some(room => room.name.toLowerCase() === cleanedName.toLowerCase())) {
      setFeedback({ type: 'error', text: 'That room already exists in the list.' });
      return;
    }

    const newRoom = {
      id: 'R' + Date.now(),
      name: cleanedName,
      capacity: parsedCapacity
    };
    setRooms([...rooms, newRoom]);
    setNewRoomName('');
    setNewRoomCap(35);
    clearSchedule();
    setFeedback({ type: 'success', text: 'Room added and timetable cleared for regeneration.' });
    pushAuditEvent('room-added', cleanedName);
  };

  const removeExam = (id) => {
    const removed = exams.find(e => e.id === id);
    setExams(exams.filter(e => e.id !== id));
    clearSchedule();
    if (removed) pushAuditEvent('exam-removed', removed.name);
  };

  const removeRoom = (id) => {
    const removed = rooms.find(r => r.id === id);
    setRooms(rooms.filter(r => r.id !== id));
    clearSchedule();
    if (removed) pushAuditEvent('room-removed', removed.name);
  };

  const updateConstraint = (key, value) => {
    setConstraintConfig(prev => ({ ...prev, [key]: value }));
    clearSchedule();
  };

  const handleExportBackup = () => {
    const payload = buildExportPayload({ exams, rooms, startDateStr, slots, timetable, constraintConfig, holidays, currentMonth });
    downloadTextFile(`examflow-backup-${startDateStr}.json`, JSON.stringify(payload, null, 2), 'application/json');
    setFeedback({ type: 'success', text: 'Backup exported successfully.' });
    pushAuditEvent('backup-exported', `Backup for ${startDateStr}`);
  };

  const handleExportTimetableCsv = () => {
    if (!timetable || !timetable.length) {
      setFeedback({ type: 'error', text: 'Generate a timetable before exporting CSV.' });
      return;
    }

    const rows = [
      ['Date', 'Time', 'Rooms', 'Exam', 'Marks', 'Seat Use'].map(csvEscape).join(','),
      ...timetable.map(item => [
        item.slot.name,
        `${item.startTime} - ${item.endTime}`,
        item.rooms.map(room => room.name).join(' | '),
        item.exam.name,
        item.exam.marks,
        `${item.exam.students.length}/${item.totalCapacity}`,
      ].map(csvEscape).join(',')),
    ];

    downloadTextFile(`examflow-timetable-${startDateStr}.csv`, rows.join('\n'), 'text/csv');
    setFeedback({ type: 'success', text: 'Timetable CSV exported successfully.' });
    pushAuditEvent('csv-exported', `Rows: ${timetable.length}`);
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      applyWorkspacePayload(parsed, `file: ${file.name}`);
      setFeedback({ type: 'success', text: 'Backup imported successfully.' });
    } catch {
      setFeedback({ type: 'error', text: 'The selected file is not a valid ExamFlow backup.' });
    } finally {
      event.target.value = '';
    }
  };

  const handleSaveProfile = () => {
    const name = normalizeText(profileName);
    if (!name) {
      setFeedback({ type: 'error', text: 'Provide a profile name before saving.' });
      return;
    }

    const payload = buildExportPayload({ exams, rooms, startDateStr, slots, timetable, constraintConfig, holidays, currentMonth });
    const profile = { name, updatedAt: new Date().toISOString(), payload };

    setSavedProfiles(prev => {
      const withoutCurrent = prev.filter(item => item.name.toLowerCase() !== name.toLowerCase());
      return [profile, ...withoutCurrent].slice(0, 20);
    });

    setProfileName('');
    setFeedback({ type: 'success', text: `Profile "${name}" saved.` });
    pushAuditEvent('profile-saved', name);
  };

  const handleLoadProfile = (name) => {
    const target = savedProfiles.find(profile => profile.name === name);
    if (!target) {
      setFeedback({ type: 'error', text: 'Selected profile is no longer available.' });
      return;
    }

    try {
      applyWorkspacePayload(target.payload, `profile: ${name}`);
      setFeedback({ type: 'success', text: `Profile "${name}" loaded.` });
    } catch {
      setFeedback({ type: 'error', text: 'Could not load this profile.' });
    }
  };

  const handleDeleteProfile = (name) => {
    setSavedProfiles(prev => prev.filter(profile => profile.name !== name));
    setFeedback({ type: 'success', text: `Profile "${name}" deleted.` });
    pushAuditEvent('profile-deleted', name);
  };

  const handleClearAudit = () => {
    setAuditTrail([]);
    setFeedback({ type: 'success', text: 'Activity log cleared.' });
  };

  const handleResetWorkspace = () => {
    setExams(cloneDefaultExams());
    setRooms(cloneDefaultRooms());
    setStartDateStr(DEFAULT_START_DATE);
    setSlots(generateSlots(DEFAULT_START_DATE));
    setTimetable(null);
    setHolidays([]);
    setCurrentMonth(new Date(DEFAULT_MONTH));
    setConstraintConfig(cloneDefaultConstraints());
    setActiveTab('input');
    setFeedback({ type: 'success', text: 'Demo data restored.' });
    pushAuditEvent('workspace-reset', 'Demo data restored');

    if (typeof window !== 'undefined') {
      [
        'examflow.exams',
        'examflow.rooms',
        'examflow.startDateStr',
        'examflow.timetable',
        'examflow.constraints',
        'examflow.holidays',
        'examflow.currentMonth',
      ].forEach(key => window.localStorage.removeItem(key));
    }
  };

  const timetableConflicts = useMemo(() => {
    if (!timetable) return [];
    return detectConflicts(timetable, { ...constraintConfig, holidays });
  }, [timetable, constraintConfig, holidays]);

  const stats = useMemo(() => {
    const totalStudents = exams.reduce((sum, exam) => sum + exam.students.length, 0);
    const totalSeats = rooms.reduce((sum, room) => sum + room.capacity, 0);
    const scheduledDays = timetable ? new Set(timetable.map(item => item.slot.date)).size : 0;

    return [
      { label: 'Exams', value: exams.length, tone: 'primary', detail: `${filteredExams.length} visible` },
      { label: 'Rooms', value: rooms.length, tone: 'success', detail: `${totalSeats} total seats` },
      { label: 'Students', value: totalStudents, tone: 'accent', detail: 'Across all exams' },
      { label: 'Holidays', value: holidays.length, tone: 'danger', detail: timetable ? `${scheduledDays} days used` : 'Not scheduled yet' },
    ];
  }, [exams, filteredExams.length, rooms, holidays.length, timetable]);

  const handleGenerate = () => {
    setIsGenerating(true);
    setError(null);
    setFeedback(null);
    
    setTimeout(() => {
      const result = generateTimetable(exams, rooms, slots, { 
        ...constraintConfig,
        holidays: holidays 
      });
      if (result) {
        setTimetable(result);
        setActiveTab('output');
        setFeedback({ type: 'success', text: 'Timetable generated successfully.' });
        pushAuditEvent('timetable-generated', `Assignments: ${result.length}`);
      } else {
        setError('Could not generate a conflict-free timetable. Try adding more rooms or adjusting gaps.');
        pushAuditEvent('timetable-failed', 'Generation failed with current constraints');
      }
      setIsGenerating(false);
    }, 1500);
  };

  return (
    <div className={`app-container density-${density}`}>
      <nav className="sidebar glass-card">
        <div className="logo">
          <span className="icon">📅</span>
          <h1>ExamFlow</h1>
        </div>
        <ul className="nav-links">
          <li className={activeTab === 'input' ? 'active' : ''} onClick={() => setActiveTab('input')}>
            Setup Data
          </li>
          <li className={activeTab === 'calendar' ? 'active' : ''} onClick={() => setActiveTab('calendar')}>
            Calendar & Holi.
          </li>
          <li className={activeTab === 'output' ? 'active' : ''} onClick={() => setActiveTab('output')}>
            Visualizer
          </li>
        </ul>
        <div className="sidebar-footer">
          <button className="btn-primary w-full" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Generate Timetable'}
          </button>
        </div>
      </nav>

      <main className="content">
        <header className="top-bar hero-shell">
          <div className="header-info">
            <span className="eyebrow">ExamFlow scheduler</span>
            <h2>{activeTab === 'input' ? 'Configuration' : activeTab === 'calendar' ? 'Holiday Management' : 'Generated Timetable'}</h2>
            <p className="text-muted hero-copy">Automated backtracking scheduler with room grouping, holiday control, and browser-backed workspace storage.</p>
          </div>
          <div className="hero-actions-wrap">
            <div className="hero-actions">
              <button className="btn-secondary" onClick={() => setActiveTab('input')}>Setup</button>
              <button className="btn-secondary" onClick={() => setActiveTab('calendar')}>Calendar</button>
              <button className="btn-primary" onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? 'Generating...' : 'Run Engine'}
              </button>
            </div>
            <div className="pref-controls" aria-label="Visual preferences">
              <div className="pref-group" role="group" aria-label="Theme">
                <button
                  className={`pref-chip ${theme === 'dark' ? 'is-active' : ''}`}
                  onClick={() => setTheme('dark')}
                  aria-pressed={theme === 'dark'}
                >
                  Dark
                </button>
                <button
                  className={`pref-chip ${theme === 'light' ? 'is-active' : ''}`}
                  onClick={() => setTheme('light')}
                  aria-pressed={theme === 'light'}
                >
                  Light
                </button>
              </div>
              <div className="pref-group" role="group" aria-label="Density">
                <button
                  className={`pref-chip ${density === 'comfortable' ? 'is-active' : ''}`}
                  onClick={() => setDensity('comfortable')}
                  aria-pressed={density === 'comfortable'}
                >
                  Comfortable
                </button>
                <button
                  className={`pref-chip ${density === 'compact' ? 'is-active' : ''}`}
                  onClick={() => setDensity('compact')}
                  aria-pressed={density === 'compact'}
                >
                  Compact
                </button>
              </div>
            </div>
          </div>
        </header>

        <section className="stats-grid">
          {stats.map((stat, index) => (
            <article
              key={stat.label}
              className={`stat-card stat-${stat.tone} glass-card animate-in`}
              style={{ '--stagger-index': index }}
            >
              <span className="stat-label">{stat.label}</span>
              <strong className="stat-value">{stat.value}</strong>
              <span className="stat-detail">{stat.detail}</span>
            </article>
          ))}
        </section>

        {feedback && (
          <div className={`notice-banner ${feedback.type === 'error' ? 'notice-error' : feedback.type === 'success' ? 'notice-success' : 'notice-info'}`}>
            <span>{feedback.text}</span>
          </div>
        )}

        {activeTab === 'input' && (
          <section className="input-grid">
            <div className="card glass-card span-full session-config">
              <div className="section-header">
                <div>
                  <span className="section-kicker">Plan</span>
                  <h3>Session Configuration</h3>
                </div>
                <p className="text-muted small">Start date drives slot generation and automatically resets the current timetable.</p>
              </div>
              <div className="add-form">
                <div className="input-group">
                  <label>Exam Session Start Date:</label>
                  <input 
                    type="date" 
                    value={startDateStr} 
                    onChange={(e) => setStartDateStr(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="card glass-card span-full">
              <div className="section-header">
                <div>
                  <span className="section-kicker">Workspace</span>
                  <h3>Data Management</h3>
                </div>
                <p className="text-muted small">Autosaves to your browser and lets you export or restore the full workspace.</p>
              </div>
              <div className="action-row">
                <button className="btn-secondary" onClick={handleExportBackup}>Export Backup</button>
                <button className="btn-secondary" onClick={handleExportTimetableCsv} disabled={!timetable}>Export CSV</button>
                <button className="btn-secondary" onClick={handleImportClick}>Import Backup</button>
                <button className="btn-secondary" onClick={handleResetWorkspace}>Reset Demo Data</button>
                <input
                  ref={importInputRef}
                  className="visually-hidden"
                  type="file"
                  accept="application/json"
                  onChange={handleImportBackup}
                  aria-label="Import ExamFlow backup"
                />
              </div>

              <div className="profile-manager mt-10">
                <div className="section-header compact">
                  <div>
                    <span className="section-kicker">Profiles</span>
                    <h3>Named Workspace Snapshots</h3>
                  </div>
                </div>
                <div className="add-form">
                  <input
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    placeholder="Profile name (e.g. Midterm Plan A)"
                    aria-label="Profile name"
                  />
                  <button className="btn-secondary" onClick={handleSaveProfile}>Save Profile</button>
                </div>
                {savedProfiles.length ? (
                  <div className="list-container profile-list">
                    {savedProfiles.map(profile => (
                      <div key={profile.name} className="list-item">
                        <div className="profile-meta">
                          <strong>{profile.name}</strong>
                          <span className="text-muted small">Updated {formatDateTime(profile.updatedAt)}</span>
                        </div>
                        <div className="item-actions">
                          <button className="btn-secondary btn-small" onClick={() => handleLoadProfile(profile.name)}>Load</button>
                          <button className="btn-secondary btn-small" onClick={() => handleDeleteProfile(profile.name)}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted small">No saved profiles yet.</p>
                )}
              </div>
            </div>

            <div className="card glass-card span-full">
              <div className="section-header">
                <div>
                  <span className="section-kicker">Ops</span>
                  <h3>Activity Log</h3>
                </div>
                <button className="btn-secondary btn-small" onClick={handleClearAudit} disabled={!auditTrail.length}>Clear Log</button>
              </div>
              {auditTrail.length ? (
                <div className="audit-log">
                  {auditTrail.slice(0, 12).map(entry => (
                    <article key={entry.id} className="audit-item">
                      <div className="audit-meta">
                        <strong>{entry.event}</strong>
                        <span className="text-muted small">{formatDateTime(entry.timestamp)}</span>
                      </div>
                      <p>{entry.details}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-muted small">Events will appear here as you update data, generate timetables, and manage profiles.</p>
              )}
            </div>

            <div className="card glass-card">
              <div className="section-header compact">
                <div>
                  <span className="section-kicker">Input</span>
                  <h3>Exams ({filteredExams.length}/{exams.length})</h3>
                </div>
              </div>
              <div className="add-form">
                <input 
                  value={newExamName} 
                  onChange={(e) => setNewExamName(e.target.value)} 
                  placeholder="Exam Name (e.g. Physics)"
                />
                <select value={newExamMarks} onChange={(e) => setNewExamMarks(e.target.value)} className="w-20">
                  <option value={30}>30M</option>
                  <option value={60}>60M</option>
                </select>
                <button className="btn-secondary" onClick={addExam}>Add</button>
              </div>
              <input
                value={examSearch}
                onChange={(e) => setExamSearch(e.target.value)}
                placeholder="Search exams"
                aria-label="Search exams"
              />
              <div className="list-container mt-10">
                {filteredExams.map(e => (
                  <div key={e.id} className="list-item">
                    <span>{e.name}</span>
                    <div className="item-actions">
                      <span className="badge badge-success">{e.marks} Marks</span>
                      <button className="btn-icon" onClick={() => removeExam(e.id)} aria-label={`Remove ${e.name}`}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card glass-card">
              <div className="section-header compact">
                <div>
                  <span className="section-kicker">Capacity</span>
                  <h3>Rooms ({filteredRooms.length}/{rooms.length})</h3>
                </div>
              </div>
              <div className="add-form">
                <input 
                  value={newRoomName} 
                  onChange={(e) => setNewRoomName(e.target.value)} 
                  placeholder="Room (e.g. Hall 1)"
                />
                <input 
                  type="number" 
                  value={newRoomCap} 
                  onChange={(e) => setNewRoomCap(e.target.value)} 
                  className="w-20"
                />
                <button className="btn-secondary" onClick={addRoom}>Add</button>
              </div>
              <input
                value={roomSearch}
                onChange={(e) => setRoomSearch(e.target.value)}
                placeholder="Search rooms"
                aria-label="Search rooms"
              />
              <div className="list-container mt-10">
                {filteredRooms.map(r => (
                  <div key={r.id} className="list-item">
                    <span>{r.name}</span>
                    <div className="item-actions">
                      <span className="badge badge-success">Cap: {r.capacity}</span>
                      <button className="btn-icon" onClick={() => removeRoom(r.id)} aria-label={`Remove ${r.name}`}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card glass-card span-full">
              <div className="section-header">
                <div>
                  <span className="section-kicker">Rules</span>
                  <h3>Constraint Builder</h3>
                </div>
                <p className="text-muted small">These controls shape the generated timetable and can be tuned without leaving the page.</p>
              </div>
              <div className="constraints-grid">
                <label className="constraint-item">
                  <span>Enforce Capacity</span>
                  <input
                    type="checkbox"
                    checked={constraintConfig.checkCapacity}
                    onChange={(e) => updateConstraint('checkCapacity', e.target.checked)}
                  />
                </label>
                <label className="constraint-item">
                  <span>Single Exam Per Day</span>
                  <input
                    type="checkbox"
                    checked={constraintConfig.enforceSingleExamPerDay}
                    onChange={(e) => updateConstraint('enforceSingleExamPerDay', e.target.checked)}
                  />
                </label>
                <label className="constraint-item">
                  <span>Prevent Same-Day Student Clash</span>
                  <input
                    type="checkbox"
                    checked={constraintConfig.preventSameDayStudentConflict}
                    onChange={(e) => updateConstraint('preventSameDayStudentConflict', e.target.checked)}
                  />
                </label>
                <label className="constraint-item">
                  <span>Global Minimum Gap (days)</span>
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={constraintConfig.minGapDays}
                    onChange={(e) => updateConstraint('minGapDays', parseInt(e.target.value || '2', 10))}
                  />
                </label>
                <label className="constraint-item">
                  <span>Friday/Saturday Special Gap</span>
                  <input
                    type="checkbox"
                    checked={constraintConfig.enforceFridaySaturdayRule}
                    onChange={(e) => updateConstraint('enforceFridaySaturdayRule', e.target.checked)}
                  />
                </label>
                <label className="constraint-item">
                  <span>Friday/Saturday Gap (days)</span>
                  <input
                    type="number"
                    min={2}
                    max={7}
                    value={constraintConfig.fridaySaturdayMinGap}
                    onChange={(e) => updateConstraint('fridaySaturdayMinGap', parseInt(e.target.value || '3', 10))}
                  />
                </label>
                <label className="constraint-item">
                  <span>60-Mark Extra Gap</span>
                  <input
                    type="checkbox"
                    checked={constraintConfig.enforceSixtyMarkGap}
                    onChange={(e) => updateConstraint('enforceSixtyMarkGap', e.target.checked)}
                  />
                </label>
                <label className="constraint-item">
                  <span>60-Mark Gap (days)</span>
                  <input
                    type="number"
                    min={2}
                    max={7}
                    value={constraintConfig.sixtyMarkMinGap}
                    onChange={(e) => updateConstraint('sixtyMarkMinGap', parseInt(e.target.value || '3', 10))}
                  />
                </label>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'calendar' && (
          <section className="calendar-section">
            <CalendarGrid 
              holidays={holidays}
              onToggleHoliday={toggleHoliday}
              timetable={timetable}
              currentMonth={currentMonth}
              setCurrentMonth={setCurrentMonth}
            />
          </section>
        )}

        {activeTab === 'output' && (

          <section className="output-section">
            {error ? (
              <div className="error-card glass-card">
                <p>{error}</p>
                <button className="btn-secondary mt-10" onClick={() => setActiveTab('input')}>Adjust Constraints</button>
              </div>
            ) : timetable ? (
              <div>
                <div className="section-header output-header">
                  <div>
                    <span className="section-kicker">Result</span>
                    <h3>Generated timetable</h3>
                  </div>
                  <div className="output-actions">
                    <button className="btn-secondary" onClick={handleExportBackup}>Export Backup</button>
                    <button className="btn-secondary" onClick={handleExportTimetableCsv}>Export CSV</button>
                  </div>
                </div>

                <div className={`status-card glass-card ${timetableConflicts.length ? 'status-fail' : 'status-pass'}`}>
                  <h3>{timetableConflicts.length ? 'Conflict Detection: Issues Found' : 'Conflict Detection: Passed'}</h3>
                  <p>
                    {timetableConflicts.length
                      ? `${timetableConflicts.length} conflict checks failed. Tighten constraints or increase slots/rooms.`
                      : 'No room overlap, no capacity shortage, and no configured rule violations found.'}
                  </p>
                </div>

                <div className="grid-container glass-card mt-10">
                <table className="timetable-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time & Duration</th>
                      <th>Rooms</th>
                      <th>Exam</th>
                      <th>Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timetable.map((item, idx) => (
                      <tr key={idx} className="fade-in" style={{ animationDelay: `${idx * 0.1}s` }}>
                        <td>
                          <div className="slot-pill">
                            <strong>{item.slot.name}</strong>
                          </div>
                        </td>
                        <td>
                          <div className="time-info">
                            <strong>{item.startTime} - {item.endTime}</strong>
                            <span>({item.duration})</span>
                          </div>
                        </td>
                        <td>
                          <div className="rooms-cell">
                            <span className="rooms-title">{`Rooms (${item.rooms.length})`}</span>
                            <div className="room-chip-list">
                              {item.rooms.map(room => (
                                <span key={room.id} className="room-chip">{room.name}</span>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="exam-name">{item.exam.name}</td>
                        <td>
                          <span className="badge badge-success">{item.exam.marks}</span>
                          <div className="capacity-meta">{`Seat Use: ${item.exam.students.length}/${item.totalCapacity}`}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>Run the engine to see results.</p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;

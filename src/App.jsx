import React, { useState, useEffect, useMemo } from 'react';
import { generateTimetable } from './utils/scheduler';
import { detectConflicts } from './utils/conflictDetector';
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

import CalendarGrid from './components/CalendarGrid';

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

const INITIAL_SLOTS = generateSlots('2026-05-04');


function App() {
  const [exams, setExams] = useState(INITIAL_EXAMS);
  const [rooms, setRooms] = useState(INITIAL_ROOMS);
  const [startDateStr, setStartDateStr] = useState('2026-05-04');
  const [slots, setSlots] = useState(generateSlots('2026-05-04'));
  const [timetable, setTimetable] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('input');
  const [error, setError] = useState(null);
  const [constraintConfig, setConstraintConfig] = useState({
    checkCapacity: true,
    enforceSingleExamPerDay: true,
    minGapDays: 2,
    enforceFridaySaturdayRule: true,
    fridaySaturdayMinGap: 3,
    enforceSixtyMarkGap: true,
    sixtyMarkMinGap: 3,
    preventSameDayStudentConflict: true,
  });

  useEffect(() => {
    setSlots(generateSlots(startDateStr));
  }, [startDateStr]);

  // New State for Calendar & Holidays
  const [holidays, setHolidays] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date('2026-05-01'));

  // New Input States
  const [newExamName, setNewExamName] = useState('');
  const [newExamMarks, setNewExamMarks] = useState(30);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCap, setNewRoomCap] = useState(35);

  const toggleHoliday = (dateStr) => {
    setHolidays(prev => 
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    );
  };

  const addExam = () => {
    if (!newExamName) return;
    const newExam = {
      id: Date.now().toString(),
      name: newExamName,
      students: MOCK_STUDENTS,
      marks: parseInt(newExamMarks)
    };
    setExams([...exams, newExam]);
    setNewExamName('');
  };

  const addRoom = () => {
    if (!newRoomName) return;
    const newRoom = {
      id: 'R' + Date.now(),
      name: newRoomName,
      capacity: parseInt(newRoomCap)
    };
    setRooms([...rooms, newRoom]);
    setNewRoomName('');
    setNewRoomCap(35);
  };

  const removeExam = (id) => setExams(exams.filter(e => e.id !== id));
  const removeRoom = (id) => setRooms(rooms.filter(r => r.id !== id));

  const updateConstraint = (key, value) => {
    setConstraintConfig(prev => ({ ...prev, [key]: value }));
  };

  const timetableConflicts = useMemo(() => {
    if (!timetable) return [];
    return detectConflicts(timetable, { ...constraintConfig, holidays });
  }, [timetable, constraintConfig, holidays]);

  const handleGenerate = () => {
    setIsGenerating(true);
    setError(null);
    
    setTimeout(() => {
      const result = generateTimetable(exams, rooms, slots, { 
        ...constraintConfig,
        holidays: holidays 
      });
      if (result) {
        setTimetable(result);
        setActiveTab('output');
      } else {
        setError('Could not generate a conflict-free timetable. Try adding more rooms or adjusting gaps.');
      }
      setIsGenerating(false);
    }, 1500);
  };

  return (
    <div className="app-container">
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
            {isGenerating ? 'Generating...' : 'Run Engine'}
          </button>
        </div>
      </nav>

      <main className="content">
        <header className="top-bar">
          <div className="header-info">
            <h2>{activeTab === 'input' ? 'Configuration' : activeTab === 'calendar' ? 'Holiday Management' : 'Generated Timetable'}</h2>
            <p className="text-muted">Automated Backtracking Scheduler v6.0 (Multi-Room)</p>
          </div>
        </header>

        {activeTab === 'input' && (
          <section className="input-grid">
            <div className="card glass-card span-full session-config">
              <h3>🗓️ Session Configuration</h3>
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

            <div className="card glass-card">
              <h3>Exams ({exams.length})</h3>
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
              <div className="list-container mt-10">
                {exams.map(e => (
                  <div key={e.id} className="list-item">
                    <span>{e.name}</span>
                    <div className="item-actions">
                      <span className="badge badge-success">{e.marks} Marks</span>
                      <button className="btn-icon" onClick={() => removeExam(e.id)}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card glass-card">
              <h3>Rooms ({rooms.length})</h3>
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
              <div className="list-container mt-10">
                {rooms.map(r => (
                  <div key={r.id} className="list-item">
                    <span>{r.name}</span>
                    <div className="item-actions">
                      <span className="badge badge-success">Cap: {r.capacity}</span>
                      <button className="btn-icon" onClick={() => removeRoom(r.id)}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card glass-card span-full">
              <h3>Constraint Builder</h3>
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

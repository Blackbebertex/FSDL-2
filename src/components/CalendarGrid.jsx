import React from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isSunday } from 'date-fns';

const CalendarGrid = ({ holidays, onToggleHoliday, timetable, currentMonth, setCurrentMonth }) => {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const getExamForDate = (date) => {
    return timetable?.find(a => isSameDay(new Date(a.slot.date), date));
  };

  return (
    <div className="calendar-card glass-card">
      <div className="calendar-header">
        <button className="btn-icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>&lt;</button>
        <h3>{format(currentMonth, 'MMMM yyyy')}</h3>
        <button className="btn-icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>&gt;</button>
      </div>

      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="weekday-label">{d}</div>
        ))}
        {days.map((day, idx) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isHoliday = holidays.includes(dateStr) || isSunday(day);
          const exam = getExamForDate(day);
          const isCurrentMonth = isSameMonth(day, monthStart);

          return (
            <div 
              key={idx} 
              className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isHoliday ? 'is-holiday' : ''} ${exam ? 'has-exam' : ''}`}
              onClick={() => isCurrentMonth && onToggleHoliday(dateStr)}
            >
              <span className="day-number">{format(day, 'd')}</span>
              {exam && (
                <div className="exam-tag">
                  <span className="exam-code">{exam.exam.name.split(':')[0]}</span>
                  <span className="exam-room">{`${exam.rooms.length} rooms`}</span>
                </div>
              )}
              {isHoliday && !exam && <span className="holiday-label">Holiday</span>}
            </div>
          );
        })}
      </div>
      <div className="calendar-footer">
        <p className="text-muted small">Click any date to toggle it as a Holiday. Sundays are holidays by default.</p>
      </div>
    </div>
  );
};

export default CalendarGrid;

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
    <div className="calendar-card glass-card calendar-shell">
      <div className="calendar-header">
        <div>
          <span className="section-kicker">Calendar</span>
          <h3>{format(currentMonth, 'MMMM yyyy')}</h3>
        </div>
        <div className="hero-actions">
          <button className="btn-icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label="Previous month">&lt;</button>
          <button className="btn-icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} aria-label="Next month">&gt;</button>
        </div>
      </div>

      <div className="calendar-legend" aria-label="Calendar legend">
        <span className="legend-item"><span className="legend-swatch exam" /> Exam day</span>
        <span className="legend-item"><span className="legend-swatch holiday" /> Holiday</span>
        <span className="legend-item"><span className="legend-swatch normal" /> Normal day</span>
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
              role={isCurrentMonth ? 'button' : undefined}
              tabIndex={isCurrentMonth ? 0 : -1}
              onKeyDown={(event) => {
                if (!isCurrentMonth) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onToggleHoliday(dateStr);
                }
              }}
              aria-label={`${format(day, 'EEEE, MMMM d')}${isHoliday ? ', holiday' : ''}${exam ? ', exam scheduled' : ''}`}
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
        <p className="text-muted small">Click any current-month date to toggle a holiday. Sundays stay highlighted automatically.</p>
      </div>
    </div>
  );
};

export default CalendarGrid;

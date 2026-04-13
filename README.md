# Automated Exam Timetable Generator

This project generates a conflict-free university exam timetable using a backtracking engine with multi-room distribution support.

## Faculty Requirement Coverage

1. Input and Constraint Builder

- UI for adding/removing exams and rooms.
- Session start date and holiday selection.
- Explicit constraint builder with toggles and numeric inputs.
- File: src/App.jsx

1. Backtracking Scheduling Engine

- Recursive exam-slot assignment.
- Multi-room allocation per exam in the same slot.
- Capacity-aware room grouping.
- File: src/utils/scheduler.js

1. Conflict Detection Module

- Dedicated conflict checker for room overlaps, student overlaps, capacity shortages, and rule violations.
- Used by scheduler and UI status panel.
- File: src/utils/conflictDetector.js

1. Timetable Visualization

- Interactive visualizer table.
- Room chips, seat usage metadata, and conflict-status card.
- Calendar highlights exam days and room counts.
- Files: src/App.jsx, src/components/CalendarGrid.jsx

## Multi-Room Model (v6)

- Each exam can use multiple classrooms simultaneously.
- Rooms are picked until combined capacity meets student count.
- With 12 rooms of capacity 35, a 400-student exam uses all 12 rooms.

## Run

```bash
npm install
npm run dev
```

## Validation

```bash
npm run build
node test_scheduler.js
```

The test script checks:

- timetable generation success,
- expected high room usage for 400 students,
- no same-day room overlap,
- conflict detector returning zero conflicts.

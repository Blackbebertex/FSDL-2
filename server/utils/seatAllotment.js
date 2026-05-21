const sortStudents = (students = []) => [...students].sort((a, b) => String(a).localeCompare(String(b)));

export const buildSeatPlanForEntry = (entry) => {
  const students = sortStudents(entry?.exam?.students || []);
  const roomAssignments = [];
  let cursor = 0;

  for (const room of entry.rooms || []) {
    const cap = Number(room.capacity) || 0;
    const allocated = students.slice(cursor, cursor + cap);
    cursor += cap;
    roomAssignments.push({
      roomId: room.id,
      roomName: room.name,
      students: allocated,
    });

    if (cursor >= students.length) {
      break;
    }
  }

  const studentRows = roomAssignments.flatMap((room) => room.students.map((student) => ({
    student,
    examId: entry.exam.id,
    examName: entry.exam.name,
    slotId: entry.slot.id,
    slotName: entry.slot.name,
    roomId: room.roomId,
    roomName: room.roomName,
  })));

  return {
    examId: entry.exam.id,
    examName: entry.exam.name,
    slotId: entry.slot.id,
    slotName: entry.slot.name,
    rooms: roomAssignments,
    students: studentRows,
  };
};

export const buildSeatPlan = (timetable = []) => {
  const byExam = timetable.map(buildSeatPlanForEntry);

  const roomWise = {};
  const studentWise = {};

  for (const examEntry of byExam) {
    for (const studentRow of examEntry.students) {
      if (!roomWise[studentRow.roomName]) {
        roomWise[studentRow.roomName] = [];
      }
      roomWise[studentRow.roomName].push(studentRow);

      if (!studentWise[studentRow.student]) {
        studentWise[studentRow.student] = [];
      }
      studentWise[studentRow.student].push(studentRow);
    }
  }

  return {
    byExam,
    roomWise,
    studentWise,
  };
};

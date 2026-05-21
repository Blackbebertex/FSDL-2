import React from 'react';

function PinLockEntry({
  exam,
  slots,
  rooms,
  lockedAssignments,
  canEdit,
  onPin,
  onClearPin,
  onSelectAllRooms,
  onClearRooms,
  onToggleRoom,
}) {
  const currentLock = lockedAssignments.find((item) => item.examId === exam.id);

  return (
    <div className="list-item">
      <div className="display-grid gap-2 w-full">
        <strong>{exam.name}</strong>
        <div className="display-flex gap-3 flex-wrap">
          <select
            disabled={!canEdit}
            value={currentLock?.slotId || ''}
            onChange={(e) => onPin(exam.id, e.target.value)}
          >
            <option value="">No lock</option>
            {slots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.name}
              </option>
            ))}
          </select>
          <button
            className="btn-secondary btn-small"
            disabled={!canEdit}
            onClick={() => onClearPin(exam.id)}
          >
            Clear
          </button>
        </div>

        {currentLock?.slotId ? (
          <div className="display-flex gap-2 flex-wrap">
            <button
              className="btn-secondary btn-small"
              disabled={!canEdit || rooms.length === 0}
              onClick={() => onSelectAllRooms(exam.id)}
            >
              Select All Rooms
            </button>
            <button
              className="btn-secondary btn-small"
              disabled={!canEdit}
              onClick={() => onClearRooms(exam.id)}
            >
              Clear Rooms
            </button>
            {rooms.map((room) => {
              const selectedRoomIds = currentLock?.roomIds || [];
              const checked = selectedRoomIds.includes(room.id);
              return (
                <label
                  key={`${exam.id}-${room.id}`}
                  className="badge align-center display-flex gap-2"
                >
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={checked}
                    onChange={(event) => onToggleRoom(exam.id, room.id, event.target.checked)}
                  />
                  {room.name}
                </label>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default PinLockEntry;

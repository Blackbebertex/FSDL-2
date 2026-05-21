import React from 'react';

function ModalDialog({
  title,
  children,
  onCancel,
  onConfirm,
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  size = 'md', // sm, md, lg
  hideActions = false,
}) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`modal-dialog glass-card ${size}`}>
        {title && <h3>{title}</h3>}
        <div className="modal-body">{children}</div>
        {!hideActions && (
          <div className="action-row mt-10">
            <button className="btn-secondary" onClick={onCancel}>{cancelLabel}</button>
            <button className="btn-primary" onClick={onConfirm}>{confirmLabel}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ModalDialog;

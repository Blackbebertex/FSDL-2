import React from 'react';

function ListBlock({ title, subtitle, className = '', toolbar = null, children }) {
  return (
    <article className={`card glass-card ${className}`.trim()}>
      <div className="section-header compact">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p className="text-muted small">{subtitle}</p> : null}
        </div>
        {toolbar}
      </div>
      {children}
    </article>
  );
}

export default ListBlock;

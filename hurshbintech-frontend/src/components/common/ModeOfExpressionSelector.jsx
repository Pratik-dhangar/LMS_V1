import React from 'react';

const MODE_OPTIONS = [
  'Identify',
  'Point',
  'Show',
  'Vocalize',
  'Name',
  'Sign',
  'Communicate',
  'Write',
  'Type',
];

const ModeOfExpressionSelector = ({ value = [], onChange, readOnly = false }) => {
  const selectedValues = Array.isArray(value) ? value : [];

  const toggleValue = (mode) => {
    if (readOnly) return;
    const nextValues = selectedValues.includes(mode)
      ? selectedValues.filter((item) => item !== mode)
      : [...selectedValues, mode];
    onChange?.(nextValues);
  };

  return (
    <div className="modern-form-section" >
      <label className="modern-form-section-title">Mode of Expression</label>
      <p className="form-helper-text" style={{ marginBottom: '0.75rem' }}>
        Select one or more modes for this session.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {MODE_OPTIONS.map((mode) => {
          const selected = selectedValues.includes(mode);

          return (
            <button
              key={mode}
              type="button"
              onClick={() => toggleValue(mode)}
              disabled={readOnly}
              className={`app-modal-btn ${selected ? 'app-modal-btn--primary' : 'app-modal-btn--secondary'}`}
              style={{
                borderRadius: '9999px',
                padding: '0.45rem 0.9rem',
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                opacity: readOnly ? 0.9 : 1,
              }}
              aria-pressed={selected}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '9999px',
                  border: '2px solid currentColor',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                }}
              >
                {selected && (
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '9999px',
                      backgroundColor: 'currentColor',
                      display: 'inline-block',
                    }}
                  />
                )}
              </span>
              <span>{mode}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ModeOfExpressionSelector;
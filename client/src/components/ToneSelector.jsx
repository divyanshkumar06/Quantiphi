import React from "react";

export default function ToneSelector({ tone, onToneChange, disabled }) {
  const tones = ["Professional", "Casual", "Concise"];

  return (
    <div className="tone-selector">
      <span className="tone-label">Tone:</span>
      <div className="tone-options">
        {tones.map((t) => (
          <button
            key={t}
            type="button"
            className={`tone-btn ${tone === t ? "active" : ""}`}
            onClick={() => onToneChange(t)}
            disabled={disabled}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

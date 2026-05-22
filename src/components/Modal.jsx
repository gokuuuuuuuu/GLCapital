import React from "react";

export default function Modal() {
  return (
    <div className="modal-overlay" id="modalOverlay">
      <div className="modal" id="modal">
        <div className="modal-header">
          <div className="modal-title" id="modalTitle">
            Modal
          </div>
          <button className="modal-close">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div id="modalBody"></div>
      </div>
    </div>
  );
}

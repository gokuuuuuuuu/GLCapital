import React from "react";
import { s } from "../utils/parseStyle";

export default function RejectModal() {
  return (
    <div
      id="rejectModal"
      style={s(
        "display:none;position:fixed;inset:0;z-index:3000;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);backdrop-filter:blur(4px)",
      )}
    >
      <div
        style={s(
          "background:#fff;border-radius:16px;padding:28px 28px 24px;width:min(480px,90vw);box-shadow:0 24px 60px rgba(0,0,0,0.18)",
        )}
      >
        <div
          style={s(
            "display:flex;align-items:center;justify-content:space-between;margin-bottom:18px",
          )}
        >
          <div
            style={s("font-size:16px;font-weight:700;color:var(--header)")}
            id="rejectModalTitle"
          >
            Reject Submission
          </div>
          <button
            id="rejectModalCloseBtn"
            style={s(
              "background:none;border:none;cursor:pointer;color:var(--muted);font-size:20px;line-height:1;padding:0 4px",
            )}
          >
            {"\u00D7"}
          </button>
        </div>
        <div style={s("font-size:13px;color:var(--muted);margin-bottom:12px")}>
          Please provide a reason for rejection. This note will be visible to
          the underwriter.
        </div>
        <textarea
          id="rejectNoteInput"
          rows="4"
          placeholder="e.g. DSCR below fund floor of 1.40\u00D7. Resubmit if seller reduces ask or leverage can be restructured."
          style={s(
            "width:100%;box-sizing:border-box;font-family:inherit;font-size:13px;padding:10px 12px;border:1.5px solid #e0dbd4;border-radius:8px;resize:vertical;background:rgba(248,246,242,0.8);color:var(--body);outline:none",
          )}
        ></textarea>
        <div
          style={s(
            "display:flex;gap:10px;justify-content:flex-end;margin-top:16px",
          )}
        >
          <button id="rejectModalCancelBtn" className="btn btn-ghost">
            Cancel
          </button>
          <button
            id="rejectModalConfirmBtn"
            className="btn btn-primary"
            style={s("background:#c0392b;border-color:#c0392b")}
          >
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  );
}

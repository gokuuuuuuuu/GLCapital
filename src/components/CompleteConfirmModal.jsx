import React from "react";
import { s } from "../utils/parseStyle";

export default function CompleteConfirmModal() {
  return (
    <div
      id="completeConfirmOverlay"
      style={s(
        "display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1200;align-items:center;justify-content:center;backdrop-filter:blur(4px)",
      )}
    >
      <div
        style={s(
          "background:var(--surface);backdrop-filter:blur(24px) saturate(180%);border:1px solid var(--border);border-radius:16px;padding:32px 28px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.25)",
        )}
      >
        <div
          style={s(
            "display:flex;align-items:flex-start;gap:14px;margin-bottom:20px",
          )}
        >
          <div
            style={s(
              "flex-shrink:0;width:40px;height:40px;border-radius:10px;background:rgba(74,124,89,0.12);display:flex;align-items:center;justify-content:center",
            )}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--green)"
              strokeWidth="2"
              style={s("width:20px;height:20px")}
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div>
            <div
              style={s(
                "font-size:15px;font-weight:800;color:var(--header);margin-bottom:4px",
              )}
            >
              Mark Project as Complete?
            </div>
            <div style={s("font-size:12px;color:var(--muted);line-height:1.6")}>
              This action is{" "}
              <strong style={s("color:var(--header)")}>permanent</strong> and
              cannot be undone. Once marked complete, the project status will be
              locked and can only be changed by an administrator.
            </div>
          </div>
        </div>
        <div
          style={s(
            "background:rgba(139,106,46,0.07);border:1px solid rgba(139,106,46,0.2);border-radius:8px;padding:10px 14px;margin-bottom:20px;font-size:11px;color:var(--accent);display:flex;align-items:center;gap:8px",
          )}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={s("width:14px;height:14px;flex-shrink:0")}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Underwriters cannot revert a completed project. Please confirm this
          submission is finalized.
        </div>
        <div style={s("display:flex;gap:10px;justify-content:flex-end")}>
          <button
            id="completeConfirmCancelBtn"
            className="btn btn-ghost btn-sm"
          >
            Cancel
          </button>
          <button
            id="completeConfirmBtn"
            style={s(
              "background:var(--green);color:#fff;border:none;padding:8px 20px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit",
            )}
          >
            Yes, Mark Complete
          </button>
        </div>
      </div>
    </div>
  );
}

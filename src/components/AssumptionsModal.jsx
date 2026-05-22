import React from "react";
import { s } from "../utils/parseStyle";

export default function AssumptionsModal() {
  return (
    <div
      id="assumptionsOverlay"
      style={s(
        "display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1100;align-items:center;justify-content:center;backdrop-filter:blur(4px)",
      )}
    >
      <div
        style={s(
          "background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,0.22);width:520px;max-width:94vw;overflow:hidden",
        )}
      >
        {/* Header */}
        <div
          style={s(
            "background:rgba(74,124,89,0.12);border-bottom:1px solid rgba(74,124,89,0.2);padding:16px 20px;display:flex;align-items:center;justify-content:space-between",
          )}
        >
          <div style={s("display:flex;align-items:center;gap:10px")}>
            <div
              style={s(
                "width:32px;height:32px;border-radius:8px;background:rgba(74,124,89,0.15);display:flex;align-items:center;justify-content:center",
              )}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--green)"
                strokeWidth="2"
                style={s("width:16px;height:16px")}
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" />
              </svg>
            </div>
            <div>
              <div
                style={s("font-size:14px;font-weight:700;color:var(--header)")}
              >
                Growth Assumptions
              </div>
              <div style={s("font-size:11px;color:var(--muted)")}>
                Applied to projected years (NOV2026{"\u2013"}OCT2030)
              </div>
            </div>
          </div>
          <button
            id="assumptionsCloseBtn"
            style={s(
              "background:none;border:none;cursor:pointer;color:var(--muted);padding:4px;border-radius:6px;line-height:0",
            )}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={s("width:16px;height:16px")}
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div
          style={s(
            "padding:20px 24px;display:flex;flex-direction:column;gap:20px",
          )}
        >
          {/* DEAL TIMING section */}
          <div>
            <div
              style={s(
                "font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#1565C0;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(21,101,192,0.18)",
              )}
            >
              Deal Timing
            </div>
            <div
              style={s(
                "display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(0,0,0,0.025);border-radius:8px;border:1px solid var(--border)",
              )}
            >
              <div>
                <label
                  style={s("font-size:13px;color:var(--body)")}
                  htmlFor="asmtAcquisitionYear"
                >
                  Acquisition Year
                </label>
                <div
                  style={s(
                    "font-size:10.5px;color:var(--muted);margin-top:2px",
                  )}
                >
                  Year of closing. Drives the time axis (AY{"\u2212"}2, AY
                  {"\u2212"}1, AY [Stab], AY+1 {"..."} AY+4) and Stab year
                  marker.
                </div>
              </div>
              <div
                style={s(
                  "display:flex;align-items:center;gap:0;border:1.5px solid rgba(21,101,192,0.4);border-radius:7px;overflow:hidden;background:rgba(21,101,192,0.06)",
                )}
              >
                <input
                  id="asmtAcquisitionYear"
                  type="number"
                  step="1"
                  min="2000"
                  max="2050"
                  defaultValue="2026"
                  style={s(
                    "width:84px;border:none;outline:none;background:transparent;padding:6px 10px;font-size:13px;font-weight:700;color:var(--header);text-align:right",
                  )}
                />
              </div>
            </div>
          </div>

          {/* INCOME section */}
          <div>
            <div
              style={s(
                "font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:var(--green);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(74,124,89,0.18)",
              )}
            >
              Income
            </div>
            <div
              style={s(
                "display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(0,0,0,0.025);border-radius:8px;border:1px solid var(--border)",
              )}
            >
              <label
                style={s("font-size:13px;color:var(--body)")}
                htmlFor="asmtRentGrowth"
              >
                Residential market annual rent growth
              </label>
              <div
                style={s(
                  "display:flex;align-items:center;gap:0;border:1.5px solid rgba(74,124,89,0.4);border-radius:7px;overflow:hidden;background:rgba(255,237,213,0.4)",
                )}
              >
                <input
                  id="asmtRentGrowth"
                  type="number"
                  step="0.001"
                  min="0"
                  max="50"
                  defaultValue="3.000"
                  style={s(
                    "width:78px;border:none;outline:none;background:transparent;padding:6px 6px 6px 10px;font-size:13px;font-weight:700;color:var(--header);text-align:right",
                  )}
                />
                <span
                  style={s(
                    "padding:6px 10px 6px 4px;font-size:13px;font-weight:600;color:var(--muted)",
                  )}
                >
                  %
                </span>
              </div>
            </div>
          </div>

          {/* EXPENSES section */}
          <div>
            <div
              style={s(
                "font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:var(--green);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(74,124,89,0.18)",
              )}
            >
              Expenses
            </div>
            <div style={s("display:flex;flex-direction:column;gap:8px")}>
              <div
                style={s(
                  "display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(0,0,0,0.025);border-radius:8px;border:1px solid var(--border)",
                )}
              >
                <label
                  style={s("font-size:13px;color:var(--body)")}
                  htmlFor="asmtOpexGrowth"
                >
                  Operating expenses growth rate
                </label>
                <div
                  style={s(
                    "display:flex;align-items:center;gap:0;border:1.5px solid rgba(74,124,89,0.4);border-radius:7px;overflow:hidden;background:rgba(255,237,213,0.4)",
                  )}
                >
                  <input
                    id="asmtOpexGrowth"
                    type="number"
                    step="0.001"
                    min="0"
                    max="50"
                    defaultValue="3.000"
                    style={s(
                      "width:78px;border:none;outline:none;background:transparent;padding:6px 6px 6px 10px;font-size:13px;font-weight:700;color:var(--header);text-align:right",
                    )}
                  />
                  <span
                    style={s(
                      "padding:6px 10px 6px 4px;font-size:13px;font-weight:600;color:var(--muted)",
                    )}
                  >
                    %
                  </span>
                </div>
              </div>
              <div
                style={s(
                  "display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(0,0,0,0.025);border-radius:8px;border:1px solid var(--border)",
                )}
              >
                <label
                  style={s("font-size:13px;color:var(--body)")}
                  htmlFor="asmtTaxGrowth"
                >
                  Property taxes growth rate
                </label>
                <div
                  style={s(
                    "display:flex;align-items:center;gap:0;border:1.5px solid rgba(74,124,89,0.4);border-radius:7px;overflow:hidden;background:rgba(255,237,213,0.4)",
                  )}
                >
                  <input
                    id="asmtTaxGrowth"
                    type="number"
                    step="0.001"
                    min="0"
                    max="50"
                    defaultValue="3.000"
                    style={s(
                      "width:78px;border:none;outline:none;background:transparent;padding:6px 6px 6px 10px;font-size:13px;font-weight:700;color:var(--header);text-align:right",
                    )}
                  />
                  <span
                    style={s(
                      "padding:6px 10px 6px 4px;font-size:13px;font-weight:600;color:var(--muted)",
                    )}
                  >
                    %
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Note */}
          <div
            style={s(
              "font-size:11px;color:var(--muted);background:rgba(74,124,89,0.06);border:1px solid rgba(74,124,89,0.14);padding:8px 12px;border-radius:7px;line-height:1.6",
            )}
          >
            <strong style={s("color:var(--green)")}>Note:</strong> These rates
            apply to years NOV2026{"\u2013"}OCT2030 (projection zone).
            Historical years NOV2023{"\u2013"}OCT2026 are sourced from actual
            data and are not affected.
          </div>
        </div>

        {/* Footer */}
        <div
          style={s(
            "padding:14px 24px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;background:rgba(0,0,0,0.02)",
          )}
        >
          <button id="assumptionsCancelBtn" className="btn btn-ghost btn-sm">
            Cancel
          </button>
          <button
            id="assumptionsSaveBtn"
            className="btn btn-primary btn-sm"
            style={s("min-width:110px")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={s("width:12px;height:12px")}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {"\u00A0"}Save {"&"} Recalculate
          </button>
        </div>
      </div>
    </div>
  );
}

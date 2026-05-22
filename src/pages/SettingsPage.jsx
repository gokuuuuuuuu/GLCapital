import React from "react";
import { s } from "../utils/parseStyle";

export default function SettingsPage() {
  return (
    <div id="page-settings" className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">API configuration</div>
        </div>
      </div>
      <div className="card" style={s("max-width:520px")}>
        <div className="section-title" style={s("margin-bottom:var(--gap)")}>
          API Integrations
        </div>

        {/* RentCast */}
        <div className="form-group" style={s("margin-bottom:6px")}>
          <label
            className="form-label"
            style={s(
              "display:flex;align-items:center;justify-content:space-between",
            )}
          >
            <span>RentCast API Key</span>
            <span
              id="rc-status"
              style={s("font-size:11px;font-weight:500;display:none")}
            ></span>
          </label>
          <div style={s("display:flex;gap:8px;align-items:center")}>
            <input
              id="key-rentcast"
              className="form-input"
              type="password"
              placeholder="rc_live_xxxxxxxxxxxx"
              defaultValue="rc_live_demo_key"
              onInput={() => window.clearApiStatus("rc")}
              style={s("flex:1;transition:border-color 0.2s")}
            />
            <button
              className="btn btn-sm btn-secondary"
              style={s("white-space:nowrap;min-width:64px")}
              id="rc-btn"
            >
              Verify
            </button>
          </div>
          <div
            id="rc-msg"
            style={s(
              "font-size:11px;margin-top:5px;display:none;padding:6px 10px;border-radius:6px",
            )}
          ></div>
        </div>

        {/* ATTOM */}
        <div className="form-group" style={s("margin-bottom:6px")}>
          <label
            className="form-label"
            style={s(
              "display:flex;align-items:center;justify-content:space-between",
            )}
          >
            <span>ATTOM Data API Key</span>
            <span
              id="attom-status"
              style={s("font-size:11px;font-weight:500;display:none")}
            ></span>
          </label>
          <div style={s("display:flex;gap:8px;align-items:center")}>
            <input
              id="key-attom"
              className="form-input"
              type="password"
              placeholder="attom_xxxxxxxxxxxx"
              defaultValue=""
              onInput={() => window.clearApiStatus("attom")}
              style={s("flex:1;transition:border-color 0.2s")}
            />
            <button
              className="btn btn-sm btn-secondary"
              style={s("white-space:nowrap;min-width:64px")}
              id="attom-btn"
            >
              Verify
            </button>
          </div>
          <div
            id="attom-msg"
            style={s(
              "font-size:11px;margin-top:5px;display:none;padding:6px 10px;border-radius:6px",
            )}
          ></div>
        </div>

        {/* HelloData */}
        <div className="form-group" style={s("margin-bottom:20px")}>
          <label
            className="form-label"
            style={s(
              "display:flex;align-items:center;justify-content:space-between",
            )}
          >
            <span>HelloData API Key</span>
            <span
              id="hd-status"
              style={s("font-size:11px;font-weight:500;display:none")}
            ></span>
          </label>
          <div style={s("display:flex;gap:8px;align-items:center")}>
            <input
              id="key-hellodata"
              className="form-input"
              type="password"
              placeholder="hd_live_xxxxxxxxxxxx"
              defaultValue=""
              onInput={() => window.clearApiStatus("hd")}
              style={s("flex:1;transition:border-color 0.2s")}
            />
            <button
              className="btn btn-sm btn-secondary"
              style={s("white-space:nowrap;min-width:64px")}
              id="hd-btn"
            >
              Verify
            </button>
          </div>
          <div
            id="hd-msg"
            style={s(
              "font-size:11px;margin-top:5px;display:none;padding:6px 10px;border-radius:6px",
            )}
          ></div>
        </div>

        <div style={s("display:flex;flex-direction:column;gap:10px")}>
          <div
            id="save-error-banner"
            style={s(
              "display:none;align-items:center;gap:10px;padding:11px 14px;background:rgba(192,57,43,0.07);border:1.5px solid rgba(192,57,43,0.35);border-radius:8px;color:#9b2335",
            )}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={s("flex-shrink:0")}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span
              id="save-hint"
              style={s("font-size:13px;font-weight:600")}
            ></span>
          </div>
          <button
            className="btn btn-primary"
            id="saveKeysBtn"
            style={s("align-self:flex-start")}
          >
            Save Keys
          </button>
        </div>
      </div>
    </div>
  );
}

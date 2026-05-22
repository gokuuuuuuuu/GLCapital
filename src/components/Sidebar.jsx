import React from "react";
import { s } from "../utils/parseStyle";

export default function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <div className="logo-text">GL Capital</div>
            <div className="logo-sub">Underwriting Platform</div>
          </div>
        </div>
      </div>

      <div className="sidebar-nav">
        {/* Underwriting (collapsible parent) */}
        <div className="nav-section">
          <div className="nav-group-header" id="nav-uw-parent">
            <div style={s("display:flex;align-items:center;gap:10px")}>
              <svg
                className="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span data-en="Underwriting" data-zh="承销分析">
                Underwriting
              </span>
            </div>
            <svg
              className="nav-chevron"
              id="uw-chevron"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          <div className="nav-submenu" id="submenu-uw">
            <a className="nav-item nav-child active" id="nav-projects">
              <svg
                className="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              <span data-en="Projects" data-zh="项目管理">
                Projects
              </span>
            </a>
          </div>
        </div>

        {/* Admin section (role-gated) */}
        <div className="nav-section" id="adminNav" style={s("display:none")}>
          <div
            className="nav-group-header"
            style={s("cursor:default;pointer-events:none")}
          >
            <div style={s("display:flex;align-items:center;gap:10px")}>
              <svg
                className="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
              <span data-en="Admin" data-zh="管理">
                Admin
              </span>
            </div>
          </div>
          <div className="nav-submenu">
            <a className="nav-item nav-child" id="nav-users">
              <svg
                className="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
              <span data-en="Users" data-zh="用户管理">
                Users
              </span>
            </a>
            <a className="nav-item nav-child" id="nav-settings">
              <svg
                className="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
              <span data-en="Settings" data-zh="系统设置">
                Settings
              </span>
            </a>
          </div>
        </div>
      </div>

      <div className="sidebar-footer">
        <button className="lang-toggle" id="langToggleBtn">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
          </svg>
          <span id="langToggleLabel">中文</span>
        </button>
        <div
          className="user-badge"
          style={s("margin-top:8px;position:relative;cursor:pointer")}
          id="userBadge"
        >
          <div
            className="user-avatar"
            id="userAvatar"
            style={s("transition:transform 0.15s")}
          >
            A
          </div>
          <div className="user-info">
            <div className="user-name" id="sidebarUserName">
              User
            </div>
            <div className="user-role" id="sidebarUserRole">
              Administrator
            </div>
          </div>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--muted)"
            strokeWidth="2"
            style={s("margin-left:auto;flex-shrink:0")}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        {/* Role Switcher Dropdown */}
        <div
          id="roleSwitcherMenu"
          style={s(
            "display:none;position:absolute;bottom:68px;left:12px;right:12px;background:white;border:1px solid var(--border);border-radius:12px;box-shadow:0 8px 32px rgba(60,45,30,0.14);z-index:200;overflow:hidden",
          )}
        >
          <div
            style={s(
              "padding:8px 12px 6px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid var(--border)",
            )}
          >
            Switch Account
          </div>
          <div id="roleSwitcherList"></div>
        </div>
      </div>
    </nav>
  );
}

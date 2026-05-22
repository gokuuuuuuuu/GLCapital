import React from "react";
import { s } from "../utils/parseStyle";

export default function ProjectsPage() {
  return (
    <div id="page-projects" className="page" style={s("display:none")}>
      <div className="page-header">
        <div>
          <div className="page-title" data-en="Projects" data-zh="项目管理">
            Projects
          </div>
          <div className="page-subtitle" id="myProjectsLabel">
            Your portfolio of active analyses
          </div>
        </div>
        <button id="newProjectBtn" className="btn btn-primary">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span data-en="New Project" data-zh="新建项目">
            New Project
          </span>
        </button>
      </div>
      {/* Portfolio Summary Banner */}
      <div
        id="projSummaryBanner"
        style={s(
          "display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px",
        )}
      ></div>
      {/* Search + Status Filter */}
      <div
        style={s(
          "display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap",
        )}
      >
        <div
          style={s("position:relative;flex:1;min-width:180px;max-width:320px")}
        >
          <svg
            style={s(
              "position:absolute;left:10px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:var(--muted);pointer-events:none",
            )}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="projSearchInput"
            className="form-input"
            style={s("padding-left:32px;height:36px;font-size:13px")}
            placeholder="Search projects…"
            onInput={() => window.renderProjects()}
          />
        </div>
        <div
          style={s(
            "display:flex;gap:4px;background:rgba(0,0,0,0.05);border-radius:10px;padding:3px",
          )}
        >
          <button
            id="filterAll"
            className="btn btn-sm proj-filter-btn active-filter"
            data-en="All"
            data-zh="全部"
          >
            All
          </button>
          <button
            id="filterDraft"
            className="btn btn-sm proj-filter-btn"
            data-en="Draft"
            data-zh="草稿"
          >
            Draft
          </button>
          <button
            id="filterComplete"
            className="btn btn-sm proj-filter-btn"
            data-en="Complete"
            data-zh="已完成"
          >
            Complete
          </button>
        </div>
      </div>
      <div id="projectsList"></div>
    </div>
  );
}

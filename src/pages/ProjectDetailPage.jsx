import React from "react";
import { s } from "../utils/parseStyle";

export default function ProjectDetailPage() {
  return (
    <div id="page-project-detail" className="page">
      <div
        className="page-header"
        style={s("padding-bottom:0;border-bottom:none")}
      >
        <div style={s("display:flex;align-items:center;gap:12px")}>
          <button
            id="backToProjectsBtn"
            className="btn btn-ghost btn-sm"
            style={s("padding:6px 8px")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <div className="page-title" id="detailProjectName">
              Project
            </div>
            <div
              className="page-subtitle"
              id="detailProjectAddr"
              style={s("font-size:12px")}
            ></div>
          </div>
          <div id="detailAIScoreBadge" style={s("margin-left:12px")}></div>
        </div>
        <div style={s("display:flex;gap:8px;align-items:center")}>
          <span
            className="badge"
            id="detailProjectStatus"
            style={s("font-size:11px;padding:4px 10px")}
          ></span>
          <button
            id="detailStatusToggle"
            style={s(
              "font-size:11px;display:flex;align-items:center;gap:5px;padding:5px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--muted);cursor:pointer;font-family:inherit;transition:all 0.15s",
            )}
            title="Toggle project status"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span id="detailStatusToggleLabel">Mark Complete</span>
          </button>
          <button
            id="globalEditToggleBtn"
            className="btn btn-ghost btn-sm"
            style={s(
              "display:flex;align-items:center;gap:5px;border:1px solid var(--border)",
            )}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={s("width:13px;height:13px")}
            >
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span id="globalEditToggleLabel">Edit Mode</span>
          </button>
          <button id="fetchApisBtn" className="btn btn-secondary btn-sm">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Fetch APIs
          </button>
          <button id="savePFBtn" className="btn btn-primary btn-sm">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            Save
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="project-tab-bar">
        <button className="proj-tab active" id="ptab-proforma">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <span data-en="Pro Forma" data-zh="财务预测">
            Pro Forma
          </span>
        </button>
        <button className="proj-tab" id="ptab-files">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
          <span data-en="T12" data-zh="T12">
            T12
          </span>
          <span className="tab-dot" id="tabdot-t12"></span>
        </button>
        <button className="proj-tab" id="ptab-rentroll">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          <span data-en="Rent Roll" data-zh="租户清单">
            Rent Roll
          </span>
          <span className="tab-dot" id="tabdot-rr"></span>
        </button>
        <button className="proj-tab" id="ptab-hellodata">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          <span data-en="HelloData" data-zh="HelloData">
            HelloData
          </span>
          <span className="tab-dot" id="tabdot-hd"></span>
        </button>
        <button className="proj-tab" id="ptab-debt">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
          <span data-en="Debt Analysis" data-zh="债务分析">
            Debt Analysis
          </span>
          <span className="tab-dot" id="tabdot-debt"></span>
        </button>
      </div>

      {/* Global Data Source Legend */}
      <div
        id="globalDsLegend"
        style={s(
          "display:flex;gap:6px;align-items:center;padding:6px 0 2px;flex-wrap:wrap",
        )}
      >
        <span
          style={s(
            "font-size:9px;color:var(--muted);letter-spacing:.03em;font-weight:500;margin-right:2px",
          )}
          data-en="Sources"
          data-zh="数据源"
        >
          Sources
        </span>
        <span
          className="ds-legend-tag"
          style={s("color:#2E7D32;background:rgba(46,125,50,0.07)")}
        >
          T12
        </span>
        <span
          className="ds-legend-tag"
          style={s("color:#1565C0;background:rgba(21,101,192,0.07)")}
        >
          HelloData
        </span>
        <span
          className="ds-legend-tag"
          style={s("color:#6A1B9A;background:rgba(106,27,154,0.07)")}
        >
          Rent Roll
        </span>
        <span
          className="ds-legend-tag"
          style={s("color:#0891B2;background:rgba(8,145,178,0.08)")}
        >
          RentCast
        </span>
        <span
          className="ds-legend-tag"
          style={s("color:#37474F;background:rgba(55,71,79,0.07)")}
        >
          ATTOM
        </span>
        <span
          className="ds-legend-tag"
          style={s("color:#E65100;background:rgba(230,81,0,0.07)")}
          data-en="Manual"
          data-zh="手动"
        >
          Manual
        </span>
      </div>

      {/* Published banner */}

      {/* ============================================================ */}
      {/* FILES TAB (T12)                                              */}
      {/* ============================================================ */}
      <div
        id="proj-tab-files"
        className="proj-tab-content"
        style={s("display:none")}
      >
        <div style={s("margin-top:var(--gap)")}>
          {/* T12 Header Card */}
          <div className="card" style={s("margin-bottom:16px")}>
            <div
              style={s(
                "display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px",
              )}
            >
              <div style={s("display:flex;align-items:center;gap:14px")}>
                <div
                  style={s(
                    "width:46px;height:46px;border-radius:12px;background:rgba(74,124,89,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0",
                  )}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--green)"
                    strokeWidth="1.8"
                    style={s("width:22px;height:22px")}
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="3" y1="15" x2="21" y2="15" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                  </svg>
                </div>
                <div>
                  <div
                    style={s(
                      "font-size:16px;font-weight:800;color:var(--header)",
                    )}
                    data-en="T12 — Trailing 12 Months"
                    data-zh="T12 — 近12个月财务"
                  >
                    T12 — Trailing 12 Months
                  </div>
                  <div
                    id="t12FileInfo"
                    style={s(
                      "font-size:12px;color:var(--muted);margin-top:3px",
                    )}
                    data-en="No file uploaded · Single file only"
                    data-zh="未上传文件 · 仅限一个文件"
                  >
                    No file uploaded · Single file only
                  </div>
                </div>
              </div>
              <div style={s("display:flex;gap:8px;align-items:center")}>
                <button className="btn btn-secondary btn-sm" id="t12UploadBtn">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={s("width:13px;height:13px")}
                  >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span
                    id="t12UploadBtnLabel"
                    data-en="Upload T12"
                    data-zh="上传T12"
                  >
                    Upload T12
                  </span>
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  id="t12DeleteBtn"
                  style={s("display:none;color:var(--red,#c0392b)")}
                  title="Remove"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={s("width:13px;height:13px")}
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                </button>
                <input
                  type="file"
                  id="t12Input"
                  accept=".xlsx,.xls,.csv,.pdf"
                  style={s("display:none")}
                  onChange={(e) => window.handleT12Upload(e)}
                />
              </div>
            </div>
            {/* Drop zone (shown when empty) */}
            <div
              id="t12DropZone"
              style={s(
                "margin-top:16px;border:2px dashed var(--border);border-radius:10px;padding:32px;text-align:center;cursor:pointer;transition:border-color .2s",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = "var(--accent)";
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = "var(--border)";
                window.handleT12Drop(e);
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.4"
                style={s(
                  "width:36px;height:36px;margin:0 auto 10px;display:block",
                )}
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <div
                style={s(
                  "font-size:13px;font-weight:600;color:var(--header);margin-bottom:4px",
                )}
                data-en="Drop T12 / Selling Model here"
                data-zh="拖拽T12/销售模型文件到此"
              >
                Drop T12 / Selling Model here
              </div>
              <div style={s("font-size:11px;color:var(--muted)")}>
                .xlsx · .xls · .csv · .pdf · Max 1 file
              </div>
            </div>
          </div>
          {/* T12 Parsed Content (shown after upload) */}
          <div id="t12ParsedContent" style={s("display:none")}></div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* PRO FORMA TAB                                                */}
      {/* ============================================================ */}
      <div id="proj-tab-proforma" className="proj-tab-content active">
        <div style={s("margin-top:var(--gap)")}>
          {/* Empty state (shown when no data) */}
          <div id="pfEmptyState" style={s("display:none")}>
            <div
              className="card"
              style={s("text-align:center;padding:64px 40px")}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--muted)"
                strokeWidth="1.2"
                style={s(
                  "width:52px;height:52px;margin:0 auto 16px;display:block",
                )}
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              <div
                style={s(
                  "font-size:16px;font-weight:700;color:var(--header);margin-bottom:8px",
                )}
                data-en="No Pro Forma Data Yet"
                data-zh="暂无财务预测数据"
              >
                No Pro Forma Data Yet
              </div>
              <div
                style={s(
                  "font-size:13px;color:var(--muted);max-width:360px;margin:0 auto 20px",
                )}
                data-en="Upload a T12 / Selling Model file or connect an API to populate the pro forma table."
                data-zh="上传T12/销售模型文件或连接API以生成财务预测表。"
              >
                Upload a T12 / Selling Model file or connect an API to populate
                the pro forma table.
              </div>
              <div
                style={s(
                  "display:flex;gap:10px;justify-content:center;flex-wrap:wrap",
                )}
              >
                <button id="goToFilesTabBtn" className="btn btn-secondary">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={s("width:14px;height:14px")}
                  >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span data-en="Upload T12 File" data-zh="上传T12文件">
                    Upload T12 File
                  </span>
                </button>
                <button id="loadDemoPFBtn" className="btn btn-primary">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={s("width:14px;height:14px")}
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span data-en="Load Demo Data" data-zh="加载示例数据">
                    Load Demo Data
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Pro Forma Content (shown when data exists) */}
          <div id="pfContent">
            {/* Controls row */}
            <div
              style={s(
                "display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px",
              )}
            >
              <div
                style={s(
                  "display:flex;align-items:center;gap:8px;flex-wrap:wrap",
                )}
              >
                <div
                  style={s(
                    "font-size:13px;font-weight:700;color:var(--header)",
                  )}
                  data-en="Pro Forma Analysis"
                  data-zh="财务预测分析"
                >
                  Pro Forma Analysis
                </div>
                <div
                  id="pfSourceBadges"
                  style={s("display:flex;gap:6px;flex-wrap:wrap")}
                ></div>
              </div>
              <div style={s("display:flex;gap:8px;align-items:center")}>
                <div
                  id="pfConflictAlert"
                  style={s(
                    "display:none;align-items:center;gap:6px;background:rgba(200,100,0,0.1);border:1px solid rgba(200,100,0,0.25);padding:5px 10px;border-radius:6px;font-size:12px;color:#a05000;font-weight:600",
                  )}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={s("width:13px;height:13px")}
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span id="pfConflictCount">0</span>&nbsp;
                  <span data-en="conflicts detected" data-zh="数据冲突">
                    conflicts detected
                  </span>
                </div>
                <button
                  id="openAssumptionsBtn"
                  className="btn btn-ghost btn-sm"
                  style={s("display:flex;align-items:center;gap:5px")}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={s("width:13px;height:13px")}
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" />
                    <path d="M15.54 8.46a5 5 0 010 7.07M8.46 8.46a5 5 0 000 7.07" />
                  </svg>
                  <span data-en="Assumptions" data-zh="预测假设">
                    Assumptions
                  </span>
                </button>
                <button id="exportPFBtn" className="btn btn-ghost btn-sm">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={s("width:13px;height:13px")}
                  >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span data-en="Export" data-zh="导出">
                    Export
                  </span>
                </button>
              </div>
            </div>

            {/* ProForma Sub-tabs */}
            <div
              style={s(
                "display:flex;gap:0;flex-wrap:wrap;border-bottom:2px solid var(--border);margin-bottom:16px",
              )}
            >
              <button
                className="pf-subtab pf-subtab-active"
                id="pfst-pf-summary"
              >
                Summary &amp; Rent Roll
              </button>
              <button className="pf-subtab" id="pfst-pf-revexp">
                Revenue &amp; Expenses
              </button>
              <button className="pf-subtab" id="pfst-pf-closing">
                Closing Costs
              </button>
              <button className="pf-subtab" id="pfst-pf-purchase">
                Purchase Price
              </button>
              <button className="pf-subtab" id="pfst-pf-equity">
                Construction Equity
              </button>
              <button className="pf-subtab" id="pfst-pf-sale">
                Sale Event
              </button>
              <button className="pf-subtab" id="pfst-pf-eqreq">
                Equity Required
              </button>
              <button className="pf-subtab" id="pfst-pf-refi">
                Refinance Event
              </button>
              <button className="pf-subtab" id="pfst-pf-tax">
                Tax Assessment
              </button>
              <button className="pf-subtab" id="pfst-pf-waterfall">
                Waterfall Distributions
              </button>
            </div>

            {/* ======== Sub-tab Panel: Summary & Rent Roll ======== */}
            <div id="pfsp-pf-summary">
              {/* KPI Summary Strip */}
              <div className="summ-kpi-strip" id="summKpiStrip">
                <div className="summ-kpi-card">
                  <div className="skc-bar"></div>
                  <div className="skc-label">Units</div>
                  <div className="skc-value" id="kpiUnits">
                    {"—"}
                  </div>
                </div>
                <div className="summ-kpi-card">
                  <div className="skc-bar"></div>
                  <div className="skc-label">Ask Price</div>
                  <div className="skc-value" id="kpiAskPrice">
                    {"—"}
                  </div>
                </div>
                <div className="summ-kpi-card">
                  <div className="skc-bar"></div>
                  <div className="skc-label">Offer Price</div>
                  <div className="skc-value" id="kpiOfferPrice">
                    {"—"}
                  </div>
                </div>
                <div className="summ-kpi-card skc-green">
                  <div className="skc-bar"></div>
                  <div className="skc-label">As-is Rent (Total)</div>
                  <div className="skc-value" id="kpiAsIsRent">
                    {"—"}
                  </div>
                </div>
                <div className="summ-kpi-card skc-green">
                  <div className="skc-bar"></div>
                  <div className="skc-label">Projected Rent (Total)</div>
                  <div className="skc-value" id="kpiProjRent">
                    {"—"}
                  </div>
                </div>
              </div>

              <div
                id="pfSummarySection"
                className="card"
                style={s("margin-bottom:var(--gap);padding:0;overflow:hidden")}
              >
                {/* Header */}
                <div
                  style={s(
                    "padding:12px 18px;border-bottom:1px solid var(--border);background:rgba(139,115,85,0.04)",
                  )}
                >
                  <span
                    style={s(
                      "font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)",
                    )}
                  >
                    Project Summary
                  </span>
                </div>
                {/* Summary rows matching Excel layout */}
                <table
                  style={s(
                    "width:100%;border-collapse:collapse;font-size:12px",
                  )}
                >
                  <tbody>
                    <tr style={s("border-bottom:1px solid var(--border)")}>
                      <td
                        style={s(
                          "padding:9px 18px;color:var(--header);font-weight:700",
                        )}
                      >
                        Year Built
                      </td>
                      <td
                        data-editable
                        style={s(
                          "padding:9px 18px;text-align:right;color:var(--header);font-weight:600",
                        )}
                      >
                        {"—"}
                      </td>
                    </tr>
                    <tr
                      style={s(
                        "border-bottom:1px solid var(--border);background:rgba(0,0,0,0.015)",
                      )}
                    >
                      <td style={s("padding:9px 18px;color:var(--body)")}>
                        Lot Size
                      </td>
                      <td
                        data-editable
                        style={s(
                          "padding:9px 18px;text-align:right;color:var(--muted)",
                        )}
                      >
                        {"—"}
                      </td>
                    </tr>
                    <tr style={s("border-bottom:1px solid var(--border)")}>
                      <td style={s("padding:9px 18px;color:var(--body)")}>
                        Building Size
                      </td>
                      <td
                        data-editable
                        style={s(
                          "padding:9px 18px;text-align:right;color:var(--muted)",
                        )}
                      >
                        {"—"}
                      </td>
                    </tr>
                    <tr
                      style={s(
                        "border-bottom:1px solid var(--border);background:rgba(0,0,0,0.015)",
                      )}
                    >
                      <td style={s("padding:9px 18px;color:var(--body)")}>
                        Ask Price
                      </td>
                      <td
                        data-editable
                        style={s(
                          "padding:9px 18px;text-align:right;color:var(--muted)",
                        )}
                      >
                        {"—"}
                      </td>
                    </tr>
                    <tr style={s("border-bottom:1px solid var(--border)")}>
                      <td style={s("padding:9px 18px;color:var(--body)")}>
                        Offer Price
                      </td>
                      <td
                        data-editable
                        style={s(
                          "padding:9px 18px;text-align:right;font-weight:700;color:var(--header)",
                        )}
                      >
                        {"—"}
                      </td>
                    </tr>
                    <tr
                      style={s(
                        "border-bottom:1px solid var(--border);background:rgba(0,0,0,0.015)",
                      )}
                    >
                      <td style={s("padding:9px 18px;color:var(--body)")}>
                        Occupancy Rate
                      </td>
                      <td
                        id="pfSummOccCell"
                        style={s("padding:6px 18px 6px 10px;text-align:right")}
                      ></td>
                    </tr>
                    <tr style={s("border-bottom:1px solid var(--border)")}>
                      <td style={s("padding:9px 18px;color:var(--body)")}>
                        Total Apartment Units
                      </td>
                      <td
                        id="pfSummUnitsCell"
                        style={s("padding:6px 18px 6px 10px;text-align:right")}
                      ></td>
                    </tr>
                    <tr
                      style={s(
                        "border-bottom:1px solid var(--border);background:rgba(0,0,0,0.015)",
                      )}
                    >
                      <td style={s("padding:9px 18px;color:var(--body)")}>
                        Total Current Retail Units
                      </td>
                      <td
                        data-editable
                        style={s(
                          "padding:9px 18px;text-align:right;color:var(--muted)",
                        )}
                      >
                        {"—"}
                      </td>
                    </tr>
                    <tr>
                      <td style={s("padding:9px 18px;color:var(--body)")}>
                        Total Parking Spaces
                      </td>
                      <td
                        data-editable
                        style={s(
                          "padding:9px 18px;text-align:right;color:var(--muted)",
                        )}
                      >
                        {"—"}
                      </td>
                    </tr>
                  </tbody>
                  <tbody id="summCustomFields"></tbody>
                </table>
                {/* "+ Add Field" hidden in MVP */}
                <div
                  style={s(
                    "display:none;padding:8px 18px 10px;border-top:1px solid var(--border);background:rgba(139,115,85,0.02)",
                  )}
                >
                  <button
                    onClick={() => window.summAddField()}
                    style={s(
                      "background:none;border:1px dashed var(--border2);color:var(--accent);font-size:12px;font-weight:600;padding:5px 14px;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:5px",
                    )}
                  >
                    <span style={s("font-size:16px;line-height:1")}>+</span> Add
                    Field
                  </button>
                </div>
              </div>

              {/* Residential Rent Roll card (separate) */}
              <div
                className="card"
                style={s("margin-bottom:var(--gap);padding:0;overflow:hidden")}
              >
                {/* Title row */}
                <div
                  style={s(
                    "padding:10px 18px 0;background:rgba(139,115,85,0.04);border-bottom:none",
                  )}
                >
                  <span
                    style={s(
                      "font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)",
                    )}
                  >
                    Residential Rent Roll
                  </span>
                </div>
                <div style={s("overflow-x:auto")}>
                  <table
                    id="pfUnitMixTable"
                    style={s(
                      "width:100%;border-collapse:collapse;font-size:12px;min-width:760px",
                    )}
                  >
                    <thead id="pfUnitMixHead"></thead>
                    <tbody id="pfUnitMixBody"></tbody>
                  </table>
                </div>
                {/* Add Row button */}
                <div
                  style={s(
                    "padding:8px 18px 10px;border-top:1px solid var(--border);background:rgba(139,115,85,0.02)",
                  )}
                >
                  <button
                    id="rrAddRowBtn"
                    onClick={() => window.rrAddRow()}
                    style={s(
                      "background:none;border:1px dashed var(--border2);color:var(--accent);font-size:12px;font-weight:600;padding:5px 14px;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:5px",
                    )}
                  >
                    <span style={s("font-size:16px;line-height:1")}>+</span> Add
                    Row
                  </button>
                </div>
              </div>
            </div>

            {/* ======== Sub-tab Panel: Revenue & Expenses ======== */}
            <div id="pfsp-pf-revexp" style={s("display:none")}>
              {/* INCOME card */}
              <div
                id="pfTableWrap"
                className="card"
                style={s("padding:0;overflow:hidden;margin-bottom:var(--gap)")}
              >
                <div style={s("overflow-x:auto")}>
                  <table
                    style={s(
                      "width:100%;border-collapse:collapse;min-width:1060px;font-size:12px",
                    )}
                  >
                    <thead>
                      {/* Section label row */}
                      <tr
                        style={s(
                          "background:rgba(74,124,89,0.18);border-bottom:1px solid rgba(74,124,89,0.3)",
                        )}
                      >
                        <td
                          id="pfRevLabel"
                          colSpan="11"
                          style={s(
                            "padding:8px 14px;font-size:12px;font-weight:800;color:var(--green)",
                          )}
                        >
                          INCOME
                        </td>
                      </tr>
                      {/* Column header row */}
                      <tr
                        id="pfRevColHdrRow"
                        style={s(
                          "background:rgba(74,124,89,0.10);border-bottom:2px solid rgba(74,124,89,0.25)",
                        )}
                      >
                        <th
                          style={s(
                            "padding:8px 14px;text-align:left;font-weight:700;color:var(--header);min-width:180px",
                          )}
                        >
                          Line Item
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:600;color:var(--header);white-space:nowrap;min-width:90px",
                          )}
                        >
                          Per Unit
                        </th>
                        <th style={s("display:none")}>Source</th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:center;font-weight:600;color:var(--header);white-space:nowrap;min-width:60px",
                          )}
                        >
                          Units
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2024
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2025
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2026
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap;border-left:2px solid rgba(74,124,89,0.3)",
                          )}
                        >
                          2027
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2028
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2029
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2030
                        </th>
                      </tr>
                    </thead>
                    {/* Upper table: Per-Unit Income */}
                    <tbody id="pfRevUpperBody">
                      <tr>
                        <td
                          style={s(
                            "padding:7px 14px;font-size:12px;color:var(--muted)",
                          )}
                        >
                          Loading...
                        </td>
                      </tr>
                    </tbody>
                    {/* Subtotal Per-Unit (legacy, hidden) */}
                    <tbody
                      id="pfRevUpperSubtotal"
                      style={s("display:none")}
                    ></tbody>
                    {/* Section divider: Other Income (legacy, hidden) */}
                    <tbody style={s("display:none")}>
                      <tr
                        style={s(
                          "background:rgba(74,124,89,0.10);border-top:2px solid rgba(74,124,89,0.18)",
                        )}
                      >
                        <td
                          colSpan="4"
                          style={s(
                            "padding:6px 14px;font-size:11px;font-weight:700;color:var(--green);letter-spacing:.03em",
                          )}
                        >
                          OTHER INCOME
                        </td>
                        <td colSpan="7"></td>
                      </tr>
                    </tbody>
                    {/* Lower table: Other Income (legacy, hidden) */}
                    <tbody
                      id="pfRevLowerBody"
                      style={s("display:none")}
                    ></tbody>
                    {/* Subtotal Other Income (legacy, hidden) */}
                    <tbody
                      id="pfRevLowerSubtotal"
                      style={s("display:none")}
                    ></tbody>
                    {/* Total Revenue (legacy, hidden) */}
                    <tbody
                      id="pfRevTotalBody"
                      style={s("display:none")}
                    ></tbody>
                    {/* Legacy global Add Field button (hidden) */}
                    <tbody style={s("display:none")}>
                      <tr>
                        <td colSpan="11" style={s("padding:8px 14px")}>
                          <button
                            id="btnAddIncomeField"
                            onClick={() => window.openAddFieldModal("income")}
                            style={s(
                              "border:1px dashed rgba(74,124,89,0.4);background:none;color:var(--green);padding:4px 16px;font-size:11px;font-weight:600;cursor:pointer;border-radius:4px;letter-spacing:.02em",
                            )}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              style={s("vertical-align:-2px;margin-right:4px")}
                            >
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add Field
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add Field Modal */}
              <div
                id="addFieldModal"
                style={s(
                  "display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:rgba(0,0,0,0.45);backdrop-filter:blur(2px)",
                )}
                onClick={(e) => {
                  if (e.target === e.currentTarget) window.closeAddFieldModal();
                }}
              >
                <div
                  style={s(
                    "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--card-bg,#fff);border-radius:12px;padding:24px;width:420px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)",
                  )}
                >
                  <div
                    style={s(
                      "display:flex;justify-content:space-between;align-items:center;margin-bottom:16px",
                    )}
                  >
                    <h3
                      style={s(
                        "margin:0;font-size:15px;font-weight:700;color:var(--header)",
                      )}
                    >
                      Add Income Field
                    </h3>
                    <button
                      onClick={() => window.closeAddFieldModal()}
                      style={s(
                        "border:none;background:none;font-size:18px;cursor:pointer;color:var(--muted);padding:4px",
                      )}
                    >
                      &times;
                    </button>
                  </div>
                  <div style={s("margin-bottom:16px")}>
                    <div
                      style={s(
                        "font-size:11px;font-weight:600;color:var(--muted);margin-bottom:8px;letter-spacing:.03em",
                      )}
                    >
                      AVAILABLE FIELDS
                    </div>
                    <div
                      id="addFieldList"
                      style={s("display:flex;flex-direction:column;gap:4px")}
                    ></div>
                  </div>
                  <div style={s("margin-bottom:16px")}>
                    <div
                      style={s(
                        "font-size:11px;font-weight:600;color:var(--muted);margin-bottom:8px;letter-spacing:.03em",
                      )}
                    >
                      ADD TO
                    </div>
                    <label
                      style={s(
                        "display:flex;align-items:center;gap:8px;font-size:13px;color:var(--body);cursor:pointer;margin-bottom:4px",
                      )}
                    >
                      <input
                        type="radio"
                        name="addFieldTarget"
                        value="upper"
                        defaultChecked
                        style={s("accent-color:var(--green)")}
                      />{" "}
                      Per-Unit Income
                    </label>
                    <label
                      style={s(
                        "display:flex;align-items:center;gap:8px;font-size:13px;color:var(--body);cursor:pointer",
                      )}
                    >
                      <input
                        type="radio"
                        name="addFieldTarget"
                        value="lower"
                        style={s("accent-color:var(--green)")}
                      />{" "}
                      Other Income
                    </label>
                  </div>
                  <div
                    id="addFieldWarning"
                    style={s(
                      "display:none;padding:8px 12px;background:#FFF3E0;border-radius:6px;font-size:11px;color:#E65100;margin-bottom:12px",
                    )}
                  >
                    {
                      "⚠ EGI = GPR − Vacancy + Other Income. Adding EGI alongside its components may cause double-counting."
                    }
                  </div>
                  <div
                    style={s("display:flex;gap:8px;justify-content:flex-end")}
                  >
                    <button
                      onClick={() => window.closeAddFieldModal()}
                      style={s(
                        "padding:6px 16px;border:1px solid var(--border);background:none;border-radius:6px;font-size:12px;cursor:pointer;color:var(--body)",
                      )}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => window.confirmAddField()}
                      style={s(
                        "padding:6px 16px;border:none;background:var(--green);color:#fff;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer",
                      )}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* EXPENSES card */}
              <div
                className="card"
                style={s("padding:0;overflow:hidden;margin-bottom:var(--gap)")}
              >
                <div style={s("overflow-x:auto")}>
                  <table
                    style={s(
                      "width:100%;border-collapse:collapse;min-width:1060px;font-size:12px",
                    )}
                  >
                    <thead>
                      {/* Section label row */}
                      <tr
                        style={s(
                          "background:rgba(74,124,89,0.18);border-bottom:1px solid rgba(74,124,89,0.3)",
                        )}
                      >
                        <td
                          id="pfExpLabel"
                          colSpan="11"
                          style={s(
                            "padding:8px 14px;font-size:12px;font-weight:800;color:var(--green)",
                          )}
                        >
                          EXPENSES
                        </td>
                      </tr>
                      {/* Column header row */}
                      <tr
                        id="pfExpColHdrRow"
                        style={s(
                          "background:rgba(74,124,89,0.10);border-bottom:2px solid rgba(74,124,89,0.25)",
                        )}
                      >
                        <th
                          style={s(
                            "padding:8px 14px;text-align:left;font-weight:700;color:var(--header);min-width:180px",
                          )}
                        >
                          Line Item
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:600;color:var(--header);white-space:nowrap;min-width:90px",
                          )}
                        >
                          Per Unit
                        </th>
                        <th style={s("display:none")}>Source</th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:center;font-weight:600;color:var(--header);white-space:nowrap;min-width:60px",
                          )}
                        >
                          Units
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2024
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2025
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2026
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap;border-left:2px solid rgba(74,124,89,0.3)",
                          )}
                        >
                          2027
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2028
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2029
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2030
                        </th>
                      </tr>
                    </thead>
                    <tbody id="pfExpUpperBody">
                      <tr>
                        <td
                          style={s(
                            "padding:7px 14px;font-size:12px;color:var(--muted)",
                          )}
                        >
                          Loading...
                        </td>
                      </tr>
                    </tbody>
                    <tbody
                      id="pfExpUpperSubtotal"
                      style={s("display:none")}
                    ></tbody>
                    <tbody style={s("display:none")}>
                      <tr
                        style={s(
                          "background:rgba(74,124,89,0.10);border-top:2px solid rgba(74,124,89,0.18)",
                        )}
                      >
                        <td
                          colSpan="4"
                          style={s(
                            "padding:6px 14px;font-size:11px;font-weight:700;color:var(--green);letter-spacing:.03em",
                          )}
                        >
                          FLAT EXPENSES
                        </td>
                        <td colSpan="7"></td>
                      </tr>
                    </tbody>
                    <tbody
                      id="pfExpLowerBody"
                      style={s("display:none")}
                    ></tbody>
                    <tbody
                      id="pfExpLowerSubtotal"
                      style={s("display:none")}
                    ></tbody>
                    <tbody
                      id="pfExpTotalBody"
                      style={s("display:none")}
                    ></tbody>
                    <tbody style={s("display:none")}>
                      <tr>
                        <td colSpan="11" style={s("padding:8px 14px")}>
                          <button
                            id="btnAddExpField"
                            onClick={() => window.openExpAddFieldModal()}
                            style={s(
                              "border:1px dashed rgba(74,124,89,0.4);background:none;color:var(--green);padding:4px 16px;font-size:11px;font-weight:600;cursor:pointer;border-radius:4px;letter-spacing:.02em",
                            )}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              style={s("vertical-align:-2px;margin-right:4px")}
                            >
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add Field
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add Expense Field Modal */}
              <div
                id="addExpFieldModal"
                style={s(
                  "display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:rgba(0,0,0,0.45);backdrop-filter:blur(2px)",
                )}
                onClick={(e) => {
                  if (e.target === e.currentTarget)
                    window.closeExpAddFieldModal();
                }}
              >
                <div
                  style={s(
                    "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--card-bg,#fff);border-radius:12px;padding:24px;width:420px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)",
                  )}
                >
                  <div
                    style={s(
                      "display:flex;justify-content:space-between;align-items:center;margin-bottom:16px",
                    )}
                  >
                    <h3
                      style={s(
                        "margin:0;font-size:15px;font-weight:700;color:var(--header)",
                      )}
                    >
                      Add Expense Field
                    </h3>
                    <button
                      onClick={() => window.closeExpAddFieldModal()}
                      style={s(
                        "border:none;background:none;font-size:18px;cursor:pointer;color:var(--muted);padding:4px",
                      )}
                    >
                      &times;
                    </button>
                  </div>
                  <div style={s("margin-bottom:16px")}>
                    <div
                      style={s(
                        "font-size:11px;font-weight:600;color:var(--muted);margin-bottom:8px;letter-spacing:.03em",
                      )}
                    >
                      AVAILABLE FIELDS
                    </div>
                    <div
                      id="addExpFieldList"
                      style={s("display:flex;flex-direction:column;gap:4px")}
                    ></div>
                  </div>
                  <div style={s("margin-bottom:16px")}>
                    <div
                      style={s(
                        "font-size:11px;font-weight:600;color:var(--muted);margin-bottom:8px;letter-spacing:.03em",
                      )}
                    >
                      ADD TO
                    </div>
                    <label
                      style={s(
                        "display:flex;align-items:center;gap:8px;font-size:13px;color:var(--body);cursor:pointer;margin-bottom:4px",
                      )}
                    >
                      <input
                        type="radio"
                        name="addExpFieldTarget"
                        value="upper"
                        defaultChecked
                        style={s("accent-color:var(--green)")}
                      />{" "}
                      Per-Unit Expenses
                    </label>
                    <label
                      style={s(
                        "display:flex;align-items:center;gap:8px;font-size:13px;color:var(--body);cursor:pointer",
                      )}
                    >
                      <input
                        type="radio"
                        name="addExpFieldTarget"
                        value="lower"
                        style={s("accent-color:var(--green)")}
                      />{" "}
                      Flat Expenses
                    </label>
                  </div>
                  <div
                    style={s("display:flex;gap:8px;justify-content:flex-end")}
                  >
                    <button
                      onClick={() => window.closeExpAddFieldModal()}
                      style={s(
                        "padding:6px 16px;border:1px solid var(--border);background:none;border-radius:6px;font-size:12px;cursor:pointer;color:var(--body)",
                      )}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => window.confirmExpAddField()}
                      style={s(
                        "padding:6px 16px;border:none;background:var(--green);color:#fff;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer",
                      )}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* NET OPERATING INCOME card */}
              <div
                className="card"
                style={s("padding:0;overflow:hidden;margin-bottom:var(--gap)")}
              >
                <div style={s("overflow-x:auto")}>
                  <table
                    style={s(
                      "width:100%;border-collapse:collapse;min-width:860px;font-size:12px",
                    )}
                  >
                    <thead>
                      <tr
                        style={s(
                          "background:rgba(74,124,89,0.10);border-bottom:2px solid rgba(74,124,89,0.25)",
                        )}
                      >
                        <th
                          style={s(
                            "padding:8px 14px;text-align:left;font-weight:700;color:var(--header);min-width:200px",
                          )}
                        ></th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:600;color:var(--muted)",
                          )}
                        ></th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2024
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2025
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2026
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap;border-left:2px solid rgba(74,124,89,0.3)",
                          )}
                        >
                          2027
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2028
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2029
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2030
                        </th>
                      </tr>
                    </thead>
                    <tbody id="pfNoiBody">
                      <tr
                        style={s(
                          "background:rgba(74,124,89,0.14);border-bottom:2px solid rgba(74,124,89,0.35)",
                        )}
                      >
                        <td
                          style={s(
                            "padding:10px 14px;font-size:12px;font-weight:800;color:var(--green)",
                          )}
                        >
                          Net Operating Income
                        </td>
                        <td style={s("padding:10px 8px")}></td>
                        <td
                          style={s(
                            "padding:10px 10px;text-align:right;font-size:12px;font-weight:700;color:var(--green);background:rgba(74,124,89,0.14)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:10px 10px;text-align:right;font-size:12px;font-weight:700;color:var(--green);background:rgba(74,124,89,0.14)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:10px 10px;text-align:right;font-size:12px;font-weight:700;color:var(--green);background:rgba(74,124,89,0.14)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:10px 10px;text-align:right;font-size:12px;font-weight:700;color:var(--green);background:rgba(74,124,89,0.08);border-left:2px solid rgba(74,124,89,0.25)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:10px 10px;text-align:right;font-size:12px;font-weight:700;color:var(--green);background:rgba(74,124,89,0.08)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:10px 10px;text-align:right;font-size:12px;font-weight:700;color:var(--green);background:rgba(74,124,89,0.08)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:10px 10px;text-align:right;font-size:12px;font-weight:700;color:var(--green);background:rgba(74,124,89,0.08)",
                          )}
                        >
                          {"—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CASH FLOW card */}
              <div
                className="card"
                style={s("padding:0;overflow:hidden;margin-bottom:var(--gap)")}
              >
                <div style={s("overflow-x:auto")}>
                  <table
                    style={s(
                      "width:100%;border-collapse:collapse;min-width:860px;font-size:12px",
                    )}
                  >
                    <thead>
                      <tr
                        style={s(
                          "background:rgba(74,101,133,0.15);border-bottom:1px solid rgba(74,101,133,0.3)",
                        )}
                      >
                        <td
                          colSpan="8"
                          style={s(
                            "padding:8px 14px;font-size:12px;font-weight:800;color:var(--blue)",
                          )}
                        >
                          CASH FLOW
                        </td>
                      </tr>
                      <tr
                        style={s(
                          "background:rgba(74,101,133,0.07);border-bottom:2px solid rgba(74,101,133,0.2)",
                        )}
                      >
                        <th
                          style={s(
                            "padding:8px 14px;text-align:left;font-weight:700;color:var(--header);min-width:200px",
                          )}
                        >
                          Line Item
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2024
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2025
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2026
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap;border-left:2px solid rgba(74,101,133,0.25)",
                          )}
                        >
                          2027
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2028
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2029
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2030
                        </th>
                      </tr>
                    </thead>
                    <tbody id="pfCfBody">
                      <tr
                        style={s(
                          "background:rgba(0,0,0,0.015);border-bottom:1px solid var(--border)",
                        )}
                      >
                        <td
                          style={s(
                            "padding:7px 14px;font-size:12px;color:var(--muted);font-style:italic;background:rgba(0,0,0,0.015);padding-left:24px",
                          )}
                        >
                          Adjustment
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body);background:rgba(74,101,133,0.025);border-left:2px solid rgba(74,101,133,0.22)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body);background:rgba(74,101,133,0.025)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body);background:rgba(74,101,133,0.025)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body);background:rgba(74,101,133,0.025)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                      </tr>
                      <tr style={s("border-bottom:1px solid var(--border)")}>
                        <td
                          style={s(
                            "padding:7px 14px;font-size:12px;color:var(--body)",
                          )}
                        >
                          Debt Service
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body);background:rgba(74,101,133,0.025);border-left:2px solid rgba(74,101,133,0.22)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body);background:rgba(74,101,133,0.025)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body);background:rgba(74,101,133,0.025)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body);background:rgba(74,101,133,0.025)",
                          )}
                        >
                          {"—"}
                        </td>
                      </tr>
                      <tr
                        style={s(
                          "background:rgba(0,0,0,0.015);border-bottom:1px solid var(--border)",
                        )}
                      >
                        <td
                          style={s(
                            "padding:7px 14px;font-size:12px;color:var(--muted);font-style:italic;background:rgba(0,0,0,0.015);padding-left:24px",
                          )}
                        >
                          Capex Reserves from Cash Flow
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body);background:rgba(74,101,133,0.025);border-left:2px solid rgba(74,101,133,0.22)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body);background:rgba(74,101,133,0.025)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body);background:rgba(74,101,133,0.025)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body);background:rgba(74,101,133,0.025)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                      </tr>
                      <tr
                        style={s(
                          "background:rgba(74,101,133,0.1);border-top:2px solid rgba(74,101,133,0.25);border-bottom:1px solid var(--border)",
                        )}
                      >
                        <td
                          style={s(
                            "padding:7px 14px;font-size:12px;font-weight:800;color:var(--blue);background:rgba(74,101,133,0.1)",
                          )}
                        >
                          Cash Flow after Debt Service
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;font-weight:800;color:var(--blue);background:rgba(74,101,133,0.1)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;font-weight:800;color:var(--blue);background:rgba(74,101,133,0.1)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;font-weight:800;color:var(--blue);background:rgba(74,101,133,0.1)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;font-weight:800;color:var(--blue);background:rgba(74,101,133,0.1);border-left:2px solid rgba(74,101,133,0.22)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;font-weight:800;color:var(--blue);background:rgba(74,101,133,0.1)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;font-weight:800;color:var(--blue);background:rgba(74,101,133,0.1)",
                          )}
                        >
                          {"—"}
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;font-weight:800;color:var(--blue);background:rgba(74,101,133,0.1)",
                          )}
                        >
                          {"—"}
                        </td>
                      </tr>
                      <tr style={s("height:6px")}>
                        <td
                          colSpan="8"
                          style={s("background:rgba(0,0,0,0.01)")}
                        ></td>
                      </tr>
                      <tr
                        style={s(
                          "background:rgba(0,0,0,0.015);border-bottom:1px solid var(--border)",
                        )}
                      >
                        <td
                          style={s(
                            "padding:7px 14px;font-size:12px;color:var(--muted);font-style:italic;background:rgba(0,0,0,0.015);padding-left:24px",
                          )}
                        >
                          Reserve for Capex
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body);background:rgba(74,101,133,0.025);border-left:2px solid rgba(74,101,133,0.22)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body);background:rgba(74,101,133,0.025)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body);background:rgba(74,101,133,0.025)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body);background:rgba(74,101,133,0.025)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                      </tr>
                      <tr
                        style={s(
                          "background:rgba(0,0,0,0.015);border-bottom:1px solid var(--border)",
                        )}
                      >
                        <td
                          style={s(
                            "padding:7px 14px;font-size:12px;color:var(--muted);font-style:italic;background:rgba(0,0,0,0.015);padding-left:24px",
                          )}
                        >
                          Capex Reserves from 2025 Cash Flow
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body);background:rgba(74,101,133,0.025);border-left:2px solid rgba(74,101,133,0.22)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body);background:rgba(74,101,133,0.025)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body);background:rgba(74,101,133,0.025)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:7px 8px;text-align:right;font-size:12px;color:var(--body);background:rgba(74,101,133,0.025)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                      </tr>
                      <tr
                        style={s(
                          "background:rgba(74,124,89,0.07);border-top:2px solid rgba(74,124,89,0.25);border-bottom:2px solid rgba(74,124,89,0.25)",
                        )}
                      >
                        <td
                          style={s(
                            "padding:8px 14px;font-size:12px;font-weight:800;color:var(--green);background:rgba(74,124,89,0.07)",
                          )}
                        >
                          DSCR
                        </td>
                        <td
                          style={s(
                            "padding:8px 8px;text-align:right;font-size:12px;background:rgba(74,124,89,0.07)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:8px 8px;text-align:right;font-size:12px;background:rgba(74,124,89,0.07)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:8px 8px;text-align:right;font-size:12px;background:rgba(74,124,89,0.07)",
                          )}
                        >
                          <span style={s("color:var(--muted)")}>{"—"}</span>
                        </td>
                        <td
                          style={s(
                            "padding:8px 8px;text-align:right;font-size:12px;background:rgba(74,124,89,0.07)",
                          )}
                        >
                          <strong style={s("color:var(--green)")}>{"—"}</strong>
                        </td>
                        <td
                          style={s(
                            "padding:8px 8px;text-align:right;font-size:12px;background:rgba(74,124,89,0.07)",
                          )}
                        >
                          <strong style={s("color:var(--green)")}>{"—"}</strong>
                        </td>
                        <td
                          style={s(
                            "padding:8px 8px;text-align:right;font-size:12px;background:rgba(74,124,89,0.07)",
                          )}
                        >
                          <strong style={s("color:var(--green)")}>{"—"}</strong>
                        </td>
                        <td
                          style={s(
                            "padding:8px 8px;text-align:right;font-size:12px;background:rgba(74,124,89,0.07)",
                          )}
                        >
                          <strong style={s("color:var(--green)")}>{"—"}</strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* DEBT COVERAGE card */}
              <div
                className="card"
                style={s("padding:0;overflow:hidden;margin-bottom:var(--gap)")}
              >
                <div style={s("overflow-x:auto")}>
                  <table
                    style={s(
                      "width:100%;border-collapse:collapse;min-width:860px;font-size:12px",
                    )}
                  >
                    <thead>
                      <tr
                        style={s(
                          "background:rgba(74,124,89,0.15);border-bottom:1px solid rgba(74,124,89,0.3)",
                        )}
                      >
                        <td
                          colSpan="8"
                          style={s(
                            "padding:8px 14px;font-size:12px;font-weight:800;color:var(--green)",
                          )}
                        >
                          DEBT COVERAGE
                        </td>
                      </tr>
                      <tr
                        style={s(
                          "background:rgba(74,124,89,0.07);border-bottom:2px solid rgba(74,124,89,0.2)",
                        )}
                      >
                        <th
                          style={s(
                            "padding:8px 14px;text-align:left;font-weight:700;color:var(--header);min-width:200px",
                          )}
                        >
                          Line Item
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2024
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2025
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2026
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap;border-left:2px solid rgba(74,124,89,0.25)",
                          )}
                        >
                          2027
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2028
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2029
                        </th>
                        <th
                          style={s(
                            "padding:8px 8px;text-align:right;font-weight:700;color:var(--header);white-space:nowrap",
                          )}
                        >
                          2030
                        </th>
                      </tr>
                    </thead>
                    <tbody id="pfDscrBody"></tbody>
                  </table>
                </div>
              </div>

              {/* Manual Edits Log */}
              <div id="pfEditLog" style={s("display:none;margin-top:14px")}>
                <div className="card" style={s("padding:14px")}>
                  <div
                    style={s(
                      "font-size:13px;font-weight:700;color:var(--header);margin-bottom:10px;display:flex;align-items:center;gap:6px",
                    )}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--amber)"
                      strokeWidth="2"
                      style={s("width:14px;height:14px")}
                    >
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    <span data-en="Manual Edit Log" data-zh="手动修改记录">
                      Manual Edit Log
                    </span>
                  </div>
                  <div
                    id="pfEditLogList"
                    style={s(
                      "display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto",
                    )}
                  ></div>
                </div>
              </div>
            </div>

            {/* ======== Sub-tab Panel: Closing Costs ======== */}
            <div id="pfsp-pf-closing" style={s("display:none")}>
              <div
                className="card"
                style={s("padding:0;overflow:hidden;margin-bottom:var(--gap)")}
              >
                <div
                  style={s(
                    "padding:10px 16px;border-bottom:1px solid var(--border);background:rgba(0,0,0,0.02)",
                  )}
                >
                  <span
                    style={s(
                      "font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)",
                    )}
                  >
                    Closing Costs
                  </span>
                </div>
                <table className="pf-data-table">
                  <tbody>
                    <tr className="pf-sec">
                      <td>Category</td>
                      <td className="pct-col">%</td>
                      <td className="amount-col">AMOUNT</td>
                      <td className="notes-col">NOTES</td>
                    </tr>

                    {/* 1. Due Diligence (Sage Green) */}
                    <tr className="pf-grp">
                      <td
                        colSpan="4"
                        style={s(
                          "padding:8px 14px;background:rgba(106,142,107,0.12);font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#4a7c4b;border-top:1px solid rgba(106,142,107,0.25);text-align:left",
                        )}
                      >
                        Due Diligence
                      </td>
                    </tr>
                    <tr className="grp-dd">
                      <td>Due Diligence</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr className="grp-dd">
                      <td>Appraisal</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr className="grp-dd">
                      <td>Environmental &amp; PCA</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr className="grp-dd">
                      <td>Survey Fee</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr className="grp-dd">
                      <td>Insurance Review</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr className="grp-dd">
                      <td>Abstract and Title Charges besides Insurance</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>

                    {/* 2. Lender Costs (Slate Blue) */}
                    <tr className="pf-grp">
                      <td
                        colSpan="4"
                        style={s(
                          "padding:8px 14px;background:rgba(90,122,153,0.12);font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#3a5a7a;border-top:1px solid rgba(90,122,153,0.25);text-align:left",
                        )}
                      >
                        Lender Costs
                      </td>
                    </tr>
                    <tr className="grp-lender">
                      <td>Origination Fee &amp; Lender Fees</td>
                      <td className="pct-col">
                        <input
                          id="ccOrigFeePct"
                          className="pct-input"
                          defaultValue=""
                          placeholder="—"
                          onChange={() => window.recalcOriginationFee()}
                        />
                      </td>
                      <td
                        id="ccOrigFeeAmt"
                        className="amount-col"
                        data-editable
                      >
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable>
                        {"% \u00D7 New Loan Size (from Refinance Event)"}
                      </td>
                    </tr>
                    <tr className="grp-lender">
                      <td>Credit Reports Lender Charges</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr className="grp-lender">
                      <td>Legal</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr className="grp-lender">
                      <td>Commitment Fee</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr className="grp-lender">
                      <td>Title Insurance</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>

                    {/* 3. Transfer & Recording Taxes (Dusty Purple) */}
                    <tr className="pf-grp">
                      <td
                        colSpan="4"
                        style={s(
                          "padding:8px 14px;background:rgba(122,98,145,0.12);font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#5a4a73;border-top:1px solid rgba(122,98,145,0.25);text-align:left",
                        )}
                      >
                        Transfer &amp; Recording Taxes
                      </td>
                    </tr>
                    <tr className="grp-transfer">
                      <td>Transfer of Membership Transaction</td>
                      <td className="pct-col"></td>
                      <td className="amount-col">
                        <select
                          className="pct-input"
                          style={s("width:60px")}
                          defaultValue="1"
                        >
                          <option value="0">Yes</option>
                          <option value="1">No</option>
                        </select>
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr className="grp-transfer">
                      <td>County/State Transfer Tax</td>
                      <td className="pct-col">
                        <input
                          className="pct-input"
                          defaultValue=""
                          placeholder="—"
                        />
                      </td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable>
                        {"% \u00D7 Purchase Price"}
                      </td>
                    </tr>
                    <tr className="grp-transfer">
                      <td>Recordation Tax</td>
                      <td className="pct-col">
                        <input
                          className="pct-input"
                          defaultValue=""
                          placeholder="—"
                        />
                      </td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable>
                        {"% \u00D7 Purchase Price"}
                      </td>
                    </tr>
                    <tr className="grp-transfer">
                      <td>LLC Transfer-Related Fees</td>
                      <td className="pct-col">
                        <input className="pct-input" placeholder="—" />
                      </td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>

                    {/* 4. Acquisition Fees (Warm Amber) */}
                    <tr className="pf-grp">
                      <td
                        colSpan="4"
                        style={s(
                          "padding:8px 14px;background:rgba(160,120,74,0.12);font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#7a5a30;border-top:1px solid rgba(160,120,74,0.25);text-align:left",
                        )}
                      >
                        Acquisition Fees
                      </td>
                    </tr>
                    <tr className="grp-acq">
                      <td>Acquisition Fee</td>
                      <td className="pct-col">
                        <input
                          className="pct-input"
                          defaultValue=""
                          placeholder="—"
                        />
                      </td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable>
                        {"% \u00D7 Purchase Price"}
                      </td>
                    </tr>
                    <tr className="grp-acq">
                      <td>Closing</td>
                      <td className="pct-col">
                        <input className="pct-input" placeholder="—" />
                      </td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>

                    {/* 5. Reserves & Prepayments (Teal) */}
                    <tr className="pf-grp">
                      <td
                        colSpan="4"
                        style={s(
                          "padding:8px 14px;background:rgba(90,138,138,0.12);font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#3a6a6a;border-top:1px solid rgba(90,138,138,0.25);text-align:left",
                        )}
                      >
                        Reserves &amp; Prepayments
                      </td>
                    </tr>
                    <tr className="grp-reserve">
                      <td>Immediate Repairs</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr className="grp-reserve">
                      <td>Tax Reserve</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr className="grp-reserve">
                      <td>Insurance Reserve</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr className="grp-reserve">
                      <td>Prepaid Tax</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr className="grp-reserve">
                      <td>Property Insurance</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr className="grp-reserve">
                      <td>Interest Reserve</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr className="pf-hi grp-reserve">
                      <td>Cash Reserve</td>
                      <td className="pct-col">
                        <input className="pct-input" placeholder="—" />
                      </td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>

                    {/* 6. Other (Neutral Gray) */}
                    <tr className="pf-grp">
                      <td
                        colSpan="4"
                        style={s(
                          "padding:8px 14px;background:rgba(122,122,122,0.10);font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#666;border-top:1px solid rgba(122,122,122,0.20);text-align:left",
                        )}
                      >
                        Other
                      </td>
                    </tr>
                    <tr className="grp-other">
                      <td>Other</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>

                    {/* Totals */}
                    <tr className="pf-tot">
                      <td>Total Closing Costs</td>
                      <td className="pct-col"></td>
                      <td className="amount-col">{"—"}</td>
                      <td className="notes-col"></td>
                    </tr>
                    <tr
                      style={s(
                        "background:rgba(139,111,71,0.06);border-top:1px solid rgba(139,111,71,0.25);border-bottom:1px solid rgba(139,111,71,0.25)",
                      )}
                    >
                      <td
                        style={s(
                          "padding:8px 14px;font-size:11.5px;font-weight:700;color:#6B5435;letter-spacing:.04em;text-transform:uppercase",
                        )}
                        title="Closing Cost Ratio = Total Closing Costs / Purchase Price"
                      >
                        Closing Cost Ratio
                      </td>
                      <td className="pct-col"></td>
                      <td
                        className="amount-col"
                        style={s(
                          "font-size:11.5px;font-weight:700;color:#6B5435",
                        )}
                      >
                        {"—"}
                      </td>
                      <td
                        className="notes-col"
                        style={s(
                          "font-size:10px;color:var(--muted);font-style:italic",
                        )}
                      ></td>
                    </tr>
                    <tr
                      style={s(
                        "background:rgba(21,101,192,0.06);border-bottom:1px solid rgba(139,111,71,0.25)",
                      )}
                    >
                      <td
                        colSpan="4"
                        style={s(
                          "padding:8px 14px 10px 14px;font-size:11px;line-height:1.5;color:var(--body)",
                        )}
                      >
                        <span style={s("color:#1565C0;font-weight:700")}>
                          {"ⓘ"}
                        </span>{" "}
                        <span style={s("font-weight:600")}>
                          {
                            "Closing Cost Ratio = Total Closing Costs \u00F7 Purchase Price (As-is)."
                          }
                        </span>{" "}
                        {
                          "HelloData\u2019s market default for Closing Costs is "
                        }
                        <span style={s("font-weight:700;color:#1565C0")}>
                          {"—"}
                        </span>
                        {" of Purchase Price. Your computed ratio is "}
                        <span style={s("font-weight:700;color:#6B5435")}>
                          {"—"}
                        </span>
                        {" \u2014 "}
                        <span style={s("font-weight:700;color:#6B5435")}>
                          {"—"}
                        </span>
                        {
                          " above HD market. Common reasons for higher ratios: extensive due diligence, sponsor acquisition fee, large reserves, or LLC transfer / lender fee structure."
                        }
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ======== Sub-tab Panel: Purchase Price ======== */}
            <div id="pfsp-pf-purchase" style={s("display:none")}>
              <div
                className="card"
                style={s("padding:0;overflow:hidden;margin-bottom:var(--gap)")}
              >
                <div
                  style={s(
                    "padding:10px 16px;border-bottom:1px solid var(--border);background:rgba(0,0,0,0.02)",
                  )}
                >
                  <span
                    style={s(
                      "font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--blue)",
                    )}
                  >
                    Purchase Price
                  </span>
                </div>
                <table className="pf-data-table">
                  <tbody>
                    <tr className="pf-sec">
                      <td>Items</td>
                      <td className="amount-col">Amount</td>
                      <td className="notes-col">Notes</td>
                    </tr>
                    <tr>
                      <td>Purchase Price (As-is value)</td>
                      <td id="ppAsIsValue" className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr>
                      <td>Per Unit (Residential/Retail)</td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable>
                        {"Purchase Price \u00F7 Total Units"}
                      </td>
                    </tr>
                    <tr>
                      <td>NOI for Year 1</td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr>
                      <td>Cap Rate on 2026 Income</td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable>
                        {"NOI for Year 1 \u00F7 Purchase Price (As-is value)"}
                      </td>
                    </tr>
                    <tr>
                      <td>Closing Cost Percentage</td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable>
                        {
                          "Total Closing Costs (from Closing Costs) \u00F7 Purchase Price (As-is value)"
                        }
                      </td>
                    </tr>
                    <tr>
                      <td>Closing Costs</td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable>
                        Total Closing Costs (from Closing Costs)
                      </td>
                    </tr>
                    <tr>
                      <td>Total Acquisition Cost</td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable>
                        Closing Costs + Purchase Price (As-is value)
                      </td>
                    </tr>
                    <tr className="pf-tot">
                      <td>Total Cost (excludes capex)</td>
                      <td id="ppTotalCost" className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ======== Sub-tab Panel: Construction Equity ======== */}
            <div id="pfsp-pf-equity" style={s("display:none")}>
              <div
                className="card"
                style={s("padding:0;overflow:hidden;margin-bottom:var(--gap)")}
              >
                <div
                  style={s(
                    "padding:10px 16px;border-bottom:1px solid var(--border);background:rgba(0,0,0,0.02)",
                  )}
                >
                  <span
                    style={s(
                      "font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--amber)",
                    )}
                  >
                    Construction Equity
                  </span>
                </div>
                <table className="pf-data-table" id="ceTable">
                  <tbody>
                    <tr className="pf-sec">
                      <td>Items</td>
                      <td className="amount-col">Amount</td>
                      <td className="notes-col">Notes</td>
                    </tr>
                    <tr className="pf-hi">
                      <td>Acquisition Reserves</td>
                      <td
                        id="ceAcqReserves"
                        className="amount-col"
                        data-editable
                      >
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr>
                      <td>
                        Total <span id="ceY1Label">Year 1</span> Distribution
                        Reserves
                      </td>
                      <td id="ceY1DistRes" className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr>
                      <td>Refinance Reserves</td>
                      <td
                        id="ceRefiReserves"
                        className="amount-col"
                        data-editable
                      >
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr>
                      <td>Reserve for Unit Upgrades</td>
                      <td id="ceUnitUpgrades" className="amount-col">
                        {"—"}
                      </td>
                      <td className="notes-col">From Refinance Event table</td>
                    </tr>
                    <tr>
                      <td>
                        Total <span id="ceY1Y5Label">Year 1 – Year 5</span>{" "}
                        Reserves
                      </td>
                      <td id="ceY1Y5Res" className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr className="pf-tot">
                      <td>Total Capex Reserves</td>
                      <td id="ceTotal" className="amount-col">
                        {"—"}
                      </td>
                      <td className="notes-col"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ======== Sub-tab Panel: Sale Event ======== */}
            <div id="pfsp-pf-sale" style={s("display:none")}>
              <div style={s("padding:12px 0 0")}>
                <button
                  className="pf-subtab2 pf-subtab-active"
                  id="pfst2-se-reg"
                >
                  Regular Sale
                </button>
                <button className="pf-subtab2" id="pfst2-se-ref">
                  After Refinance
                </button>
              </div>

              {/* Regular Sale */}
              <div id="pfsp2-se-reg">
                <div
                  className="card"
                  style={s(
                    "padding:0;overflow:hidden;margin-bottom:var(--gap)",
                  )}
                >
                  <div
                    style={s(
                      "padding:10px 16px;border-bottom:1px solid var(--border);background:rgba(0,0,0,0.02)",
                    )}
                  >
                    <span
                      style={s(
                        "font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)",
                      )}
                    >
                      {"Sale Event \u2014 Regular"}
                    </span>
                  </div>
                  <table className="pf-data-table">
                    <tbody>
                      <tr className="pf-sec">
                        <td>SALE EVENT (regular)</td>
                        <td className="pct-col">%</td>
                        <td className="amount-col">Amount</td>
                        <td className="notes-col">Notes</td>
                      </tr>
                      <tr>
                        <td>Year of Sale</td>
                        <td className="pct-col"></td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable></td>
                      </tr>
                      <tr>
                        <td>Date</td>
                        <td className="pct-col"></td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable></td>
                      </tr>
                      <tr>
                        <td>NOI of that Year</td>
                        <td className="pct-col"></td>
                        <td id="seRegNOI" className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          {"From Net Operating Income \u00B7 matching year"}
                        </td>
                      </tr>
                      <tr>
                        <td>Cap Rate</td>
                        <td className="pct-col"></td>
                        <td
                          id="seRegCapRate"
                          className="amount-col"
                          data-editable
                        >
                          {"—"}{" "}
                          <span
                            style={s(
                              "font-size:8px;font-weight:700;letter-spacing:.04em;border-radius:3px;padding:1px 5px;color:#1565C0;background:rgba(21,101,192,0.08);margin-left:4px",
                            )}
                          >
                            HD
                          </span>
                        </td>
                        <td className="notes-col" data-editable>
                          Going-in Cap Rate (from HelloData)
                        </td>
                      </tr>
                      <tr>
                        <td>Value of Property</td>
                        <td className="pct-col"></td>
                        <td className="amount-col">
                          <select
                            id="seRegVopSrc"
                            className="pct-input"
                            style={s(
                              "width:auto;font-size:10.5px;margin-right:6px;text-align:left",
                            )}
                            onChange={() => window.updateSeRegValueOfProperty()}
                          >
                            <option value="hd">HD (HelloData)</option>
                            <option value="computed">
                              {"NOI of that Year \u00F7 Cap Rate"}
                            </option>
                          </select>
                          <span id="seRegVopValue">{"—"}</span>
                          <span
                            id="seRegVopBadge"
                            style={s(
                              "font-size:8px;font-weight:700;letter-spacing:.04em;border-radius:3px;padding:1px 5px;color:#1565C0;background:rgba(21,101,192,0.08);margin-left:4px",
                            )}
                          >
                            HD
                          </span>
                        </td>
                        <td className="notes-col" data-editable></td>
                      </tr>
                      <tr>
                        <td>Cost of Sale</td>
                        <td className="pct-col">
                          <input className="pct-input" placeholder="—" />
                        </td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          {"% \u00D7 Value of Property"}
                        </td>
                      </tr>
                      <tr>
                        <td>Loan of that Year (Beg of Year)</td>
                        <td className="pct-col"></td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable></td>
                      </tr>
                      <tr>
                        <td>Capital Transaction Fee to Sponsor</td>
                        <td className="pct-col">
                          <input className="pct-input" placeholder="—" />
                        </td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          {"% \u00D7 Value of Property"}
                        </td>
                      </tr>
                      <tr className="pf-hi">
                        <td>Final Proceeds from Sale</td>
                        <td className="pct-col"></td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          {
                            "Value of Property \u2212 Cost of Sale \u2212 Loan of that Year \u2212 Capital Transaction Fee to Sponsor"
                          }
                        </td>
                      </tr>
                      <tr>
                        <td>Req return of capital to investors</td>
                        <td className="pct-col"></td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable></td>
                      </tr>
                      <tr>
                        <td>Excess avail after return of capital</td>
                        <td className="pct-col"></td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          {
                            "MAX(Final Proceeds from Sale \u2212 Req return of capital to investors, 0)"
                          }
                        </td>
                      </tr>
                      <tr>
                        <td>Investor</td>
                        <td className="pct-col">
                          <input className="pct-input" placeholder="—" />
                        </td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          {"Excess avail after return of capital \u00D7 %"}
                        </td>
                      </tr>
                      <tr>
                        <td>Sponsor</td>
                        <td className="pct-col">
                          <input className="pct-input" placeholder="—" />
                        </td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          {"Excess avail after return of capital \u00D7 %"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* After Refinance Sale */}
              <div id="pfsp2-se-ref" style={s("display:none")}>
                <div
                  className="card"
                  style={s(
                    "padding:0;overflow:hidden;margin-bottom:var(--gap)",
                  )}
                >
                  <div
                    style={s(
                      "padding:10px 16px;border-bottom:1px solid var(--border);background:rgba(0,0,0,0.02)",
                    )}
                  >
                    <span
                      style={s(
                        "font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--blue)",
                      )}
                    >
                      {"Sale Event \u2014 After Refinance"}
                    </span>
                  </div>
                  <table className="pf-data-table">
                    <tbody>
                      <tr className="pf-sec">
                        <td>SALE EVENT After Refinance</td>
                        <td className="pct-col">%</td>
                        <td className="amount-col">Amount</td>
                        <td className="notes-col">Notes</td>
                      </tr>
                      <tr>
                        <td>Year of Sale</td>
                        <td className="pct-col"></td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable></td>
                      </tr>
                      <tr>
                        <td>Date</td>
                        <td className="pct-col"></td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable></td>
                      </tr>
                      <tr>
                        <td>NOI of that Year</td>
                        <td className="pct-col"></td>
                        <td id="seRefNOI" className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          {"From Net Operating Income \u00B7 matching year"}
                        </td>
                      </tr>
                      <tr>
                        <td>Cap Rate</td>
                        <td className="pct-col"></td>
                        <td
                          id="seRefCapRate"
                          className="amount-col"
                          data-editable
                        >
                          {"—"}{" "}
                          <span
                            style={s(
                              "font-size:8px;font-weight:700;letter-spacing:.04em;border-radius:3px;padding:1px 5px;color:#1565C0;background:rgba(21,101,192,0.08);margin-left:4px",
                            )}
                          >
                            HD
                          </span>
                        </td>
                        <td className="notes-col" data-editable>
                          Exit Cap Rate (from HelloData)
                        </td>
                      </tr>
                      <tr>
                        <td>Value of Property</td>
                        <td className="pct-col"></td>
                        <td className="amount-col">
                          <select
                            id="seRefVopSrc"
                            className="pct-input"
                            style={s(
                              "width:auto;font-size:10.5px;margin-right:6px;text-align:left",
                            )}
                            onChange={() => window.updateSeRefValueOfProperty()}
                          >
                            <option value="hd">HD (HelloData)</option>
                            <option value="computed">
                              {"NOI of that Year \u00F7 Cap Rate"}
                            </option>
                          </select>
                          <span id="seRefVopValue">{"—"}</span>
                          <span
                            id="seRefVopBadge"
                            style={s(
                              "font-size:8px;font-weight:700;letter-spacing:.04em;border-radius:3px;padding:1px 5px;color:#1565C0;background:rgba(21,101,192,0.08);margin-left:4px",
                            )}
                          >
                            HD
                          </span>
                        </td>
                        <td className="notes-col" data-editable></td>
                      </tr>
                      <tr>
                        <td>Cost of Sale</td>
                        <td className="pct-col">
                          <input className="pct-input" placeholder="—" />
                        </td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          {"% \u00D7 Value of Property"}
                        </td>
                      </tr>
                      <tr>
                        <td>Loan of that Year (Beg of OCT)</td>
                        <td className="pct-col"></td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable></td>
                      </tr>
                      <tr>
                        <td>Capital Transaction Fee to Sponsor</td>
                        <td className="pct-col">
                          <input className="pct-input" placeholder="—" />
                        </td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          {"% \u00D7 Value of Property"}
                        </td>
                      </tr>
                      <tr className="pf-hi">
                        <td>Final Proceeds from Sale</td>
                        <td className="pct-col"></td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          Value of Property-Cost of sale-Loan of that Year (Beg
                          of Year)-Capital Transaction Fee to Sponsor
                        </td>
                      </tr>
                      <tr>
                        <td>Return of Capital</td>
                        <td className="pct-col"></td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable></td>
                      </tr>
                      <tr>
                        <td>Excess avail after return of capital</td>
                        <td className="pct-col"></td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          Final Proceeds from Sale-Return of Capital
                        </td>
                      </tr>
                      <tr>
                        <td>Investor Profit</td>
                        <td className="pct-col">
                          <input className="pct-input" placeholder="—" />
                        </td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          {"Excess avail after return of capital \u00D7 %"}
                        </td>
                      </tr>
                      <tr>
                        <td>Sponsor</td>
                        <td className="pct-col">
                          <input className="pct-input" placeholder="—" />
                        </td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          Excess avail after return of capital-Investor Profit
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ======== Sub-tab Panel: Equity Required ======== */}
            <div id="pfsp-pf-eqreq" style={s("display:none")}>
              <div style={s("padding:12px 0 0")}>
                <button
                  className="pf-subtab2 pf-subtab-active"
                  id="pfst2-eq-reg"
                >
                  Regular
                </button>
                <button className="pf-subtab2" id="pfst2-eq-ref">
                  Refinance
                </button>
              </div>

              {/* Regular */}
              <div id="pfsp2-eq-reg">
                <div
                  className="card"
                  style={s(
                    "padding:0;overflow:hidden;margin-bottom:var(--gap)",
                  )}
                >
                  <div
                    style={s(
                      "padding:10px 16px;border-bottom:1px solid var(--border);background:rgba(0,0,0,0.02)",
                    )}
                  >
                    <span
                      style={s(
                        "font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--green)",
                      )}
                    >
                      {"Equity Required \u2014 Regular"}
                    </span>
                  </div>
                  <table className="pf-data-table">
                    <tbody>
                      <tr className="pf-sec">
                        <td>EQUITY REQUIRED (regular)</td>
                        <td className="pct-col">%</td>
                        <td className="amount-col">Amount</td>
                        <td className="notes-col">Notes</td>
                      </tr>
                      <tr>
                        <td>Loan to Cost</td>
                        <td className="pct-col">
                          <span
                            id="eqRegLtcPct"
                            style={s(
                              "font-size:12px;color:var(--body);font-weight:600",
                            )}
                          >
                            {"—"}
                          </span>
                        </td>
                        <td
                          id="eqRegLtcAmt"
                          className="amount-col"
                          data-editable
                        >
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          {
                            "Amount = New Loan Size (from Refinance Event) \u00B7 % = Amount \u00F7 Total Cost (excludes capex)"
                          }
                        </td>
                      </tr>
                      <tr>
                        <td>Equity</td>
                        <td className="pct-col">
                          <span
                            id="eqRegEqPct"
                            style={s(
                              "font-size:12px;color:var(--body);font-weight:600",
                            )}
                          >
                            {"—"}
                          </span>
                        </td>
                        <td
                          id="eqRegEqAmt"
                          className="amount-col"
                          data-editable
                        >
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          {
                            "Amount = manual input \u00B7 % = 1 \u2212 Loan to Cost %"
                          }
                        </td>
                      </tr>
                      <tr className="pf-hi">
                        <td>LTPP</td>
                        <td className="pct-col">
                          <span
                            id="eqRegLtppPct"
                            style={s(
                              "font-size:12px;color:var(--body);font-weight:600",
                            )}
                          >
                            {"—"}
                          </span>
                        </td>
                        <td
                          id="eqRegLtppAmt"
                          className="amount-col"
                          data-editable
                        >
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          {
                            "Amount = Loan to Cost \u00B7 % = LTPP \u00F7 Purchase Price (As-is value)"
                          }
                        </td>
                      </tr>
                      <tr className="pf-tot">
                        <td>Cash to Close</td>
                        <td className="pct-col"></td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          {
                            "Total Acquisition Cost \u2212 Loan to Cost \u2212 Acquisition Fee (from Closing Costs)"
                          }
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Refinance */}
              <div id="pfsp2-eq-ref" style={s("display:none")}>
                <div
                  className="card"
                  style={s(
                    "padding:0;overflow:hidden;margin-bottom:var(--gap)",
                  )}
                >
                  <div
                    style={s(
                      "padding:10px 16px;border-bottom:1px solid var(--border);background:rgba(0,0,0,0.02)",
                    )}
                  >
                    <span
                      style={s(
                        "font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--blue)",
                      )}
                    >
                      {"Equity Required \u2014 Refinance"}
                    </span>
                  </div>
                  <table className="pf-data-table">
                    <tbody>
                      <tr className="pf-sec">
                        <td>EQUITY REQUIRED (refin)</td>
                        <td className="pct-col">%</td>
                        <td className="amount-col">Amount</td>
                        <td className="notes-col">Notes</td>
                      </tr>
                      <tr>
                        <td>I/O Payment</td>
                        <td className="pct-col">
                          <input className="pct-input" placeholder="—" />
                        </td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          {"Amount = Loan to Cost \u00D7 %"}
                        </td>
                      </tr>
                      <tr className="pf-hi">
                        <td>Loan to Cost %</td>
                        <td className="pct-col">
                          <span
                            id="eqRefLtcPct"
                            style={s(
                              "font-size:12px;color:var(--body);font-weight:600",
                            )}
                          >
                            {"—"}
                          </span>
                        </td>
                        <td
                          id="eqRefLtcAmt"
                          className="amount-col"
                          data-editable
                        >
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          {
                            "Amount = LTPP \u00B7 % = Loan to Cost \u00F7 Total Cost (excludes capex)"
                          }
                        </td>
                      </tr>
                      <tr>
                        <td>Equity</td>
                        <td className="pct-col">
                          <span
                            id="eqRefEqPct"
                            style={s(
                              "font-size:12px;color:var(--body);font-weight:600",
                            )}
                          >
                            {"—"}
                          </span>
                        </td>
                        <td
                          id="eqRefEqAmt"
                          className="amount-col"
                          data-editable
                        >
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          {
                            "Amount = % \u00D7 Total Cost (excludes capex) \u00B7 % = 1 \u2212 Loan to Cost %"
                          }
                        </td>
                      </tr>
                      <tr>
                        <td>LTPP</td>
                        <td className="pct-col">
                          <span
                            id="eqRefLtppPct"
                            style={s(
                              "font-size:12px;color:var(--body);font-weight:600",
                            )}
                          >
                            {"—"}
                          </span>
                        </td>
                        <td
                          id="eqRefLtppAmt"
                          className="amount-col"
                          data-editable
                        >
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          {
                            "Amount = LTPP (from Equity Required \u2014 Regular) \u00B7 % = Loan to Cost \u00F7 Purchase Price (As-is value)"
                          }
                        </td>
                      </tr>
                      <tr className="pf-tot">
                        <td>Cash to Close</td>
                        <td className="pct-col"></td>
                        <td className="amount-col" data-editable>
                          {"—"}
                        </td>
                        <td className="notes-col" data-editable>
                          {
                            "Total Cost (excludes capex) \u2212 Loan to Cost \u2212 Acquisition Reserves (from Construction Equity)"
                          }
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ======== Sub-tab Panel: Refinance Event ======== */}
            <div id="pfsp-pf-refi" style={s("display:none")}>
              <div
                className="card"
                style={s("padding:0;overflow:hidden;margin-bottom:var(--gap)")}
              >
                <div
                  style={s(
                    "padding:10px 16px;border-bottom:1px solid var(--border);background:rgba(0,0,0,0.02)",
                  )}
                >
                  <span
                    style={s(
                      "font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--blue)",
                    )}
                  >
                    Refinance Event
                  </span>
                </div>
                <table className="pf-data-table">
                  <tbody>
                    <tr className="pf-sec">
                      <td>Refinance EVENT</td>
                      <td className="pct-col">%</td>
                      <td className="amount-col">AMOUNT</td>
                      <td className="notes-col">NOTES</td>
                    </tr>
                    <tr>
                      <td>Year of Refinance</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr>
                      <td>Date</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr>
                      <td>NOI of that Year</td>
                      <td className="pct-col"></td>
                      <td id="refiNOI" className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr>
                      <td>Cap Rate</td>
                      <td className="pct-col"></td>
                      <td id="refiCapRate" className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr>
                      <td>Value of Property</td>
                      <td className="pct-col"></td>
                      <td
                        id="refiValueOfProperty"
                        className="amount-col"
                        data-editable
                      >
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable>
                        {"NOI of that Year \u00F7 Cap Rate"}
                      </td>
                    </tr>
                    <tr>
                      <td>New Loan Size</td>
                      <td className="pct-col">
                        <span
                          id="refiNewLoanSizePct"
                          style={s(
                            "font-size:12px;color:var(--body);font-weight:600",
                          )}
                        >
                          {"—"}
                        </span>
                      </td>
                      <td
                        id="refiNewLoanSize"
                        className="amount-col"
                        data-editable
                        onInput={() => window.recalcOriginationFee()}
                      >
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable>
                        {"% \u00D7 Value of Property"}
                      </td>
                    </tr>
                    <tr>
                      <td>Cost of Refinance</td>
                      <td className="pct-col">
                        <span
                          id="refiCostPct"
                          style={s(
                            "font-size:12px;color:var(--body);font-weight:600",
                          )}
                        >
                          {"—"}
                        </span>
                      </td>
                      <td id="refiCostAmt" className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable>
                        {"% \u00D7 Value of Property"}
                      </td>
                    </tr>
                    <tr>
                      <td>Loan of that Year (End of Year)</td>
                      <td className="pct-col"></td>
                      <td
                        id="refiLoanEndYear"
                        className="amount-col"
                        data-editable
                      >
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr>
                      <td>Yield Maintenance/Prepay</td>
                      <td className="pct-col">
                        <span
                          id="refiYieldPct"
                          style={s(
                            "font-size:12px;color:var(--body);font-weight:600",
                          )}
                        >
                          {"—"}
                        </span>
                      </td>
                      <td
                        id="refiYieldAmt"
                        className="amount-col"
                        data-editable
                      >
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable>
                        {"% \u00D7 Loan of that Year (End of Year)"}
                      </td>
                    </tr>
                    <tr className="pf-hi">
                      <td>Final Proceeds from Refinance</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable>
                        {
                          "New Loan Size \u2212 Cost of Refinance \u2212 Loan of that Year (End of Year) \u2212 Yield Maintenance/Prepay"
                        }
                      </td>
                    </tr>
                    <tr>
                      <td>Reserve for Unit Upgrades</td>
                      <td className="pct-col"></td>
                      <td
                        id="refiResUnitUpgrades"
                        className="amount-col"
                        data-editable
                      >
                        {"—"}
                      </td>
                      <td className="notes-col" data-editable></td>
                    </tr>
                    <tr className="pf-tot">
                      <td>Total Distribution</td>
                      <td className="pct-col"></td>
                      <td className="amount-col" data-editable>
                        {"—"}
                      </td>
                      <td className="notes-col">
                        {
                          "Final Proceeds from Refinance \u2212 Reserve for Unit Upgrades"
                        }
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ======== Sub-tab Panel: Tax Assessment ======== */}
            <div id="pfsp-pf-tax" style={s("display:none")}>
              {/* Section 1: Current Tax Assessment */}
              <div
                className="card"
                style={s("padding:0;overflow:hidden;margin-bottom:var(--gap)")}
              >
                <div
                  style={s(
                    "padding:12px 18px;border-bottom:1px solid var(--border);background:rgba(74,101,133,0.05)",
                  )}
                >
                  <span
                    style={s(
                      "font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--blue)",
                    )}
                  >
                    Current Tax Assessment
                  </span>
                </div>
                <div
                  style={s(
                    "padding:16px 18px;display:flex;flex-direction:column;gap:0",
                  )}
                  id="taxCurrentSection"
                >
                  {/* rows injected by JS */}
                </div>
              </div>

              {/* Section 2: Post-Acquisition Projection */}
              <div
                className="card"
                style={s("padding:0;overflow:hidden;margin-bottom:var(--gap)")}
              >
                <div
                  style={s(
                    "padding:12px 18px;border-bottom:1px solid var(--border);background:rgba(74,101,133,0.05)",
                  )}
                >
                  <span
                    style={s(
                      "font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--blue)",
                    )}
                  >
                    Post-Acquisition Projection
                  </span>
                </div>
                <div
                  style={s(
                    "padding:16px 18px;display:flex;flex-direction:column;gap:0",
                  )}
                  id="taxProjectedSection"
                >
                  {/* rows injected by JS */}
                </div>
                {/* Tax increase alert bar */}
                <div
                  id="taxIncreaseBar"
                  style={s(
                    "display:none;padding:10px 18px;border-top:1px solid rgba(217,119,6,0.2);background:rgba(217,119,6,0.06);font-size:12px;font-weight:700;color:#92400e",
                  )}
                ></div>
              </div>

              {/* Section 3: Multi-Year Projection */}
              <div
                className="card"
                style={s("padding:0;overflow:hidden;margin-bottom:var(--gap)")}
              >
                <div
                  style={s(
                    "padding:12px 18px;border-bottom:1px solid var(--border);background:rgba(74,101,133,0.05)",
                  )}
                >
                  <span
                    style={s(
                      "font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--blue)",
                    )}
                  >
                    Multi-Year Projection
                  </span>
                </div>
                <div style={s("padding:16px 18px")} id="taxEscalationRow">
                  {/* escalation rate input injected by JS */}
                </div>
                <div style={s("overflow-x:auto")}>
                  <table
                    style={s(
                      "width:100%;border-collapse:collapse;font-size:12px",
                    )}
                  >
                    <thead>
                      <tr
                        style={s(
                          "background:rgba(74,101,133,0.07);border-bottom:2px solid rgba(74,101,133,0.2)",
                        )}
                        id="taxYearHead"
                      ></tr>
                    </thead>
                    <tbody>
                      <tr
                        id="taxYearRow"
                        style={s("border-bottom:1px solid var(--border)")}
                      ></tr>
                      <tr
                        id="taxYearPerUnitRow"
                        style={s("background:rgba(0,0,0,0.02)")}
                      ></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary strip card */}
              <div className="card" style={s("padding:0;overflow:hidden")}>
                <div
                  style={s(
                    "padding:14px 18px;display:flex;gap:28px;flex-wrap:wrap;align-items:flex-end",
                  )}
                >
                  <div style={s("display:flex;flex-direction:column;gap:2px")}>
                    <div
                      style={s(
                        "font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em",
                      )}
                    >
                      Current Annual Tax
                    </div>
                    <div
                      id="taxSumCurrent"
                      style={s(
                        "font-size:16px;font-weight:800;color:var(--header)",
                      )}
                    >
                      {"—"}
                    </div>
                  </div>
                  <div style={s("display:flex;flex-direction:column;gap:2px")}>
                    <div
                      style={s(
                        "font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em",
                      )}
                    >
                      Projected Annual Tax
                    </div>
                    <div
                      id="taxSumProjected"
                      style={s(
                        "font-size:16px;font-weight:800;color:var(--blue)",
                      )}
                    >
                      {"—"}
                    </div>
                  </div>
                  <div style={s("display:flex;flex-direction:column;gap:2px")}>
                    <div
                      style={s(
                        "font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em",
                      )}
                    >
                      Increase
                    </div>
                    <div
                      id="taxSumIncrease"
                      style={s("font-size:16px;font-weight:800;color:#d97706")}
                    >
                      {"—"}
                    </div>
                  </div>
                  <div style={s("display:flex;flex-direction:column;gap:2px")}>
                    <div
                      style={s(
                        "font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em",
                      )}
                    >
                      Projected Tax / Unit
                    </div>
                    <div
                      id="taxSumPerUnit"
                      style={s(
                        "font-size:16px;font-weight:800;color:var(--blue)",
                      )}
                    >
                      {"—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ======== Sub-tab Panel: Waterfall Distributions ======== */}
            <div id="pfsp-pf-waterfall" style={s("display:none")}>
              {/* Waterfall Template Picker card */}
              <div
                className="card"
                style={s("margin-bottom:var(--gap);padding:14px 18px")}
              >
                <div
                  style={s(
                    "display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:10px",
                  )}
                >
                  <label
                    htmlFor="wfTemplate"
                    style={s(
                      "font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em",
                    )}
                  >
                    Waterfall Template
                  </label>
                  <select
                    id="wfTemplate"
                    className="pct-input"
                    style={s(
                      "width:auto;min-width:240px;font-size:12px;text-align:left",
                    )}
                    defaultValue="simple"
                    onChange={() => window.renderWfTemplate()}
                  >
                    <option value="straight">
                      1. Straight Split (no pref)
                    </option>
                    <option value="simple">2. Simple Pref + Promote</option>
                    <option value="two-tier">3. Two-Tier IRR Hurdle</option>
                    <option value="three-tier">4. Three-Tier IRR Hurdle</option>
                  </select>
                  <span
                    id="wfTemplateDesc"
                    style={s(
                      "font-size:11px;color:var(--muted);font-style:italic;flex:1",
                    )}
                  ></span>
                </div>
                <div
                  id="wfParams"
                  style={s(
                    "display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end;padding-top:6px;border-top:1px solid var(--border)",
                  )}
                ></div>
              </div>

              {/* Waterfall Distributions card */}
              <div
                className="card"
                style={s("padding:0;overflow:hidden;margin-bottom:var(--gap)")}
              >
                <div
                  style={s(
                    "padding:10px 16px;border-bottom:1px solid var(--border);background:rgba(74,101,133,0.07)",
                  )}
                >
                  <div
                    style={s(
                      "font-size:10px;color:var(--muted);font-weight:600;margin-bottom:2px",
                    )}
                  >
                    {"Refinance \u2013 9 year sale"}
                  </div>
                  <span
                    style={s(
                      "font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--blue)",
                    )}
                  >
                    {"Waterfall Distributions \u2014 Investors"}
                  </span>
                  <span
                    id="wfActiveTemplateBadge"
                    style={s(
                      "margin-left:10px;font-size:9px;font-weight:700;letter-spacing:.04em;border-radius:3px;padding:2px 7px;color:#3a5a7a;background:rgba(90,122,153,0.14);vertical-align:middle",
                    )}
                  >
                    Template: Simple Pref + Promote
                  </span>
                </div>
                <div style={s("overflow-x:auto")}>
                  <table
                    style={s(
                      "width:100%;border-collapse:collapse;font-size:12px;min-width:900px",
                    )}
                  >
                    <thead id="wfHead"></thead>
                    <tbody id="wfBody"></tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          {/* /pfContent */}
        </div>
      </div>
      {/* /proj-tab-proforma */}

      {/* ============================================================ */}
      {/* RENT ROLL TAB                                                */}
      {/* ============================================================ */}
      <div
        id="proj-tab-rentroll"
        className="proj-tab-content"
        style={s("display:none")}
      >
        <div style={s("margin-top:var(--gap)")}>
          {/* Rent Roll Header Card */}
          <div className="card" style={s("margin-bottom:16px")}>
            <div
              style={s(
                "display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px",
              )}
            >
              <div style={s("display:flex;align-items:center;gap:14px")}>
                <div
                  style={s(
                    "width:46px;height:46px;border-radius:12px;background:rgba(74,101,133,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0",
                  )}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--blue)"
                    strokeWidth="1.8"
                    style={s("width:22px;height:22px")}
                  >
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <div>
                  <div
                    style={s(
                      "font-size:16px;font-weight:800;color:var(--header)",
                    )}
                    data-en="Rent Roll — Unit Lease Data"
                    data-zh="租户清单 — 逐套租约数据"
                  >
                    {"Rent Roll \u2014 Unit Lease Data"}
                  </div>
                  <div
                    id="rrFileInfo"
                    style={s(
                      "font-size:12px;color:var(--muted);margin-top:3px",
                    )}
                    data-en="No file uploaded · Single file only"
                    data-zh="未上传文件 · 仅限一个文件"
                  >
                    {"No file uploaded \u00B7 Single file only"}
                  </div>
                </div>
              </div>
              <div style={s("display:flex;gap:8px;align-items:center")}>
                <button className="btn btn-secondary btn-sm" id="rrUploadBtn">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={s("width:13px;height:13px")}
                  >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span
                    id="rrUploadBtnLabel"
                    data-en="Upload Rent Roll"
                    data-zh="上传租户清单"
                  >
                    Upload Rent Roll
                  </span>
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  id="rrDeleteBtn"
                  style={s("display:none;color:var(--red,#c0392b)")}
                  title="Remove"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={s("width:13px;height:13px")}
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                </button>
                <input
                  type="file"
                  id="rrInput"
                  accept=".xlsx,.xls,.csv,.pdf"
                  style={s("display:none")}
                  onChange={(e) => window.handleRRUpload(e)}
                />
              </div>
            </div>
            {/* Drop zone */}
            <div
              id="rrDropZone"
              style={s(
                "margin-top:16px;border:2px dashed var(--border);border-radius:10px;padding:32px;text-align:center;cursor:pointer;transition:border-color .2s",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = "var(--blue)";
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = "var(--border)";
                window.handleRRDrop(e);
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--blue)"
                strokeWidth="1.4"
                style={s(
                  "width:36px;height:36px;margin:0 auto 10px;display:block",
                )}
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <div
                style={s(
                  "font-size:13px;font-weight:600;color:var(--header);margin-bottom:4px",
                )}
                data-en="Drop Rent Roll file here"
                data-zh="拖拽租户清单文件到此"
              >
                Drop Rent Roll file here
              </div>
              <div style={s("font-size:11px;color:var(--muted)")}>
                .xlsx · .xls · .csv · .pdf · Max 1 file
              </div>
            </div>
          </div>
          {/* Rent Roll Parsed Content */}
          <div id="rrParsedContent" style={s("display:none")}></div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* HELLODATA TAB                                                */}
      {/* ============================================================ */}
      <div
        id="proj-tab-hellodata"
        className="proj-tab-content"
        style={s("display:none")}
      >
        <div style={s("margin-top:var(--gap)")}>
          {/* HelloData Header Card */}
          <div className="card" style={s("margin-bottom:16px")}>
            <div
              style={s(
                "display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px",
              )}
            >
              <div style={s("display:flex;align-items:center;gap:14px")}>
                <div
                  style={s(
                    "width:46px;height:46px;border-radius:12px;background:rgba(166,124,82,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0",
                  )}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#a67c52"
                    strokeWidth="1.8"
                    style={s("width:22px;height:22px")}
                  >
                    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                </div>
                <div>
                  <div
                    style={s(
                      "font-size:16px;font-weight:800;color:var(--header)",
                    )}
                    data-en="HelloData — Market Benchmark"
                    data-zh="HelloData — 市场基准数据"
                  >
                    {"HelloData \u2014 Market Benchmark"}
                  </div>
                  <div
                    id="hdFileInfo"
                    style={s(
                      "font-size:12px;color:var(--muted);margin-top:3px",
                    )}
                    data-en="No file uploaded · Async export (.xlsx)"
                    data-zh="未上传文件 · 异步导出数据集(.xlsx)"
                  >
                    {"No file uploaded \u00B7 Async export (.xlsx)"}
                  </div>
                </div>
              </div>
              <div style={s("display:flex;gap:8px;align-items:center")}>
                <button
                  className="btn btn-secondary btn-sm"
                  id="hdUploadBtn"
                  onClick={() => document.getElementById("hdFileInput").click()}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={s("width:13px;height:13px")}
                  >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span
                    id="hdUploadBtnLabel"
                    data-en="Upload HelloData"
                    data-zh="上传HelloData"
                  >
                    Upload HelloData
                  </span>
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  id="hdDeleteBtn"
                  style={s("display:none;color:var(--red,#c0392b)")}
                  title="Remove"
                  onClick={() => window.clearHDData()}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={s("width:13px;height:13px")}
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                </button>
                <input
                  type="file"
                  id="hdFileInput"
                  accept=".xlsx"
                  style={s("display:none")}
                  onChange={(e) => window.handleHDUpload(e)}
                />
              </div>
            </div>
            {/* Period hint based on Acquisition Year */}
            <div
              id="hdPeriodHint"
              style={s(
                "margin-top:12px;font-size:11px;color:#1565C0;padding:6px 10px;background:rgba(21,101,192,0.06);border-left:2px solid rgba(21,101,192,0.4);border-radius:0 4px 4px 0",
              )}
            >
              <strong>Expected period:</strong>{" "}
              {
                "Current snapshot from AY\u22121 (year before acquisition). HD reports market benchmarks as-of the export date."
              }
            </div>
            {/* Drop zone */}
            <div
              id="hdDropZone"
              style={s(
                "margin-top:12px;border:2px dashed var(--border);border-radius:10px;padding:32px;text-align:center;cursor:pointer;transition:border-color .2s",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = "#a67c52";
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = "var(--border)";
                window.handleHDDrop(e);
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#a67c52"
                strokeWidth="1.4"
                style={s(
                  "width:36px;height:36px;margin:0 auto 10px;display:block",
                )}
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <div
                style={s(
                  "font-size:13px;font-weight:600;color:var(--header);margin-bottom:4px",
                )}
                data-en="Drop HelloData export here"
                data-zh="拖拽HelloData导出文件到此"
              >
                Drop HelloData export here
              </div>
              <div style={s("font-size:11px;color:var(--muted)")}>
                .xlsx · Async export from HelloData
              </div>
            </div>
          </div>
          {/* HelloData Parsed Content (shown after upload) */}
          <div id="hdParsedContent" style={s("display:none")}></div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* DEBT ANALYSIS TAB                                            */}
      {/* ============================================================ */}
      <div
        id="proj-tab-debt"
        className="proj-tab-content"
        style={s("display:none")}
      >
        <div
          style={s(
            "display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:14px;margin-top:4px",
          )}
        >
          <div>
            <div
              className="section-title"
              data-en="Debt Analysis"
              data-zh="债务分析"
            >
              Debt Analysis
            </div>
            <div className="page-subtitle">
              Existing vs. refinance scenario comparison
            </div>
          </div>
          <div style={s("display:flex;align-items:center;gap:10px")}>
            <div style={s("display:flex;align-items:center;gap:8px")}>
              <button
                className="btn btn-secondary btn-sm"
                id="debtUploadBtn"
                onClick={() => document.getElementById("debtFileInput").click()}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={s("width:13px;height:13px")}
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span id="debtUploadBtnLabel">Upload Debt Excel</span>
              </button>
              <button
                className="btn btn-ghost btn-sm"
                id="debtDeleteBtn"
                style={s("display:none;color:var(--red,#c0392b)")}
                title="Remove"
                onClick={() => window.clearDebtData()}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={s("width:13px;height:13px")}
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                </svg>
              </button>
              <input
                type="file"
                id="debtFileInput"
                accept=".xlsx"
                style={s("display:none")}
                onChange={(e) => window.handleDebtUpload(e)}
              />
            </div>
            <div className="project-switcher-wrap">
              <div id="debtProjectSwitcher" className="project-switcher">
                <div className="project-dot"></div>
                <span className="project-name" id="debtProjectName">
                  Project
                </span>
                <svg
                  className="project-chevron"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              <div className="project-dropdown" id="dropdown-debt"></div>
            </div>
          </div>
          {/* /edit+switcher row */}
        </div>
        <div
          className="card"
          style={s("padding:14px 18px;margin-bottom:var(--gap)")}
        >
          <div
            style={s(
              "display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px",
            )}
          >
            <div>
              <div
                style={s("font-size:13px;font-weight:700;color:var(--header)")}
              >
                Debt Schedule Upload
              </div>
              <div style={s("font-size:11px;color:var(--muted)")}>
                Upload Excel to auto-fill Debt Current &amp; Refinance
              </div>
            </div>
            <label
              style={s(
                "display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border:1px dashed var(--border2);border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;color:var(--accent)",
              )}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => window.handleDebtUpload(e)}
                style={s("display:none")}
              />
            </label>
          </div>
          <div
            id="debtUploadStatus"
            style={s("margin-top:8px;font-size:11px;color:var(--muted)")}
          ></div>
        </div>
        <div className="bento bento-2" style={s("margin-bottom:var(--gap)")}>
          <div className="card">
            <div className="section-header">
              <div className="section-title">Current Debt</div>
              <span className="badge badge-t12">Debt Current</span>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <tbody id="debtCurrentBody">
                  <tr>
                    <td style={s("color:var(--muted)")}>Loading...</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="section-header">
              <div className="section-title">Refinance Scenario</div>
              <span className="badge badge-t12">Debt Refinance</span>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <tbody id="debtRefiBody">
                  <tr>
                    <td style={s("color:var(--muted)")}>Loading...</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

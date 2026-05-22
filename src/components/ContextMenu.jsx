import React from "react";
import { s } from "../utils/parseStyle";

export default function ContextMenu() {
  return (
    <div id="ctxMenu" style={s("display:none;position:fixed;z-index:9999")}>
      <button id="ctxDeleteBtn">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={s("width:13px;height:13px;flex-shrink:0")}
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4h6v2" />
        </svg>
        Delete Row
      </button>
    </div>
  );
}

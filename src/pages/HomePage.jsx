import React from "react";
import { s } from "../utils/parseStyle";

export default function HomePage() {
  return (
    <div id="page-home" className="page" style={s("display:none")}>
      <div className="page-header">
        <div>
          <div className="page-title" id="homeTitle">
            Home
          </div>
          <div className="page-subtitle" id="homeSubtitle">
            Welcome to GL Capital
          </div>
        </div>
      </div>
      <div id="homeContent"></div>
    </div>
  );
}

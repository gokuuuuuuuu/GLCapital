import React from "react";
import { s } from "../utils/parseStyle";

export default function UsersPage() {
  return (
    <div id="page-users" className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Users</div>
          <div className="page-subtitle">Team member accounts</div>
        </div>
        <button id="addUserBtn" className="btn btn-primary">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add User
        </button>
      </div>
      <div className="card" style={s("overflow-x:auto")}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Projects</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="usersBody"></tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

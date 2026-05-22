import React from "react";

export default function SubmissionsPage() {
  return (
    <div id="page-submissions" className="page">
      <div className="page-header">
        <div>
          <div
            className="page-title"
            data-en="Completed Projects"
            data-zh="已完成项目"
          >
            Completed Projects
          </div>
          <div
            className="page-subtitle"
            data-en="Projects marked as completed by underwriters"
            data-zh="承销人标记为已完成的项目"
          >
            Projects marked as completed by underwriters
          </div>
        </div>
      </div>
      <div id="submissionsList"></div>
    </div>
  );
}

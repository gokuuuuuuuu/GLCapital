import { useEffect } from "react";
import Aurora from "./components/Aurora";
import ToastContainer from "./components/ToastContainer";
import Modal from "./components/Modal";
import AuthPage from "./components/AuthPage";
import Sidebar from "./components/Sidebar";
import HomePage from "./pages/HomePage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import SubmissionsPage from "./pages/SubmissionsPage";
import UsersPage from "./pages/UsersPage";
import SettingsPage from "./pages/SettingsPage";
import RejectModal from "./components/RejectModal";
import CompleteConfirmModal from "./components/CompleteConfirmModal";
import AssumptionsModal from "./components/AssumptionsModal";
import ContextMenu from "./components/ContextMenu";

export default function App() {
  useEffect(() => {
    import("../app.js");
  }, []);

  return (
    <>
      <Aurora />
      <ToastContainer />
      <Modal />

      <AuthPage />

      <div id="appShell" className="app" style={{ display: "none" }}>
        <button id="mobileMenuBtn" aria-label="Menu">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <Sidebar />
        <main className="main">
          <HomePage />
          <ProjectsPage />
          <ProjectDetailPage />
          <SubmissionsPage />
          <UsersPage />
          <SettingsPage />
        </main>
      </div>

      <RejectModal />
      <CompleteConfirmModal />
      <AssumptionsModal />
      <ContextMenu />
    </>
  );
}

import React from "react";
import { s } from "../utils/parseStyle";

export default function AuthPage() {
  return (
    <div id="authPage" className="auth-wrap" style={s("display:none")}>
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-mark">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <div className="logo-text">GL Capital</div>
              <div className="logo-sub">Investments Platform</div>
            </div>
          </div>
        </div>
        <div className="auth-tab">
          <button className="auth-tab-btn active">Sign In</button>
          <button className="auth-tab-btn">Register</button>
        </div>
        <div id="loginForm">
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              type="email"
              id="loginEmail"
              placeholder="you@company.com"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              id="loginPassword"
              placeholder="Password"
              defaultValue="admin123"
            />
          </div>
          <button
            id="loginSubmitBtn"
            className="btn btn-primary"
            style={s("width:100%;justify-content:center;padding:11px")}
          >
            Sign In
          </button>
          <p
            style={s(
              "text-align:center;font-size:12px;color:var(--muted);margin-top:16px",
            )}
          >
            Demo:{" "}
            <a
              href="/cdn-cgi/l/email-protection"
              className="__cf_email__"
              data-cfemail="6d0c090004032d0a010e0c1d04190c01430e0200"
            >
              [email{"\u00A0"}protected]
            </a>{" "}
            / admin123
            <br />
            or:{" "}
            <a
              href="/cdn-cgi/l/email-protection"
              className="__cf_email__"
              data-cfemail="7d1c131c11040e093d1a111e1c0d14091c11531e1210"
            >
              [email{"\u00A0"}protected]
            </a>{" "}
            / analyst123
          </p>
        </div>
        <div id="registerForm" style={s("display:none")}>
          <div className="bento bento-2" style={s("gap:12px;margin-bottom:0")}>
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input className="form-input" id="regFirst" placeholder="First" />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input className="form-input" id="regLast" placeholder="Last" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              type="email"
              id="regEmail"
              placeholder="you@company.com"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              id="regPassword"
              placeholder="Min 8 characters"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-input form-select" id="regRole">
              <option value="underwriter">Underwriter</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            id="registerSubmitBtn"
            className="btn btn-primary"
            style={s("width:100%;justify-content:center;padding:11px")}
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}


import { useEffect, useState } from "react";
import Papa from "papaparse";
import api from "./services/api";
import "./index.css";

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

interface Email {
  id: string;
  recipient: string;
  subject: string;
  body?: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  sender?: { email: string };
}

type Page = "dashboard" | "compose" | "scheduled" | "sent";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>("dashboard");
  const [emails, setEmails] = useState<Email[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Email[] | null>(null);
  const [slackConnected, setSlackConnected] = useState(false);
  const [message, setMessage] = useState("");

  const [senderId, setSenderId] = useState("");
  const [recipients, setRecipients] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [startTime, setStartTime] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(30);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    checkLogin();
  }, []);

  async function checkLogin() {
    try {
      const response = await api.get("/auth/me");
      setUser(response.data.user);

      try {
        const slack = await api.get("/slack/status");
        setSlackConnected(slack.data.connected);
      } catch {
        setSlackConnected(false);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadEmails(type: "scheduled" | "sent") {
    try {
      const response = await api.get(`/emails/${type}`);
      const data = response.data.data;
      setEmails(Array.isArray(data) ? data : data?.emails || []);
    } catch (error: any) {
      setMessage(error.response?.data?.message || "Unable to load emails");
      setEmails([]);
    }
  }

  useEffect(() => {
    if (user && (page === "scheduled" || page === "sent")) {
      loadEmails(page);
    }
  }, [page, user]);

  function login() {
    window.location.href = "http://localhost:5000/api/auth/google";
  }

  async function logout() {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
      setPage("dashboard");
    }
  }

  async function uploadRecipients(file: File) {
    const text = await file.text();
    const parsed = Papa.parse<string[]>(text, {
      skipEmptyLines: true,
    });

    const allText = parsed.data.flat().join(" ");
    const found = allText.match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    );

    if (found?.length) {
      setRecipients([...new Set(found)].join("\n"));
      setMessage(`${new Set(found).size} unique recipients loaded`);
    } else {
      setMessage("No valid email addresses found in the file");
    }
  }

  async function scheduleEmail(e: React.FormEvent) {
    e.preventDefault();

    const recipientList = [
      ...new Set(
        recipients
          .split(/[\s,;]+/)
          .map((email) => email.trim())
          .filter(Boolean)
      ),
    ];

    if (!senderId.trim()) {
      setMessage("Enter your sender ID");
      return;
    }

    if (!recipientList.length) {
      setMessage("Add at least one recipient");
      return;
    }

    if (!startTime) {
      setMessage("Select a start time");
      return;
    }

    setSending(true);
    setMessage("");

    try {
      const response = await api.post("/emails/schedule", {
        senderId: senderId.trim(),
        recipients: recipientList,
        subject,
        body,
        startTime: new Date(startTime).toISOString(),
        delaySeconds: Number(delaySeconds),
      });

      setMessage(
        response.data.message ||
        `Successfully scheduled ${recipientList.length} email(s)`
      );

      setRecipients("");
      setSubject("");
      setBody("");
    } catch (error: any) {
      setMessage(
        error.response?.data?.message || "Failed to schedule emails"
      );
    } finally {
      setSending(false);
    }
  }

  async function searchEmails(e: React.FormEvent) {
    e.preventDefault();

    if (!search.trim()) {
      setSearchResults(null);
      return;
    }

    try {
      const response = await api.get("/search", {
        params: { q: search },
      });

      setSearchResults(response.data.data || []);
    } catch (error: any) {
      setMessage(error.response?.data?.message || "Search failed");
    }
  }

  async function connectSlack() {
    window.location.href = "http://localhost:5000/api/slack/connect";
  }

  if (loading) {
    return <div className="center-screen">Loading ReachInbox...</div>;
  }

  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="logo">R</div>
          <h1>ReachInbox</h1>
          <p>Smart email scheduling and automation.</p>
          <button className="google-button" onClick={login}>
            <span>G</span> Continue with Google
          </button>
          <small>Securely manage and schedule your emails.</small>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo small">R</div>
          <span>ReachInbox</span>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <button
          className={page === "dashboard" ? "nav-item active" : "nav-item"}
          onClick={() => {
            setPage("dashboard");
            setSearchResults(null);
          }}
        >
          ◫ Dashboard
        </button>

        <button
          className={page === "compose" ? "nav-item active" : "nav-item"}
          onClick={() => setPage("compose")}
        >
          ✉ Compose Email
        </button>

        <button
          className={page === "scheduled" ? "nav-item active" : "nav-item"}
          onClick={() => setPage("scheduled")}
        >
          ◷ Scheduled Emails
        </button>

        <button
          className={page === "sent" ? "nav-item active" : "nav-item"}
          onClick={() => setPage("sent")}
        >
          ✓ Sent Emails
        </button>

        <div className="sidebar-bottom">
          <div className="nav-label">INTEGRATIONS</div>
          <button className="nav-item" onClick={connectSlack}>
            # Slack {slackConnected ? "✓" : "+"}
          </button>
          <a
            className="nav-item"
            href="http://localhost:5000/admin/queues"
            target="_blank"
            rel="noreferrer"
          >
            ◈ Queue Monitor
          </a>

          <div className="profile">
            {user.avatar ? (
              <img src={user.avatar} alt="Profile" />
            ) : (
              <div className="avatar-placeholder">
                {user.name.charAt(0)}
              </div>
            )}
            <div className="profile-info">
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
            <button className="logout" onClick={logout} title="Logout">
              ↪
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h2>
              {page === "dashboard" && "Dashboard"}
              {page === "compose" && "Compose Email"}
              {page === "scheduled" && "Scheduled Emails"}
              {page === "sent" && "Sent Emails"}
            </h2>
            <p>Welcome back, {user.name.split(" ")[0]}</p>
          </div>
          <div className="top-actions">
            <span className="online-dot" /> System Online
          </div>
        </header>

        {message && (
          <div className="notice">
            {message}
            <button onClick={() => setMessage("")}>×</button>
          </div>
        )}

        {page === "dashboard" && (
          <section>
            <div className="welcome-card">
              <div>
                <h2>Your email workspace</h2>
                <p>
                  Schedule, track and manage your email campaigns from one
                  place.
                </p>
                <button
                  className="primary-button"
                  onClick={() => setPage("compose")}
                >
                  + Compose Email
                </button>
              </div>
              <div className="welcome-icon">✉</div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <span>Total scheduled</span>
                <strong>Manage →</strong>
                <button onClick={() => setPage("scheduled")}>
                  View scheduled emails
                </button>
              </div>
              <div className="stat-card">
                <span>Emails sent</span>
                <strong>Track →</strong>
                <button onClick={() => setPage("sent")}>
                  View sent emails
                </button>
              </div>
              <div className="stat-card">
                <span>Slack integration</span>
                <strong>{slackConnected ? "Connected" : "Not connected"}</strong>
                <button onClick={connectSlack}>
                  {slackConnected ? "Reconnect Slack" : "Connect Slack"}
                </button>
              </div>
            </div>

            <div className="panel">
              <h3>Search your emails</h3>
              <form className="search-form" onSubmit={searchEmails}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search recipient, subject or email body..."
                />
                <button className="primary-button">Search</button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setSearch("");
                    setSearchResults(null);
                  }}
                >
                  Clear
                </button>
              </form>

              {searchResults && (
                <EmailTable emails={searchResults} />
              )}
            </div>
          </section>
        )}

        {page === "compose" && (
          <section className="panel compose-panel">
            <h3>Create an email campaign</h3>
            <p className="muted">
              Upload a CSV/TXT file or enter recipients manually.
            </p>

            <form onSubmit={scheduleEmail}>
              <label>Sender ID</label>
              <input
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                placeholder="Paste your sender UUID from Prisma Studio"
                required
              />

              <label>Recipients</label>
              <textarea
                rows={5}
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="recipient1@example.com&#10;recipient2@example.com"
                required
              />

              <div className="upload-row">
                <label className="upload-button">
                  ↑ Upload CSV / TXT
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadRecipients(file);
                    }}
                  />
                </label>
                <span>
                  {recipients
                    ? `${recipients.split(/[\s,;]+/).filter(Boolean).length} entries`
                    : "No recipients loaded"}
                </span>
              </div>

              <label>Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject"
                required
              />

              <label>Email body</label>
              <textarea
                rows={7}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your email..."
                required
              />

              <div className="form-grid">
                <div>
                  <label>Start date and time</label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label>Delay between emails (seconds)</label>
                  <input
                    type="number"
                    min="0"
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <button className="primary-button submit-button" disabled={sending}>
                {sending ? "Scheduling..." : "Schedule Campaign"}
              </button>
            </form>
          </section>
        )}

        {(page === "scheduled" || page === "sent") && (
          <section className="panel">
            <div className="table-heading">
              <div>
                <h3>{page === "scheduled" ? "Scheduled Emails" : "Sent Emails"}</h3>
                <p className="muted">
                  {emails.length} email record(s)
                </p>
              </div>
              <button
                className="secondary-button"
                onClick={() => loadEmails(page)}
              >
                ↻ Refresh
              </button>
            </div>
            <EmailTable emails={emails} />
          </section>
        )}
      </main>
    </div>
  );
}

function EmailTable({ emails }: { emails: Email[] }) {
  if (!emails.length) {
    return <div className="empty-state">No emails found.</div>;
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Recipient</th>
            <th>Subject</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {emails.map((email) => (
            <tr key={email.id}>
              <td>{email.recipient}</td>
              <td>{email.subject}</td>
              <td>
                <span className={`status ${email.status.toLowerCase()}`}>
                  {email.status}
                </span>
              </td>
              <td>
                {new Date(email.sentAt || email.scheduledAt).toLocaleString(
                  "en-IN",
                  { timeZone: "Asia/Kolkata" }
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;

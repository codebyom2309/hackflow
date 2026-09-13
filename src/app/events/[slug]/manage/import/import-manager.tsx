"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import styles from "./import.module.css";

interface EventInfo {
  id: string;
  title: string;
  slug: string;
}

interface ValidationSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  teamsDetected: number;
  participantsDetected: number;
  duplicateTeams: number;
  duplicateEmails: number;
  invalidEmails: number;
  missingFields: number;
}

interface ImportResult {
  teamName: string;
  status: string;
  error?: string;
}

interface PreviewData {
  fileName: string;
  sheetName: string;
  headers: string[];
  columnMapping: Record<string, string>;
  validation: ValidationSummary;
  sampleValid: Array<{ row: number; data: Record<string, unknown> }>;
  invalidRows: Array<{ row: number; errors: string[] }>;
}

export default function ImportManager({ event }: { event: EventInfo }) {
  const [inputMode, setInputMode] = useState<"file" | "paste" | "live">("file");
  const [pastedText, setPastedText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview data
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showCustomMapping, setShowCustomMapping] = useState(false);

  // Import results
  const [importDone, setImportDone] = useState(false);
  const [importSummary, setImportSummary] = useState<{ imported: number; failed: number } | null>(null);
  const [, setImportResults] = useState<ImportResult[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live Webhook & Sheet Sync
  const [origin, setOrigin] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [pingStatus, setPingStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const webhookUrl = `${origin || ""}/api/events/${event.slug}/form-webhook`;

  const scriptCode = `// Google Apps Script — Auto Forward Form Submissions to HackFlow
// 1. In Google Form or Sheet, go to Extensions > Apps Script
// 2. Paste this code and Save
// 3. Click Triggers (clock icon) > Add Trigger > onFormSubmit > On form submit > Save

function onFormSubmit(e) {
  var url = "${webhookUrl}";
  var payload = e ? (e.namedValues || e.values || e) : {};
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  try {
    var response = UrlFetchApp.fetch(url, options);
    Logger.log("HackFlow Webhook Response: " + response.getContentText());
  } catch (err) {
    Logger.log("Error sending to HackFlow: " + err.toString());
  }
}`;

  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  }

  function copyScriptCode() {
    navigator.clipboard.writeText(scriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  }

  async function handleTestPing() {
    setPingStatus("testing");
    try {
      const res = await fetch(`/api/events/${event.slug}/form-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "Team Name": "Webhook Test Team",
          "Leader Full Name": "Test Organizer",
          "Leader Email Address": "webhook-test@example.com",
          "Leader WhatsApp / Contact Number": "9999999999",
          "Chosen Theme": "AI & Automation",
          "Rules & Code of Conduct Acknowledgment": "I agree",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPingStatus("success");
      } else {
        setPingStatus("error");
      }
    } catch {
      setPingStatus("error");
    }
  }

  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [syncedTeams, setSyncedTeams] = useState<any[]>([]);
  const [loadingSynced, setLoadingSynced] = useState(false);
  const [autoPoll, setAutoPoll] = useState(true);

  const fetchSyncedTeams = useCallback(async () => {
    setLoadingSynced(true);
    try {
      const res = await fetch(`/api/events/${event.slug}/teams?sortBy=recent`);
      if (res.ok) {
        const json = await res.json();
        setSyncedTeams(json.data?.teams || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSynced(false);
    }
  }, [event.slug]);

  useEffect(() => {
    fetchSyncedTeams();
  }, [fetchSyncedTeams]);

  useEffect(() => {
    fetch(`/api/events/${event.slug}/form-sync`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.googleSheetUrl) {
          setSheetUrl(json.data.googleSheetUrl);
          // Preserve live connection mode so it does not vanish on reload
          setInputMode("live");
        }
        if (json.data?.lastSyncedAt) {
          setLastSyncedAt(json.data.lastSyncedAt);
        }
      })
      .catch(() => {});
  }, [event.slug]);

  // Live polling every 15 seconds when on live tab
  useEffect(() => {
    if (!autoPoll || inputMode !== "live") return;
    const interval = setInterval(() => {
      fetchSyncedTeams();
    }, 15000);
    return () => clearInterval(interval);
  }, [autoPoll, inputMode, fetchSyncedTeams]);

  async function handleSheetSync() {
    if (!sheetUrl.trim()) return;
    setLoading(true);
    setError(null);
    setSyncStatusMsg(null);
    try {
      const res = await fetch(`/api/events/${event.slug}/form-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetUrl: sheetUrl.trim(),
          autoSyncEnabled: true,
          triggerSync: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sync Google Sheet.");
      }
      setLastSyncedAt(new Date().toISOString());
      setSyncStatusMsg(`✓ ${data.message}`);
      await fetchSyncedTeams();
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed to fetch and sync from Google Sheet.");
      setLoading(false);
    }
  }

  // 1. Download Sample CSV
  function downloadSampleCSV() {
    const csvContent =
      "Team Name,Leader Name,Leader Email,Leader Phone,College,Theme,Member 2 Name,Member 2 Email,Member 3 Name,Member 3 Email\n" +
      'Binary Beasts,Aarav Sharma,aarav@example.com,+919876543210,IIT Bombay,AI & Autonomous Agents,Rohan Gupta,rohan@example.com,Simran Kaur,simran@example.com\n' +
      'CodeCrafters,Neha Patel,neha@example.com,+919876543211,BITS Pilani,Web3 & Cryptography,Karan Joshi,karan@example.com,Ananya Sen,ananya@example.com\n' +
      'AlgoRhythms,Vikram Singh,vikram@example.com,+919876543212,UEM Kolkata,FinTech & Next-Gen Banking,Aditya Roy,aditya@example.com,Tanvi Bose,tanvi@example.com\n';

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `hackflow_${event.slug}_sample_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // 2. File Selection & Drop
  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, []);

  function handleFileSelect(f: File) {
    const ext = f.name.toLowerCase();
    if (!ext.endsWith(".xlsx") && !ext.endsWith(".csv") && !ext.endsWith(".xls")) {
      setError("Please upload an .xlsx or .csv spreadsheet file");
      return;
    }
    setError(null);
    setFile(f);
    uploadAndPreview(f);
  }

  // 3. Process Pasted CSV Data
  function handlePasteParse() {
    if (!pastedText.trim()) return;
    setError(null);
    const blob = new Blob([pastedText.trim()], { type: "text/csv;charset=utf-8;" });
    const f = new File([blob], "pasted_roster.csv", { type: "text/csv" });
    setFile(f);
    uploadAndPreview(f);
  }

  // 4. Upload & Preview API
  async function uploadAndPreview(f: File, mappingOverride?: Record<string, string>) {
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", f);
    if (mappingOverride) {
      formData.append("columnMapping", JSON.stringify(mappingOverride));
    }

    try {
      const res = await fetch(`/api/events/${event.slug}/import?action=preview`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to parse file. Please check column headers.");
      } else {
        setPreviewData(json.data);
        setColumnMapping(json.data.columnMapping || {});
      }
    } catch {
      setError("Network error connecting to import service");
    } finally {
      setLoading(false);
    }
  }

  // 5. Update Mapping column
  function handleMappingChange(fieldKey: string, headerVal: string) {
    const updated = { ...columnMapping, [fieldKey]: headerVal };
    setColumnMapping(updated);
    if (file) {
      uploadAndPreview(file, updated);
    }
  }

  // 6. Execute Final Import
  async function executeImport() {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("columnMapping", JSON.stringify(columnMapping));

    try {
      const res = await fetch(`/api/events/${event.slug}/import?action=import`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (res.ok) {
        setImportSummary({ imported: json.data.imported, failed: json.data.failed });
        setImportResults(json.data.results || []);
        setImportDone(true);
      } else {
        setError(json.error || "Import failed during database transaction.");
      }
    } catch {
      setError("Network error executing import. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function resetImport() {
    setFile(null);
    setPastedText("");
    setPreviewData(null);
    setColumnMapping({});
    setImportDone(false);
    setImportSummary(null);
    setError(null);
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Import Registration Roster</h1>
          <p className={styles.pageSubtitle}>
            Import team entries from Google Forms, Devfolio, or Excel. Columns are matched automatically.
          </p>
        </div>

        <button type="button" onClick={downloadSampleCSV} className={styles.templateBtn}>
          📥 Download Sample Template (.csv)
        </button>
      </div>

      {error && <div className={styles.flashError}>{error}</div>}

      {/* SUCCESS / DONE VIEW */}
      {importDone && importSummary ? (
        <div className={styles.resultCard}>
          <div className={styles.resultIcon}>🎉</div>
          <h2 className={styles.resultTitle}>Import Successful!</h2>
          <p className={styles.resultText}>
            Successfully imported <strong>{importSummary.imported} teams</strong> into HackFlow.
            Team registrations are secured and universal QR passes generated.
            Desks will be allotted upon on-site physical check-in or manual organizer assignment.
          </p>

          <div className={styles.resultActions}>
            <Link
              href={`/events/${event.slug}/manage/teams`}
              className={`${styles.resultLink} ${styles.resultLinkPrimary}`}
            >
              View Teams Roster →
            </Link>
            <Link
              href={`/events/${event.slug}/venue`}
              className={`${styles.resultLink} ${styles.resultLinkSecondary}`}
            >
              View Venue Desks →
            </Link>
            <button
              type="button"
              onClick={resetImport}
              className={`${styles.resultLink} ${styles.resultLinkSecondary}`}
            >
              Import More Teams
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* UPLOAD / PASTE / LIVE SYNC SELECTOR */}
          {!previewData && (
            <>
              {/* Active Google Sheet Sync Banner */}
              {sheetUrl && (
                <div style={{
                  marginBottom: "1.25rem",
                  padding: "12px 18px",
                  borderRadius: "var(--rounded-lg)",
                  background: "rgba(34, 197, 94, 0.08)",
                  border: "1px solid rgba(34, 197, 94, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "18px" }}>🟢</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "#15803d" }}>
                        Live Google Sheet Sync Connected
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--color-ink-muted)" }}>
                        {syncedTeams.length} teams registered · {lastSyncedAt ? `Last synced: ${new Date(lastSyncedAt).toLocaleTimeString()}` : "Ready"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => setInputMode("live")}
                      className={styles.templateBtn}
                      style={{ fontSize: "12px", padding: "6px 14px", borderColor: "rgba(34, 197, 94, 0.4)", color: "#15803d" }}
                    >
                      {inputMode === "live" ? "✓ Viewing Live Sync" : "View Live Feed →"}
                    </button>
                    <button
                      type="button"
                      onClick={handleSheetSync}
                      disabled={loading}
                      className={styles.templateBtn}
                      style={{ fontSize: "12px", padding: "6px 14px" }}
                    >
                      {loading ? "Syncing..." : "⚡ Sync Now"}
                    </button>
                  </div>
                </div>
              )}

              <div className={styles.inputModeTabs}>
                <button
                  type="button"
                  className={`${styles.modeTab} ${inputMode === "file" ? styles.modeTabActive : ""}`}
                  onClick={() => setInputMode("file")}
                >
                  📁 Upload Spreadsheet (.xlsx, .csv)
                </button>
                <button
                  type="button"
                  className={`${styles.modeTab} ${inputMode === "paste" ? styles.modeTabActive : ""}`}
                  onClick={() => setInputMode("paste")}
                >
                  📋 Paste Spreadsheet / CSV Data
                </button>
                <button
                  type="button"
                  className={`${styles.modeTab} ${inputMode === "live" ? styles.modeTabActive : ""}`}
                  onClick={() => setInputMode("live")}
                >
                  ⚡ Live Google Form &amp; Sheet Sync
                </button>
              </div>

              {inputMode === "file" ? (
                <div
                  className={`${styles.dropZone} ${dragOver ? styles.dropZoneDragOver : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className={styles.fileInput}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileSelect(f);
                    }}
                  />
                  <div className={styles.dropIcon}>📤</div>
                  <h3 className={styles.dropTitle}>
                    {loading ? "Reading spreadsheet..." : "Drag & drop your roster file here"}
                  </h3>
                  <p className={styles.dropHint}>
                    Supports .xlsx (Excel) or .csv from Google Forms, Devfolio, Unstop
                  </p>
                </div>
              ) : inputMode === "paste" ? (
                <div className={styles.pasteBox}>
                  <textarea
                    className={styles.textarea}
                    placeholder="Paste CSV data or copied cells directly from Google Sheets / Excel here..."
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                  />
                  <div className={styles.pasteActions}>
                    <button
                      type="button"
                      className={styles.parseBtn}
                      onClick={handlePasteParse}
                      disabled={loading || !pastedText.trim()}
                    >
                      {loading ? "Parsing Data..." : "Parse Pasted Data →"}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {/* Google Form Real-Time Webhook */}
                  <div className={styles.webhookCard}>
                    <div className={styles.webhookHeader}>
                      <div>
                        <h3 className={styles.webhookTitle}>⚡ Real-Time Google Form Webhook</h3>
                        <p className={styles.webhookDesc}>
                          Receive new student registrations instantly. As soon as a participant submits your Google Form,
                          they are immediately registered in HackFlow, an offline QR token is created, and all members are saved!
                        </p>
                      </div>
                    </div>

                    <label className={styles.mappingLabel} style={{ marginBottom: "6px", display: "block" }}>
                      Your Event Webhook URL:
                    </label>
                    <div className={styles.urlBox}>
                      <code className={styles.urlCode}>{webhookUrl}</code>
                      <button type="button" onClick={copyWebhookUrl} className={styles.copyBtn}>
                        {copiedUrl ? "✓ Copied" : "📋 Copy URL"}
                      </button>
                    </div>

                    <div className={styles.codeBlock}>
                      <div className={styles.codeHeader}>
                        <span>Google Apps Script (paste into Extensions &gt; Apps Script)</span>
                        <button type="button" onClick={copyScriptCode} className={styles.copyBtn}>
                          {copiedScript ? "✓ Copied Script" : "📋 Copy Code"}
                        </button>
                      </div>
                      <pre className={styles.codeText}>{scriptCode}</pre>
                    </div>

                    <h4 style={{ fontSize: "14px", fontWeight: 700, margin: "1rem 0 0.5rem", color: "var(--color-ink)" }}>
                      Quick Setup (Takes 60 seconds):
                    </h4>
                    <ol className={styles.stepList}>
                      <li>Open your <strong>Google Form</strong> or connected <strong>Google Sheet</strong>.</li>
                      <li>Click <strong>Extensions &gt; Apps Script</strong> (or the 3 dots in the top right &gt; Script editor).</li>
                      <li>Delete any placeholder code, paste the script above, and click <strong>Save (💾)</strong>.</li>
                      <li>Click the <strong>Triggers</strong> icon (alarm clock on left menu) &gt; <strong>+ Add Trigger</strong>.</li>
                      <li>Choose function: <code>onFormSubmit</code>, Event source: <code>From spreadsheet / From form</code>, Event type: <code>On form submit</code> &gt; <strong>Save</strong>.</li>
                    </ol>

                    <div className={styles.pingRow}>
                      <button
                        type="button"
                        onClick={handleTestPing}
                        disabled={pingStatus === "testing"}
                        className={styles.pingBtn}
                      >
                        {pingStatus === "testing" ? "Sending Ping..." : "🧪 Send Test Webhook Ping"}
                      </button>
                      {pingStatus === "success" && (
                        <span className={`${styles.pingStatus} ${styles.pingStatusSuccess}`}>
                          ✅ Webhook verified! Test team registered successfully.
                        </span>
                      )}
                      {pingStatus === "error" && (
                        <span className={`${styles.pingStatus} ${styles.pingStatusError}`}>
                          ❌ Test ping failed. Please check network/server status.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sync Live Google Sheet */}
                  <div className={styles.webhookCard}>
                    <h3 className={styles.webhookTitle}>🔗 Sync Live from Google Sheet Link</h3>
                    <p className={styles.webhookDesc}>
                      Have an existing Google Sheet with form responses? Paste the public sharing link or CSV export link
                      below to fetch and import all entries without downloading any file.
                    </p>
                    <div className={styles.sheetSyncBox}>
                      <input
                        type="url"
                        placeholder="https://docs.google.com/spreadsheets/d/your-sheet-id/edit..."
                        value={sheetUrl}
                        onChange={(e) => setSheetUrl(e.target.value)}
                        className={styles.sheetInput}
                      />
                      <button
                        type="button"
                        onClick={handleSheetSync}
                        disabled={loading || !sheetUrl.trim()}
                        className={styles.sheetSyncBtn}
                      >
                        {loading ? "Fetching Sheet..." : "Sync Sheet Now →"}
                      </button>
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--color-ink-muted)", marginTop: "6px", display: "block" }}>
                      * Make sure sharing permissions on the Google Sheet are set to &quot;Anyone with the link can view&quot;.
                    </span>

                    {lastSyncedAt && (
                      <div style={{
                        marginTop: 10,
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "rgba(34, 197, 94, 0.1)",
                        border: "1px solid rgba(34, 197, 94, 0.25)",
                        color: "#16a34a",
                        fontSize: "12px",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}>
                        <span>🟢</span>
                        <span>Google Sheet connected &amp; saved to event. Last synced: {new Date(lastSyncedAt).toLocaleString()}</span>
                      </div>
                    )}

                    {syncStatusMsg && (
                      <div style={{
                        marginTop: 10,
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "rgba(59, 130, 246, 0.1)",
                        border: "1px solid rgba(59, 130, 246, 0.25)",
                        color: "var(--color-accent)",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}>
                        {syncStatusMsg}
                      </div>
                    )}
                  </div>

                  {/* Live Ingested Registrations Feed */}
                  <div className={styles.webhookCard} style={{ marginTop: "1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <h3 className={styles.webhookTitle} style={{ margin: 0 }}>
                            ⚡ Live Ingested Registrations Feed
                          </h3>
                          <span style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 99,
                            background: autoPoll ? "rgba(34, 197, 94, 0.15)" : "rgba(100, 116, 139, 0.15)",
                            color: autoPoll ? "#15803d" : "var(--color-ink-muted)",
                            border: `1px solid ${autoPoll ? "rgba(34, 197, 94, 0.3)" : "rgba(100, 116, 139, 0.3)"}`,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: autoPoll ? "#22c55e" : "#94a3b8", display: "inline-block" }}></span>
                            {autoPoll ? "Live Polling (15s)" : "Polling Paused"}
                          </span>
                        </div>
                        <p className={styles.webhookDesc} style={{ margin: "4px 0 0" }}>
                          Showing all teams and participants received from Google Forms &amp; Sheets in real time.
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => setAutoPoll(!autoPoll)}
                          className={styles.templateBtn}
                          style={{ fontSize: "12px", padding: "6px 12px" }}
                        >
                          {autoPoll ? "⏸ Pause Auto-Poll" : "▶ Resume Auto-Poll"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { fetchSyncedTeams(); handleSheetSync(); }}
                          disabled={loading}
                          className={styles.templateBtn}
                          style={{ fontSize: "12px", padding: "6px 14px", fontWeight: 700 }}
                        >
                          {loading ? "Syncing..." : "🔄 Refresh & Sync"}
                        </button>
                      </div>
                    </div>

                    {/* Registrations List */}
                    {syncedTeams.length === 0 ? (
                      <div style={{
                        padding: "2rem",
                        textAlign: "center",
                        background: "var(--color-surface-2)",
                        borderRadius: "var(--rounded-lg)",
                        border: "1px dashed var(--color-hairline)",
                        color: "var(--color-ink-muted)",
                        fontSize: "14px",
                      }}>
                        <div style={{ fontSize: "28px", marginBottom: "6px" }}>📭</div>
                        <p style={{ margin: 0, fontWeight: 600, color: "var(--color-ink)" }}>No team submissions yet</p>
                        <p style={{ margin: "4px 0 0", fontSize: "12px" }}>
                          As participants submit your Google Form or entries are added to the connected Google Sheet,
                          they will appear here automatically!
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-ink-muted)", display: "flex", justifyContent: "space-between" }}>
                          <span>REGISTERED TEAMS ({syncedTeams.length})</span>
                          <span>Auto-detected &amp; secured with offline QR tokens</span>
                        </div>

                        {syncedTeams.map((team: any, idx: number) => {
                          const resp = team.formResponses || {};
                          return (
                            <div
                              key={team.id || idx}
                              style={{
                                padding: "1rem 1.25rem",
                                borderRadius: "var(--rounded-lg)",
                                background: "var(--color-surface-1)",
                                border: "1px solid var(--color-hairline)",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.5rem",
                                boxShadow: "var(--shadow-sm)",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                    <span style={{ fontWeight: 700, fontSize: "15px", color: "var(--color-ink)" }}>
                                      {team.name}
                                    </span>
                                    {team.theme && (
                                      <span style={{
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        padding: "2px 8px",
                                        borderRadius: 99,
                                        background: "rgba(99, 102, 241, 0.12)",
                                        color: "#4338ca",
                                        border: "1px solid rgba(99, 102, 241, 0.25)",
                                      }}>
                                        {team.theme}
                                      </span>
                                    )}
                                    <span style={{
                                      fontSize: "11px",
                                      fontWeight: 600,
                                      padding: "2px 6px",
                                      borderRadius: 4,
                                      background: team.desk ? "rgba(34, 197, 94, 0.12)" : "rgba(251, 191, 36, 0.12)",
                                      color: team.desk ? "#15803d" : "#b45309",
                                    }}>
                                      {team.desk ? `🏢 ${team.desk.roomName} · D${team.desk.deskNumber}` : "🪑 Unseated"}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: "12px", color: "var(--color-ink-muted)", marginTop: "2px" }}>
                                    Leader: <strong>{resp.leader?.name || team.name}</strong> · ✉️ {team.leaderEmail || "No email"}
                                    {team.leaderPhone && (
                                      <span> · 📞 <a href={`tel:${team.leaderPhone}`} style={{ color: "var(--color-accent)" }}>{team.leaderPhone}</a></span>
                                    )}
                                    {team.college && <span> · 🏫 {team.college}</span>}
                                  </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <Link
                                    href={`/events/${event.slug}/manage/teams`}
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 600,
                                      color: "var(--color-accent)",
                                      textDecoration: "none",
                                      padding: "4px 8px",
                                      borderRadius: 4,
                                      background: "var(--color-accent-soft)",
                                    }}
                                  >
                                    View in Teams →
                                  </Link>
                                </div>
                              </div>

                              {/* Members & Payment bar */}
                              <div style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: "0.5rem",
                                paddingTop: "6px",
                                borderTop: "1px solid var(--color-hairline)",
                                fontSize: "12px",
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                  <span style={{ color: "var(--color-ink-muted)" }}>
                                    👥 {team.memberCount} members:
                                  </span>
                                  {Array.isArray(team.members) && team.members.slice(0, 4).map((m: any, mIdx: number) => (
                                    <span
                                      key={m.id || mIdx}
                                      style={{
                                        padding: "1px 6px",
                                        borderRadius: 4,
                                        background: "var(--color-surface-2)",
                                        border: "1px solid var(--color-hairline)",
                                        fontSize: "11px",
                                        color: "var(--color-ink)",
                                      }}
                                    >
                                      {m.name} {m.isLeader ? "★" : ""}
                                    </span>
                                  ))}
                                  {team.members?.length > 4 && (
                                    <span style={{ color: "var(--color-ink-muted)", fontSize: "11px" }}>
                                      +{team.members.length - 4} more
                                    </span>
                                  )}
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                                  {resp.utr && (
                                    <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--color-ink)", background: "var(--color-surface-2)", padding: "2px 6px", borderRadius: 4 }}>
                                      UTR: {resp.utr}
                                    </span>
                                  )}
                                  {resp.paymentScreenshot && (
                                    <a
                                      href={resp.paymentScreenshot}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        color: "#16a34a",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        textDecoration: "underline",
                                      }}
                                    >
                                      📸 Receipt Proof ↗
                                    </a>
                                  )}
                                  <span style={{ color: "var(--color-ink-muted)", fontSize: "11px" }}>
                                    🔑 QR: <code>{team.qrToken ? `${team.qrToken.slice(0, 10)}...` : "Active"}</code>
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* PREVIEW & CONFIRMATION VIEW */}
          {previewData && (
            <div className={styles.previewCard}>
              <div className={styles.previewHeader}>
                <div className={styles.previewTitleRow}>
                  <h3 className={styles.previewTitle}>Roster Preview & Mapping</h3>
                  <span className={styles.confidenceBadge}>✓ Columns Auto-Detected</span>
                </div>
                <button
                  type="button"
                  onClick={resetImport}
                  style={{ background: "none", border: "none", color: "var(--color-ink-muted)", cursor: "pointer", fontSize: "13px" }}
                >
                  ✕ Choose Another File
                </button>
              </div>

              {/* Stat Counters */}
              <div className={styles.statsRow}>
                <div className={styles.statBox}>
                  <div className={styles.statNum}>{previewData.validation.teamsDetected}</div>
                  <div className={styles.statLabel}>Teams Detected</div>
                </div>
                <div className={styles.statBox}>
                  <div className={styles.statNum}>{previewData.validation.participantsDetected}</div>
                  <div className={styles.statLabel}>Participants</div>
                </div>
                <div className={styles.statBox}>
                  <div className={styles.statNum}>{previewData.validation.validRows}</div>
                  <div className={styles.statLabel}>Ready to Import</div>
                </div>
              </div>

              {/* Detected Column Badges */}
              <div className={styles.mappingPills}>
                <div className={styles.mappingPill}>
                  <span className={styles.mappingPillKey}>Team:</span> {columnMapping.teamName || "Auto-Generated"}
                </div>
                <div className={styles.mappingPill}>
                  <span className={styles.mappingPillKey}>Leader:</span> {columnMapping.leaderName || "Auto"}
                </div>
                <div className={styles.mappingPill}>
                  <span className={styles.mappingPillKey}>Email:</span> {columnMapping.leaderEmail || "Not Found"}
                </div>
                {columnMapping.college && (
                  <div className={styles.mappingPill}>
                    <span className={styles.mappingPillKey}>College:</span> {columnMapping.college}
                  </div>
                )}
                {columnMapping.theme && (
                  <div className={styles.mappingPill}>
                    <span className={styles.mappingPillKey}>Track:</span> {columnMapping.theme}
                  </div>
                )}
                <button
                  type="button"
                  className={styles.toggleMappingBtn}
                  onClick={() => setShowCustomMapping(!showCustomMapping)}
                >
                  {showCustomMapping ? "Hide Column Adjuster" : "⚙️ Adjust Columns"}
                </button>
              </div>

              {/* Optional Custom Column Adjuster */}
              {showCustomMapping && (
                <div className={styles.customMappingGrid}>
                  <div className={styles.mappingField}>
                    <label className={styles.mappingLabel}>Team Name Column</label>
                    <select
                      className={styles.select}
                      value={columnMapping.teamName || ""}
                      onChange={(e) => handleMappingChange("teamName", e.target.value)}
                    >
                      {previewData.headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.mappingField}>
                    <label className={styles.mappingLabel}>Leader Name Column</label>
                    <select
                      className={styles.select}
                      value={columnMapping.leaderName || ""}
                      onChange={(e) => handleMappingChange("leaderName", e.target.value)}
                    >
                      {previewData.headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.mappingField}>
                    <label className={styles.mappingLabel}>Leader Email Column</label>
                    <select
                      className={styles.select}
                      value={columnMapping.leaderEmail || ""}
                      onChange={(e) => handleMappingChange("leaderEmail", e.target.value)}
                    >
                      {previewData.headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.mappingField}>
                    <label className={styles.mappingLabel}>College Column</label>
                    <select
                      className={styles.select}
                      value={columnMapping.college || ""}
                      onChange={(e) => handleMappingChange("college", e.target.value)}
                    >
                      <option value="">-- Optional / None --</option>
                      {previewData.headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.mappingField}>
                    <label className={styles.mappingLabel}>Track / Theme Column</label>
                    <select
                      className={styles.select}
                      value={columnMapping.theme || ""}
                      onChange={(e) => handleMappingChange("theme", e.target.value)}
                    >
                      <option value="">-- Optional / None --</option>
                      {previewData.headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Sample Data Table */}
              {previewData.sampleValid.length > 0 && (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>Team Name</th>
                        <th className={styles.th}>Leader Name</th>
                        <th className={styles.th}>Leader Email</th>
                        <th className={styles.th}>College</th>
                        <th className={styles.th}>Track</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.sampleValid.map((item, idx) => (
                        <tr key={idx}>
                          <td className={styles.td}><strong>{String(item.data.teamName || "—")}</strong></td>
                          <td className={styles.td}>{String(item.data.leaderName || "—")}</td>
                          <td className={styles.td}>{String(item.data.leaderEmail || "—")}</td>
                          <td className={styles.td}>{String(item.data.college || "—")}</td>
                          <td className={styles.td}>{String(item.data.theme || "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Action Bar */}
              <div className={styles.actionBar}>
                <span style={{ fontSize: "13px", color: "var(--color-ink-muted)" }}>
                  Ready to import {previewData.validation.validRows} teams into HackFlow.
                </span>
                <button
                  type="button"
                  className={styles.importBtn}
                  onClick={executeImport}
                  disabled={loading || previewData.validation.validRows === 0}
                >
                  {loading ? "Importing Roster & Generating Passes..." : `⚡ Confirm & Import ${previewData.validation.validRows} Teams →`}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

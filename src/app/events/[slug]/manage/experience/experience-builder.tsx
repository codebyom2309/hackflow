"use client";

import { useState } from "react";
import styles from "./experience.module.css";
import { useToast } from "@/components/ui/Toast";
import type { ParticipantExperienceConfig } from "@/lib/types/participant-experience";
import { DEFAULT_EXPERIENCE_CONFIG } from "@/lib/types/participant-experience";

interface ExperienceBuilderProps {
  event: {
    id: string;
    title: string;
    slug: string;
  };
  initialConfig: ParticipantExperienceConfig | null;
  initialPublished: boolean;
}

export default function ExperienceBuilder({
  event,
  initialConfig,
  initialPublished,
}: ExperienceBuilderProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<
    "branding" | "schedule" | "venue" | "rules" | "faqs" | "sponsors" | "preview"
  >("branding");

  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("mobile");
  const [config, setConfig] = useState<ParticipantExperienceConfig>(() => ({
    ...DEFAULT_EXPERIENCE_CONFIG,
    heroTitle: event.title,
    ...(initialConfig || {}),
  }));

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(initialPublished);

  // Handlers for Schedule Items
  function addScheduleItem() {
    const newItem = {
      id: crypto.randomUUID(),
      time: "12:00 PM",
      title: "New Milestone",
      phase: "Hacking",
      description: "Milestone description",
    };
    setConfig((prev) => ({
      ...prev,
      schedule: [...(prev.schedule || []), newItem],
    }));
  }

  function updateScheduleItem(index: number, field: string, value: string) {
    setConfig((prev) => {
      const schedule = [...(prev.schedule || [])];
      schedule[index] = { ...schedule[index], [field]: value };
      return { ...prev, schedule };
    });
  }

  function removeScheduleItem(index: number) {
    setConfig((prev) => ({
      ...prev,
      schedule: (prev.schedule || []).filter((_, i) => i !== index),
    }));
  }

  // Handlers for Rules
  function addRule() {
    const newRule = {
      id: crypto.randomUUID(),
      title: "New Guideline",
      description: "Description of the rule or guideline",
    };
    setConfig((prev) => ({
      ...prev,
      rules: [...(prev.rules || []), newRule],
    }));
  }

  function updateRule(index: number, field: string, value: string) {
    setConfig((prev) => {
      const rules = [...(prev.rules || [])];
      rules[index] = { ...rules[index], [field]: value };
      return { ...prev, rules };
    });
  }

  function removeRule(index: number) {
    setConfig((prev) => ({
      ...prev,
      rules: (prev.rules || []).filter((_, i) => i !== index),
    }));
  }

  // Handlers for FAQs
  function addFaq() {
    const newFaq = {
      id: crypto.randomUUID(),
      question: "Frequently Asked Question?",
      answer: "Clear and actionable answer for participants.",
    };
    setConfig((prev) => ({
      ...prev,
      faqs: [...(prev.faqs || []), newFaq],
    }));
  }

  function updateFaq(index: number, field: string, value: string) {
    setConfig((prev) => {
      const faqs = [...(prev.faqs || [])];
      faqs[index] = { ...faqs[index], [field]: value };
      return { ...prev, faqs };
    });
  }

  function removeFaq(index: number) {
    setConfig((prev) => ({
      ...prev,
      faqs: (prev.faqs || []).filter((_, i) => i !== index),
    }));
  }

  // Save / Publish actions
  async function handleSave(publish = false) {
    if (publish) setPublishing(true);
    else setSaving(true);

    try {
      const res = await fetch(`/api/events/${event.slug}/experience`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, publish }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to save configuration");
      }

      setIsPublished(publish);
      if (publish) {
        toast.success("Participant website & companion experience published live!");
      } else {
        toast.info("Draft configuration saved successfully.");
      }
    } catch (err: unknown) {
      const e = err as Error;
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  }

  return (
    <div className={styles.builder}>
      {/* Top Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.badgeRow}>
            <span className={styles.headerBadge}>EXPERIENCE CONFIGURATOR</span>
            <span className={isPublished ? styles.publishedPill : styles.draftPill}>
              {isPublished ? "● Published Live" : "○ Draft State"}
            </span>
          </div>
          <h1 className={styles.title}>Participant Experience Builder</h1>
          <p className={styles.subtitle}>
            Control what participants see on the public website and inside their companion app.
          </p>
        </div>

        <div className={styles.actionGroup}>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving || publishing}
            className={styles.secondaryBtn}
          >
            {saving ? "Saving Draft..." : "Save Draft"}
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving || publishing}
            className={styles.publishBtn}
          >
            {publishing ? "Publishing..." : "🚀 Publish Live"}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "branding" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("branding")}
        >
          🎨 Branding & Hero
        </button>
        <button
          className={`${styles.tab} ${activeTab === "schedule" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("schedule")}
        >
          ⏱️ Schedule ({config.schedule?.length || 0})
        </button>
        <button
          className={`${styles.tab} ${activeTab === "venue" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("venue")}
        >
          🏢 Venue & Wi-Fi Guide
        </button>
        <button
          className={`${styles.tab} ${activeTab === "rules" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("rules")}
        >
          📜 Rules ({config.rules?.length || 0})
        </button>
        <button
          className={`${styles.tab} ${activeTab === "faqs" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("faqs")}
        >
          ❓ FAQs ({config.faqs?.length || 0})
        </button>
        <button
          className={`${styles.tab} ${activeTab === "preview" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("preview")}
        >
          👁️ Live Preview
        </button>
      </div>

      {/* Editor Body */}
      <div className={styles.editorBody}>
        {/* BRANDING */}
        {activeTab === "branding" && (
          <div className={styles.formCard}>
            <h3 className={styles.sectionTitle}>Event Branding & Hero Presentation</h3>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Hero Headline</label>
                <input
                  type="text"
                  value={config.heroTitle || ""}
                  onChange={(e) => setConfig({ ...config, heroTitle: e.target.value })}
                  placeholder="e.g. Build the Future of AI"
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label>Hero Tagline / Subtitle</label>
                <textarea
                  value={config.heroTagline || ""}
                  onChange={(e) => setConfig({ ...config, heroTagline: e.target.value })}
                  placeholder="Inspiring description displayed on landing page..."
                  className={styles.textarea}
                  rows={3}
                />
              </div>
              <div className={styles.field}>
                <label>Custom Banner Image URL (Optional)</label>
                <input
                  type="url"
                  value={config.bannerUrl || ""}
                  onChange={(e) => setConfig({ ...config, bannerUrl: e.target.value })}
                  placeholder="https://example.com/banner.jpg"
                  className={styles.input}
                />
              </div>
            </div>
          </div>
        )}

        {/* SCHEDULE */}
        {activeTab === "schedule" && (
          <div className={styles.formCard}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Hackathon Timeline Schedule</h3>
              <button type="button" onClick={addScheduleItem} className={styles.addItemBtn}>
                + Add Schedule Milestone
              </button>
            </div>
            <div className={styles.itemsList}>
              {config.schedule?.map((item, idx) => (
                <div key={item.id} className={styles.itemRow}>
                  <div className={styles.itemInputs}>
                    <input
                      type="text"
                      value={item.time}
                      onChange={(e) => updateScheduleItem(idx, "time", e.target.value)}
                      placeholder="Time (e.g., 10:00 AM)"
                      className={styles.inputSmall}
                    />
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => updateScheduleItem(idx, "title", e.target.value)}
                      placeholder="Milestone Title"
                      className={styles.input}
                    />
                    <input
                      type="text"
                      value={item.phase || ""}
                      onChange={(e) => updateScheduleItem(idx, "phase", e.target.value)}
                      placeholder="Phase Tag"
                      className={styles.inputSmall}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeScheduleItem(idx)}
                    className={styles.deleteBtn}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VENUE GUIDE */}
        {activeTab === "venue" && (
          <div className={styles.formCard}>
            <h3 className={styles.sectionTitle}>Physical Venue & Hacker Logistics Guide</h3>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Building / Venue Hall Name</label>
                <input
                  type="text"
                  value={config.venueGuide?.buildingName || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      venueGuide: { ...config.venueGuide, buildingName: e.target.value },
                    })
                  }
                  placeholder="e.g. Science & Tech Complex, Wing B"
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label>Floor & Access Info</label>
                <input
                  type="text"
                  value={config.venueGuide?.floorInfo || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      venueGuide: { ...config.venueGuide, floorInfo: e.target.value },
                    })
                  }
                  placeholder="e.g. 2nd & 3rd Floor Labs"
                  className={styles.input}
                />
              </div>
              <div className={styles.twoCol}>
                <div className={styles.field}>
                  <label>Event Wi-Fi SSID</label>
                  <input
                    type="text"
                    value={config.venueGuide?.wifiSsid || ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        venueGuide: { ...config.venueGuide, wifiSsid: e.target.value },
                      })
                    }
                    placeholder="e.g. HackFlow-Guest"
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label>Wi-Fi Password</label>
                  <input
                    type="text"
                    value={config.venueGuide?.wifiPassword || ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        venueGuide: { ...config.venueGuide, wifiPassword: e.target.value },
                      })
                    }
                    placeholder="e.g. hackathon2026"
                    className={styles.input}
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label>Food & Facilities Timings</label>
                <input
                  type="text"
                  value={config.venueGuide?.foodTimings || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      venueGuide: { ...config.venueGuide, foodTimings: e.target.value },
                    })
                  }
                  placeholder="e.g. Lunch at 1:30 PM | Refreshments at 6:00 PM"
                  className={styles.input}
                />
              </div>
            </div>
          </div>
        )}

        {/* RULES */}
        {activeTab === "rules" && (
          <div className={styles.formCard}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Rules & Code of Conduct</h3>
              <button type="button" onClick={addRule} className={styles.addItemBtn}>
                + Add Rule
              </button>
            </div>
            <div className={styles.itemsList}>
              {config.rules?.map((rule, idx) => (
                <div key={rule.id} className={styles.itemRowStacked}>
                  <div className={styles.itemInputsStacked}>
                    <input
                      type="text"
                      value={rule.title}
                      onChange={(e) => updateRule(idx, "title", e.target.value)}
                      placeholder="Rule Title"
                      className={styles.input}
                    />
                    <textarea
                      value={rule.description}
                      onChange={(e) => updateRule(idx, "description", e.target.value)}
                      placeholder="Rule Explanation"
                      className={styles.textarea}
                      rows={2}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRule(idx)}
                    className={styles.deleteBtn}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FAQS */}
        {activeTab === "faqs" && (
          <div className={styles.formCard}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Frequently Asked Questions</h3>
              <button type="button" onClick={addFaq} className={styles.addItemBtn}>
                + Add FAQ
              </button>
            </div>
            <div className={styles.itemsList}>
              {config.faqs?.map((faq, idx) => (
                <div key={faq.id} className={styles.itemRowStacked}>
                  <div className={styles.itemInputsStacked}>
                    <input
                      type="text"
                      value={faq.question}
                      onChange={(e) => updateFaq(idx, "question", e.target.value)}
                      placeholder="Question"
                      className={styles.input}
                    />
                    <textarea
                      value={faq.answer}
                      onChange={(e) => updateFaq(idx, "answer", e.target.value)}
                      placeholder="Answer"
                      className={styles.textarea}
                      rows={2}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFaq(idx)}
                    className={styles.deleteBtn}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PREVIEW */}
        {activeTab === "preview" && (
          <div className={styles.previewContainer}>
            <div className={styles.previewControls}>
              <span className={styles.previewLabel}>Device Simulator:</span>
              <button
                type="button"
                className={`${styles.deviceBtn} ${previewDevice === "mobile" ? styles.deviceBtnActive : ""}`}
                onClick={() => setPreviewDevice("mobile")}
              >
                📱 Mobile Phone (390px)
              </button>
              <button
                type="button"
                className={`${styles.deviceBtn} ${previewDevice === "desktop" ? styles.deviceBtnActive : ""}`}
                onClick={() => setPreviewDevice("desktop")}
              >
                💻 Desktop Canvas
              </button>
            </div>

            <div
              className={
                previewDevice === "mobile" ? styles.mobileFrame : styles.desktopFrame
              }
            >
              <div className={styles.previewHero}>
                <span className={styles.previewBadge}>⚡ PHYSICAL HACKATHON</span>
                <h2 className={styles.previewTitle}>{config.heroTitle || event.title}</h2>
                <p className={styles.previewTagline}>
                  {config.heroTagline || "Participant portal preview."}
                </p>
              </div>

              {/* Seating / Venue Banner */}
              <div className={styles.previewVenueCard}>
                <h4>📍 Venue & Connectivity</h4>
                <div className={styles.previewVenueGrid}>
                  <div>
                    <strong>Hall:</strong> {config.venueGuide?.buildingName || "Auditorium"}
                  </div>
                  <div>
                    <strong>Wi-Fi:</strong> {config.venueGuide?.wifiSsid || "Venue-5G"} (PW:{" "}
                    {config.venueGuide?.wifiPassword || "hack2026"})
                  </div>
                </div>
              </div>

              {/* Schedule Section */}
              <div className={styles.previewSection}>
                <h4>⏱️ Timeline</h4>
                <div className={styles.previewScheduleList}>
                  {config.schedule?.map((item) => (
                    <div key={item.id} className={styles.previewScheduleItem}>
                      <span className={styles.previewTime}>{item.time}</span>
                      <div>
                        <strong>{item.title}</strong>
                        {item.phase && <span className={styles.previewPhase}>{item.phase}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* FAQs Section */}
              <div className={styles.previewSection}>
                <h4>❓ FAQs</h4>
                <div className={styles.previewFaqList}>
                  {config.faqs?.map((f) => (
                    <div key={f.id} className={styles.previewFaqItem}>
                      <strong>{f.question}</strong>
                      <p>{f.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

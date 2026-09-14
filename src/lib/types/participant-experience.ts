export interface ParticipantExperienceConfig {
  // Hero & Branding
  heroTitle?: string;
  heroTagline?: string;
  bannerUrl?: string;
  logoUrl?: string;
  themeColor?: string; // Accent tint

  // Schedule Timeline
  schedule?: Array<{
    id: string;
    time: string;
    title: string;
    description?: string;
    phase?: string; // e.g., "Registration", "Hacking", "Judging", "Results"
  }>;

  // Venue & Seating logistics guide
  venueGuide?: {
    buildingName?: string;
    floorInfo?: string;
    wifiSsid?: string;
    wifiPassword?: string;
    foodTimings?: string;
    emergencyHelpDesk?: string;
    customNotes?: string;
  };

  // Rules & Guidelines
  rules?: Array<{
    id: string;
    title: string;
    description: string;
  }>;

  // Problem Statements Presentation
  problemStatementNotice?: string;
  allowEarlyTeaser?: boolean;

  // FAQs
  faqs?: Array<{
    id: string;
    question: string;
    answer: string;
  }>;

  // Sponsors & Partners
  sponsors?: Array<{
    id: string;
    name: string;
    tier: "TITLE" | "PLATINUM" | "GOLD" | "COMMUNITY";
    logoUrl?: string;
    websiteUrl?: string;
  }>;

  // Support & Contact
  contacts?: {
    email?: string;
    phone?: string;
    discordUrl?: string;
    slackUrl?: string;
  };

  // Certificate Studio Template (Upload custom template + dynamic variables)
  certificateTemplate?: CustomCertificateTemplate;

  // Publication state
  isPublished?: boolean;
  publishedAt?: string;
}

export interface CertificateVariableElement {
  id: string;
  variable:
    | "participant_name"
    | "team_name"
    | "certificate_type"
    | "event_name"
    | "issue_date"
    | "verification_code"
    | "qr_code"
    | "custom_text";
  label: string;
  customText?: string;
  xPercent: number; // 0 to 100
  yPercent: number; // 0 to 100
  fontSize: number; // 12 - 96
  fontFamily: string; // 'Cinzel', 'Playfair Display', 'Inter', 'Outfit', 'Courier New'
  fontWeight: "normal" | "600" | "bold" | "800";
  color: string;
  align: "left" | "center" | "right";
  enabled: boolean;
  letterSpacing?: number; // -2 to 20 px
  textTransform?: "uppercase" | "none" | "capitalize";
  textShadow?: boolean;
  opacity?: number; // 0.1 to 1.0
  elementKind?: "text" | "qr" | "signature" | "seal";
}

export interface CustomCertificateTemplate {
  backgroundImageUrl?: string | null;
  presetKey?: "luxury-gold" | "royal-ivory" | "cyber-neon" | "emerald-clean" | "custom";
  canvasWidth: number;
  canvasHeight: number;
  elements: CertificateVariableElement[];
}

export const DEFAULT_CERTIFICATE_ELEMENTS: CertificateVariableElement[] = [
  {
    id: "cert_title",
    variable: "certificate_type",
    label: "Certificate Title / Type",
    xPercent: 50,
    yPercent: 28,
    fontSize: 48,
    fontFamily: "Cinzel",
    fontWeight: "800",
    color: "#f59e0b",
    align: "center",
    enabled: true,
  },
  {
    id: "cert_recipient",
    variable: "participant_name",
    label: "Participant Name",
    xPercent: 50,
    yPercent: 48,
    fontSize: 54,
    fontFamily: "Playfair Display",
    fontWeight: "bold",
    color: "#ffffff",
    align: "center",
    enabled: true,
  },
  {
    id: "cert_team",
    variable: "team_name",
    label: "Team Name",
    xPercent: 50,
    yPercent: 58,
    fontSize: 26,
    fontFamily: "Outfit",
    fontWeight: "600",
    color: "#94a3b8",
    align: "center",
    enabled: true,
  },
  {
    id: "cert_event",
    variable: "event_name",
    label: "Event Name",
    xPercent: 50,
    yPercent: 68,
    fontSize: 28,
    fontFamily: "Outfit",
    fontWeight: "600",
    color: "#e2e8f0",
    align: "center",
    enabled: true,
  },
  {
    id: "cert_date",
    variable: "issue_date",
    label: "Issue Date",
    xPercent: 22,
    yPercent: 86,
    fontSize: 20,
    fontFamily: "Inter",
    fontWeight: "normal",
    color: "#94a3b8",
    align: "center",
    enabled: true,
  },
  {
    id: "cert_code",
    variable: "verification_code",
    label: "Verification Code",
    xPercent: 78,
    yPercent: 86,
    fontSize: 18,
    fontFamily: "Courier New",
    fontWeight: "600",
    color: "#94a3b8",
    align: "center",
    enabled: true,
  },
  {
    id: "cert_qr",
    variable: "qr_code",
    label: "Verification QR Code",
    xPercent: 50,
    yPercent: 84,
    fontSize: 90, // Represents box size in px on 2000px canvas
    fontFamily: "Inter",
    fontWeight: "normal",
    color: "#ffffff",
    align: "center",
    enabled: true,
  },
];

export const DEFAULT_EXPERIENCE_CONFIG: ParticipantExperienceConfig = {
  heroTitle: "Build, Pitch, Win",
  heroTagline: "Join the most exhilarating physical hackathon experience.",
  schedule: [
    { id: "1", time: "09:00 AM", title: "Check-in & Desk Allotment", phase: "Check-in" },
    { id: "2", time: "10:30 AM", title: "Opening Ceremony & Problem Reveal", phase: "Launch" },
    { id: "3", time: "11:00 AM", title: "Hacking Begins (Screening Round)", phase: "Round 1" },
    { id: "4", time: "05:00 PM", title: "Screening Evaluation & Shortlisting", phase: "Judging 1" },
    { id: "5", time: "07:00 PM", title: "Final Round & Prototype Presentation", phase: "Round 2" },
    { id: "6", time: "09:00 PM", title: "Grand Awards & Certificates", phase: "Conclude" },
  ],
  venueGuide: {
    buildingName: "Main Tech Auditorium & Lab Wing",
    floorInfo: "Level 2 & 3",
    wifiSsid: "HackFlow-Venue-5G",
    wifiPassword: "hackathon-live",
    foodTimings: "Lunch at 1:30 PM | Refreshments at 6:00 PM",
    emergencyHelpDesk: "Ground Floor Room G04 / In-App Help Desk",
  },
  rules: [
    {
      id: "1",
      title: "Original Work Only",
      description: "All code, design, and assets must be developed during the hackathon timeline.",
    },
    {
      id: "2",
      title: "Universal QR & Desk Seating",
      description: "Keep your offline QR pass saved. Stay at your assigned desk for judge evaluations.",
    },
    {
      id: "3",
      title: "Submission Deliverables",
      description: "Submit your public GitHub repo URL and presentation slides before the round deadline.",
    },
  ],
  faqs: [
    {
      id: "1",
      question: "How do we check in at the venue?",
      answer: "Show your persistent Universal QR pass to any event volunteer at the entry gates.",
    },
    {
      id: "2",
      question: "What if Wi-Fi disconnects on my phone?",
      answer: "Click 'Download QR' on your participant dashboard in advance to save your pass offline.",
    },
    {
      id: "3",
      question: "How do I request help during the hackathon?",
      answer: "Use the 'Request Help' button right on your participant dashboard. Volunteers will be dispatched to your assigned desk.",
    },
  ],
  sponsors: [],
  isPublished: true,
};

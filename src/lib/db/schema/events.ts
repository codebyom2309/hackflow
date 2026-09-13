import {
  mysqlTable,
  varchar,
  int,
  text,
  boolean,
  timestamp,
  mysqlEnum,
  json,
  index,
} from "drizzle-orm/mysql-core";
import { users } from "./users";

export const events = mysqlTable(
  "events",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizerId: varchar("organizer_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),

    // Team constraints
    minTeamSize: int("min_team_size").notNull().default(1),
    maxTeamSize: int("max_team_size").notNull().default(5),
    maxTeams: int("max_teams"), // NULL = unlimited
    winnersCount: int("winners_count").notNull().default(3),

    // Registration
    registrationMethod: mysqlEnum("registration_method", [
      "NATIVE",
      "EXTERNAL",
    ])
      .notNull()
      .default("NATIVE"),
    externalFormUrl: varchar("external_form_url", { length: 512 }),
    googleSheetUrl: varchar("google_sheet_url", { length: 1024 }),
    autoSyncEnabled: boolean("auto_sync_enabled").notNull().default(false),
    lastSyncedAt: timestamp("last_synced_at"),
    syncIntervalMinutes: int("sync_interval_minutes").notNull().default(5),
    formSchema: json("form_schema"), // Dynamic form definition
    participantNotice: text("participant_notice"),

    // Timing
    registrationOpens: timestamp("registration_opens"),
    registrationCloses: timestamp("registration_closes"),
    eventStarts: timestamp("event_starts"),
    eventEnds: timestamp("event_ends"),

    // State
    status: mysqlEnum("status", [
      "DRAFT",
      "REGISTRATION_OPEN",
      "REGISTRATION_CLOSED",
      "EVENT_READY",
      "ROUND_ACTIVE",
      "EVENT_COMPLETED",
    ])
      .notNull()
      .default("DRAFT"),
    activeRoundId: varchar("active_round_id", { length: 36 }),

    // QR security — per-event HMAC secret
    qrSecret: varchar("qr_secret", { length: 255 }).notNull(),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => [
    index("idx_events_slug").on(table.slug),
    index("idx_events_organizer").on(table.organizerId),
    index("idx_events_status").on(table.status),
  ]
);

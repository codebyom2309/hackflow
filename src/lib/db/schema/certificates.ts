import {
  mysqlTable,
  varchar,
  timestamp,
  mysqlEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { events } from "./events";
import { teams } from "./teams";

export const certificates = mysqlTable(
  "certificates",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: varchar("event_id", { length: 36 })
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    teamId: varchar("team_id", { length: 36 })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    recipientName: varchar("recipient_name", { length: 255 }).notNull(),
    recipientEmail: varchar("recipient_email", { length: 255 }),

    type: mysqlEnum("type", [
      "PARTICIPANT",
      "WINNER",
      "RUNNER_UP",
      "FINALIST",
      "SPECIAL",
      "VOLUNTEER",
      "JUDGE",
      "COORDINATOR",
    ]).notNull(),

    // Verification
    verificationCode: varchar("verification_code", { length: 64 })
      .notNull()
      .unique(),

    // Template reference
    templateId: varchar("template_id", { length: 36 }),

    fileKey: varchar("file_key", { length: 512 }),

    generatedAt: timestamp("generated_at"),
    downloadedAt: timestamp("downloaded_at"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_certificates_team").on(table.teamId),
    index("idx_certificates_event").on(table.eventId),
    uniqueIndex("idx_certificates_verification").on(table.verificationCode),
  ]
);

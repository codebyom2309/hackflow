import {
  mysqlTable,
  varchar,
  timestamp,
  mysqlEnum,
  index,
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

    type: mysqlEnum("type", [
      "PARTICIPANT",
      "WINNER",
      "RUNNER_UP",
      "SPECIAL",
    ]).notNull(),
    fileKey: varchar("file_key", { length: 512 }),

    generatedAt: timestamp("generated_at"),
    downloadedAt: timestamp("downloaded_at"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_certificates_team").on(table.teamId),
    index("idx_certificates_event").on(table.eventId),
  ]
);

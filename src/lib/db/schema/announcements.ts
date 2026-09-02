import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  mysqlEnum,
  index,
} from "drizzle-orm/mysql-core";
import { events } from "./events";
import { users } from "./users";

export const announcements = mysqlTable(
  "announcements",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: varchar("event_id", { length: 36 })
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),

    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    priority: mysqlEnum("priority", ["LOW", "NORMAL", "HIGH", "URGENT"])
      .notNull()
      .default("NORMAL"),

    // Targeting
    targetRole: mysqlEnum("target_role", [
      "ALL",
      "PARTICIPANT",
      "COORDINATOR",
      "JUDGE",
    ]).default("ALL"),

    createdBy: varchar("created_by", { length: 36 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_announcements_event").on(table.eventId),
  ]
);

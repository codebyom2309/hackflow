import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  json,
  index,
} from "drizzle-orm/mysql-core";
import { events } from "./events";
import { users } from "./users";

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: varchar("event_id", { length: 36 }).references(() => events.id, {
      onDelete: "set null",
    }),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id),

    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: varchar("entity_id", { length: 36 }),

    details: json("details"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 512 }),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_audit_event").on(table.eventId),
    index("idx_audit_entity").on(table.entityType, table.entityId),
    index("idx_audit_action").on(table.action),
  ]
);

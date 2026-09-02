import {
  mysqlTable,
  varchar,
  timestamp,
  mysqlEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { users } from "./users";
import { events } from "./events";

export const eventMemberships = mysqlTable(
  "event_memberships",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    eventId: varchar("event_id", { length: 36 })
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", [
      "ORGANIZER",
      "COORDINATOR",
      "JUDGE",
      "PARTICIPANT",
    ]).notNull(),
    invitationId: varchar("invitation_id", { length: 36 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("uq_membership").on(table.userId, table.eventId, table.role),
    index("idx_membership_event_role").on(table.eventId, table.role),
    index("idx_membership_user").on(table.userId),
  ]
);

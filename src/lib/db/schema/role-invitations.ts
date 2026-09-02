import {
  mysqlTable,
  varchar,
  int,
  boolean,
  timestamp,
  mysqlEnum,
  index,
} from "drizzle-orm/mysql-core";
import { events } from "./events";
import { users } from "./users";

export const roleInvitations = mysqlTable(
  "role_invitations",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: varchar("event_id", { length: 36 })
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["COORDINATOR", "JUDGE"]).notNull(),
    token: varchar("token", { length: 255 }).notNull().unique(),

    // Security
    createdBy: varchar("created_by", { length: 36 })
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expires_at").notNull(),
    maxUses: int("max_uses").default(1),
    useCount: int("use_count").notNull().default(0),
    isRevoked: boolean("is_revoked").notNull().default(false),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_invitation_token").on(table.token),
    index("idx_invitation_event").on(table.eventId),
  ]
);

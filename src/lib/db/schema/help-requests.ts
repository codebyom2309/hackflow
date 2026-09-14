import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  mysqlEnum,
  index,
} from "drizzle-orm/mysql-core";
import { events } from "./events";
import { teams } from "./teams";
import { users } from "./users";

export const helpRequests = mysqlTable(
  "help_requests",
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
    participantId: varchar("participant_id", { length: 36 })
      .notNull()
      .references(() => users.id),

    category: mysqlEnum("category", [
      "TECHNICAL_ISSUE",
      "VENUE_ISSUE",
      "REGISTRATION_ISSUE",
      "TEAM_ISSUE",
      "FOOD_FACILITIES",
      "MENTOR_STAFF",
      "JUDGE_RELATED",
      "SUBMISSION_ISSUE",
      "OTHER",
    ])
      .notNull()
      .default("TECHNICAL_ISSUE"),

    priority: mysqlEnum("priority", ["LOW", "NORMAL", "HIGH", "URGENT"])
      .notNull()
      .default("NORMAL"),

    description: text("description").notNull(),
    location: varchar("location", { length: 255 }), // e.g., "Room 301 | Desk 12"

    status: mysqlEnum("status", [
      "SUBMITTED",
      "ASSIGNED",
      "IN_PROGRESS",
      "RESOLVED",
      "CLOSED",
    ])
      .notNull()
      .default("SUBMITTED"),

    assignedStaffId: varchar("assigned_staff_id", { length: 36 }).references(
      () => users.id
    ),
    resolutionNotes: text("resolution_notes"),
    resolvedAt: timestamp("resolved_at"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => [
    index("idx_help_requests_event").on(table.eventId),
    index("idx_help_requests_team").on(table.teamId),
    index("idx_help_requests_status").on(table.eventId, table.status),
    index("idx_help_requests_priority").on(table.eventId, table.priority),
    index("idx_help_requests_staff").on(table.assignedStaffId),
  ]
);

export const helpRequestMessages = mysqlTable(
  "help_request_messages",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    requestId: varchar("request_id", { length: 36 })
      .notNull()
      .references(() => helpRequests.id, { onDelete: "cascade" }),
    senderId: varchar("sender_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    message: text("message").notNull(),
    isStaffResponse: mysqlEnum("is_staff_response", ["YES", "NO"])
      .notNull()
      .default("NO"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_help_msg_request").on(table.requestId)]
);

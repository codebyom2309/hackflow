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
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { events } from "./events";
import { users } from "./users";
import { desks } from "./venue";

export const teams = mysqlTable(
  "teams",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: varchar("event_id", { length: 36 })
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    leaderId: varchar("leader_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 255 }).notNull(),
    memberCount: int("member_count").notNull(),

    // Physical allocation
    deskId: varchar("desk_id", { length: 36 }).references(() => desks.id, {
      onDelete: "set null",
    }),
    status: mysqlEnum("status", [
      "REGISTERED",
      "WAITLISTED",
      "CHECKED_IN",
      "ACTIVE",
      "SHORTLISTED",
      "ELIMINATED",
      "FINALIST",
      "WINNER",
    ])
      .notNull()
      .default("REGISTERED"),

    // QR
    qrToken: varchar("qr_token", { length: 255 }).notNull().unique(),

    // Registration data
    formResponses: json("form_responses"),
    projectName: varchar("project_name", { length: 255 }),
    projectDescription: text("project_description"),

    // Round tracking
    currentRoundId: varchar("current_round_id", { length: 36 }),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("uq_team_name").on(table.eventId, table.name),
    uniqueIndex("uq_team_leader").on(table.eventId, table.leaderId),
    index("idx_teams_event").on(table.eventId),
    index("idx_teams_desk").on(table.deskId),
    index("idx_teams_status").on(table.eventId, table.status),
    index("idx_teams_qr").on(table.qrToken),
  ]
);

export const teamMembers = mysqlTable(
  "team_members",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: varchar("team_id", { length: 36 })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    isLeader: boolean("is_leader").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_member_email_team").on(table.teamId, table.email),
    index("idx_members_team").on(table.teamId),
  ]
);

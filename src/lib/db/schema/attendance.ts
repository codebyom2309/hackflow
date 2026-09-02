import {
  mysqlTable,
  varchar,
  boolean,
  timestamp,
  mysqlEnum,
  index,
} from "drizzle-orm/mysql-core";
import { teams } from "./teams";
import { events } from "./events";
import { users } from "./users";

export const attendanceRecords = mysqlTable(
  "attendance_records",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: varchar("team_id", { length: 36 })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    eventId: varchar("event_id", { length: 36 })
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),

    // Who processed the check-in
    checkedInBy: varchar("checked_in_by", { length: 36 })
      .notNull()
      .references(() => users.id),
    checkInMethod: mysqlEnum("check_in_method", [
      "QR_SCAN",
      "MANUAL",
      "JUDGE_SCAN",
    ]).notNull(),

    // State
    isActive: boolean("is_active").notNull().default(true),

    checkedInAt: timestamp("checked_in_at").defaultNow(),
    undoneAt: timestamp("undone_at"),
    undoneBy: varchar("undone_by", { length: 36 }),
  },
  (table) => [
    index("idx_attendance_team").on(table.teamId),
    index("idx_attendance_event").on(table.eventId, table.isActive),
  ]
);

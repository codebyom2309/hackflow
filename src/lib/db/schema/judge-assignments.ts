import {
  mysqlTable,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { rounds } from "./rounds";
import { teams } from "./teams";
import { users } from "./users";
import { events } from "./events";

export const judgeAssignments = mysqlTable(
  "judge_assignments",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    judgeId: varchar("judge_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    teamId: varchar("team_id", { length: 36 })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    roundId: varchar("round_id", { length: 36 })
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    eventId: varchar("event_id", { length: 36 })
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_judge_team_round").on(
      table.judgeId,
      table.teamId,
      table.roundId
    ),
    index("idx_judge_assignments_judge").on(table.judgeId, table.roundId),
    index("idx_judge_assignments_team").on(table.teamId, table.roundId),
    index("idx_judge_assignments_event").on(table.eventId, table.roundId),
  ]
);

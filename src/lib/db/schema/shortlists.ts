import {
  mysqlTable,
  varchar,
  int,
  boolean,
  timestamp,
  decimal,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { teams } from "./teams";
import { rounds } from "./rounds";
import { events } from "./events";

export const shortlists = mysqlTable(
  "shortlists",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: varchar("team_id", { length: 36 })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    roundId: varchar("round_id", { length: 36 })
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    eventId: varchar("event_id", { length: 36 })
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),

    // Ranking — dual-rank architecture (see DECISIONS.md #D-011)
    calculatedRank: int("calculated_rank").notNull(),
    finalRank: int("final_rank"), // NULL = use calculated_rank
    totalScore: decimal("total_score", { precision: 10, scale: 2 }).notNull(),

    // Status
    isAdvancing: boolean("is_advancing").notNull(),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_shortlist").on(table.teamId, table.roundId),
    index("idx_shortlist_round").on(table.roundId, table.eventId),
    index("idx_shortlist_rank").on(
      table.eventId,
      table.roundId,
      table.finalRank
    ),
  ]
);

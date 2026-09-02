import {
  mysqlTable,
  varchar,
  int,
  boolean,
  timestamp,
  mysqlEnum,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { events } from "./events";

export const rounds = mysqlTable(
  "rounds",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: varchar("event_id", { length: 36 })
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    roundNumber: int("round_number").notNull(),
    title: varchar("title", { length: 255 }),

    // Timing
    startsAt: timestamp("starts_at"),
    endsAt: timestamp("ends_at"),
    problemRevealAt: timestamp("problem_reveal_at"),
    submissionDeadline: timestamp("submission_deadline"),

    // Problem statements stored as JSON array
    problemStatements: json("problem_statements"),

    // Configuration
    shortlistCount: int("shortlist_count"),
    retainDesks: boolean("retain_desks").notNull().default(true),

    // State
    status: mysqlEnum("status", [
      "DRAFT",
      "SUBMISSION_OPEN",
      "SUBMISSION_LOCKED",
      "JUDGING",
      "RESULTS_PENDING",
      "RESULTS_PUBLISHED",
    ])
      .notNull()
      .default("DRAFT"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("uq_round_number").on(table.eventId, table.roundNumber),
    index("idx_rounds_event").on(table.eventId),
  ]
);

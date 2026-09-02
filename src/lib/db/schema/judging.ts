import {
  mysqlTable,
  varchar,
  int,
  text,
  boolean,
  timestamp,
  decimal,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { rounds } from "./rounds";
import { teams } from "./teams";
import { users } from "./users";
import { events } from "./events";

export const evaluationCriteria = mysqlTable(
  "evaluation_criteria",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    roundId: varchar("round_id", { length: 36 })
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    maxPoints: int("max_points").notNull(),
    weight: decimal("weight", { precision: 5, scale: 2 }).notNull().default("1.00"),
    displayOrder: int("display_order").notNull().default(0),
    isRequired: boolean("is_required").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => [index("idx_criteria_round").on(table.roundId)]
);

export const judgmentScores = mysqlTable(
  "judgment_scores",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: varchar("team_id", { length: 36 })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    judgeId: varchar("judge_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    roundId: varchar("round_id", { length: 36 })
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    criteriaId: varchar("criteria_id", { length: 36 })
      .notNull()
      .references(() => evaluationCriteria.id, { onDelete: "cascade" }),
    eventId: varchar("event_id", { length: 36 })
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),

    score: int("score").notNull(),

    // Audit
    idempotencyKey: varchar("idempotency_key", { length: 255 }),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => [
    // CRITICAL: Prevents same judge from scoring same team+round+criterion twice
    uniqueIndex("uq_judgment").on(
      table.teamId,
      table.judgeId,
      table.roundId,
      table.criteriaId
    ),
    index("idx_judgment_team_round").on(table.teamId, table.roundId),
    index("idx_judgment_judge").on(table.judgeId, table.roundId),
    index("idx_judgment_event_round").on(table.eventId, table.roundId),
  ]
);

export const judgmentCorrections = mysqlTable(
  "judgment_corrections",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    judgmentId: varchar("judgment_id", { length: 36 })
      .notNull()
      .references(() => judgmentScores.id),
    originalScore: int("original_score").notNull(),
    correctedScore: int("corrected_score").notNull(),
    correctedBy: varchar("corrected_by", { length: 36 })
      .notNull()
      .references(() => users.id),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_corrections_judgment").on(table.judgmentId),
  ]
);

import {
  mysqlTable,
  varchar,
  int,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { teams } from "./teams";
import { rounds } from "./rounds";
import { events } from "./events";

export const submissions = mysqlTable(
  "submissions",
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

    // Submission data
    projectTitle: varchar("project_title", { length: 255 }),
    projectDescription: text("project_description"),
    githubUrl: varchar("github_url", { length: 512 }),
    pptFileKey: varchar("ppt_file_key", { length: 512 }),
    pptUrl: varchar("ppt_url", { length: 512 }),
    demoUrl: varchar("demo_url", { length: 512 }),
    pptFilename: varchar("ppt_filename", { length: 255 }),
    pptFileSize: int("ppt_file_size"),
    problemStatementId: varchar("problem_statement_id", { length: 36 }),

    // State
    isLocked: boolean("is_locked").notNull().default(false),
    submittedAt: timestamp("submitted_at"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("uq_submission").on(table.teamId, table.roundId),
    index("idx_submissions_round").on(table.roundId, table.eventId),
  ]
);

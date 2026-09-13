import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  json,
  boolean,
  mysqlEnum,
  index,
} from "drizzle-orm/mysql-core";
import { events } from "./events";

export const certificateTemplates = mysqlTable(
  "certificate_templates",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: varchar("event_id", { length: 36 })
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 255 }).notNull(),
    type: mysqlEnum("type", [
      "PARTICIPANT",
      "WINNER",
      "RUNNER_UP",
      "FINALIST",
      "SPECIAL",
      "VOLUNTEER",
      "JUDGE",
      "COORDINATOR",
    ]).notNull(),

    // Template design
    backgroundCss: text("background_css"), // CSS gradient or color
    backgroundImageUrl: varchar("background_image_url", { length: 512 }),
    fieldLayout: json("field_layout"), // Array of { field, x, y, fontSize, fontWeight, color, align }
    dimensions: json("dimensions"), // { width, height } in px

    isDefault: boolean("is_default").notNull().default(false),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => [
    index("idx_cert_templates_event").on(table.eventId),
    index("idx_cert_templates_type").on(table.eventId, table.type),
  ]
);

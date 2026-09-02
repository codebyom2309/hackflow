import {
  mysqlTable,
  varchar,
  timestamp,
  index,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 255 }).notNull().unique(),
    emailVerified: timestamp("emailVerified", { mode: "date" }),
    image: varchar("image", { length: 512 }),

    // Extended fields for HackFlow
    provider: varchar("provider", { length: 50 }).notNull().default("google"),
    providerId: varchar("provider_id", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => [
    index("idx_users_email").on(table.email),
    index("idx_users_provider").on(table.provider, table.providerId),
  ]
);

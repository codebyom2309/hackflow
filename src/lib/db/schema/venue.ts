import {
  mysqlTable,
  varchar,
  int,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { events } from "./events";

export const rooms = mysqlTable(
  "rooms",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: varchar("event_id", { length: 36 })
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    roomNumber: int("room_number").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("uq_room").on(table.eventId, table.roomNumber),
    index("idx_rooms_event").on(table.eventId),
  ]
);

export const desks = mysqlTable(
  "desks",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    roomId: varchar("room_id", { length: 36 })
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    deskNumber: int("desk_number").notNull(),
    capacity: int("capacity").notNull().default(4),
    isAllocated: boolean("is_allocated").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("uq_desk").on(table.roomId, table.deskNumber),
    index("idx_desks_room").on(table.roomId),
    index("idx_desks_available").on(
      table.roomId,
      table.isAllocated,
      table.capacity
    ),
  ]
);

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";
import * as fs from "fs";

// Read SSL CA certificate for TiDB connection
function getSSLConfig() {
  // 1. Raw CA certificate provided via env (ideal for Vercel / serverless)
  if (process.env.DATABASE_SSL_CA) {
    return {
      ssl: {
        ca: process.env.DATABASE_SSL_CA,
        minVersion: "TLSv1.2" as const,
      },
    };
  }

  // 2. CA file path (local development)
  const caPath = process.env.DATABASE_SSL_CA_PATH;
  if (caPath) {
    try {
      return {
        ssl: {
          ca: fs.readFileSync(caPath, "utf-8"),
          minVersion: "TLSv1.2" as const,
        },
      };
    } catch {
      console.warn(`[DB] SSL CA file not found at ${caPath}, falling back to system TLSv1.2`);
    }
  }

  // 3. Default for cloud/Vercel (Node.js includes Let's Encrypt ISRG Root X1 by default)
  return {
    ssl: {
      minVersion: "TLSv1.2" as const,
    },
  };
}

// Create MySQL connection pool for TiDB
const poolConnection = mysql.createPool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT) || 4000,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME || "hackflow",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ...getSSLConfig(),
});

// Initialize Drizzle ORM with schema
export const db = drizzle(poolConnection, {
  schema,
  mode: "default",
});

// Export for direct pool access (transactions, raw queries)
export { poolConnection };

// Export all schema for convenience
export * from "./schema";

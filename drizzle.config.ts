import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env.local" });

// Read SSL CA certificate
const caPath = process.env.DATABASE_SSL_CA_PATH;
let sslConfig: any = {};
if (caPath) {
  try {
    sslConfig = {
      ca: fs.readFileSync(path.resolve(caPath), "utf-8"),
      minVersion: "TLSv1.2",
    };
  } catch (e) {
    console.warn("Could not read SSL CA file, falling back to Amazon RDS");
    sslConfig = "Amazon RDS";
  }
}

export default defineConfig({
  schema: "./src/lib/db/schema/index.ts",
  out: "./src/lib/db/migrations",
  dialect: "mysql",
  dbCredentials: {
    host: process.env.DATABASE_HOST!,
    port: Number(process.env.DATABASE_PORT) || 4000,
    user: process.env.DATABASE_USER!,
    password: process.env.DATABASE_PASSWORD!,
    database: process.env.DATABASE_NAME || "hackflow",
    ssl: sslConfig,
  },
  verbose: true,
  strict: true,
});

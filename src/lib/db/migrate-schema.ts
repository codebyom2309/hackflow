import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import mysql from "mysql2/promise";
import * as fs from "fs";

function getSSLConfig() {
  if (process.env.DATABASE_SSL_CA) {
    return {
      ssl: {
        ca: process.env.DATABASE_SSL_CA,
        minVersion: "TLSv1.2" as const,
      },
    };
  }

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
      // fallback
    }
  }

  return {
    ssl: {
      minVersion: "TLSv1.2" as const,
    },
  };
}

async function main() {
  console.log("Running safe database schema synchronization to host:", process.env.DATABASE_HOST);

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT) || 4000,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || "hackflow",
    ...getSSLConfig(),
  });
  try {
    // 1. Create help_requests table if not exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS help_requests (
        id VARCHAR(255) PRIMARY KEY,
        event_id VARCHAR(255) NOT NULL,
        team_id VARCHAR(255) NOT NULL,
        participant_id VARCHAR(255) NOT NULL,
        category ENUM(
          'TECHNICAL_ISSUE',
          'VENUE_ISSUE',
          'REGISTRATION_ISSUE',
          'TEAM_ISSUE',
          'FOOD_FACILITIES',
          'MENTOR_STAFF',
          'JUDGE_RELATED',
          'SUBMISSION_ISSUE',
          'OTHER'
        ) NOT NULL DEFAULT 'TECHNICAL_ISSUE',
        priority ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
        description TEXT NOT NULL,
        location VARCHAR(255) NULL,
        status ENUM(
          'SUBMITTED',
          'ASSIGNED',
          'IN_PROGRESS',
          'RESOLVED',
          'CLOSED'
        ) NOT NULL DEFAULT 'SUBMITTED',
        assigned_staff_id VARCHAR(255) NULL,
        resolution_notes TEXT NULL,
        resolved_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_help_requests_event (event_id),
        INDEX idx_help_requests_team (team_id),
        INDEX idx_help_requests_status (event_id, status),
        INDEX idx_help_requests_priority (event_id, priority),
        INDEX idx_help_requests_staff (assigned_staff_id)
      );
    `);
    console.log("✓ Created/verified help_requests table");

    // 3. Create help_request_messages table
    console.log("Creating help_request_messages table if not exists...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS help_request_messages (
        id VARCHAR(255) PRIMARY KEY,
        request_id VARCHAR(255) NOT NULL,
        sender_id VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_staff_response ENUM('YES', 'NO') NOT NULL DEFAULT 'NO',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_help_msg_request (request_id)
      );
    `);
    console.log("✓ Created/verified help_request_messages table");

    console.log("\n🎉 Schema synchronization completed successfully!");
  } catch (error) {
    console.error("Schema synchronization failed:", error);
    process.exit(1);
  } finally {
    await connection.end();
    process.exit(0);
  }
}

main();

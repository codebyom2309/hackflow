// Push schema changes to database, handling the new tables and columns
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config({ path: ".env.local" });

const caPath = process.env.DATABASE_SSL_CA_PATH;
let sslConfig: any = {};
if (caPath) {
  try {
    sslConfig = {
      ca: fs.readFileSync(caPath, "utf-8"),
      minVersion: "TLSv1.2",
    };
  } catch {
    sslConfig = { minVersion: "TLSv1.2" };
  }
}

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT) || 4000,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || "hackflow",
    ssl: sslConfig,
    multipleStatements: true,
  });

  try {
    console.log("🔄 Running schema migrations...\n");

    // 1. Add new columns to teams table
    const teamCols = [
      "ALTER TABLE `teams` ADD COLUMN IF NOT EXISTS `leader_email` varchar(255);",
      "ALTER TABLE `teams` ADD COLUMN IF NOT EXISTS `leader_phone` varchar(20);",
      "ALTER TABLE `teams` ADD COLUMN IF NOT EXISTS `college` varchar(255);",
      "ALTER TABLE `teams` ADD COLUMN IF NOT EXISTS `theme` varchar(255);",
      "ALTER TABLE `teams` ADD COLUMN IF NOT EXISTS `problem_statement` text;",
    ];
    for (const sql of teamCols) {
      try {
        await conn.execute(sql);
        console.log("  ✅ " + sql.substring(0, 80) + "...");
      } catch (e: any) {
        if (e.code === "ER_DUP_FIELDNAME" || e.message?.includes("Duplicate column")) {
          console.log("  ⏭️  Column already exists, skipping");
        } else {
          console.error("  ❌ " + e.message);
        }
      }
    }

    // 2. Create judge_assignments table
    try {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS \`judge_assignments\` (
          \`id\` varchar(36) PRIMARY KEY,
          \`judge_id\` varchar(36) NOT NULL,
          \`team_id\` varchar(36) NOT NULL,
          \`round_id\` varchar(36) NOT NULL,
          \`event_id\` varchar(36) NOT NULL,
          \`created_at\` timestamp DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT \`fk_ja_judge\` FOREIGN KEY (\`judge_id\`) REFERENCES \`users\`(\`id\`),
          CONSTRAINT \`fk_ja_team\` FOREIGN KEY (\`team_id\`) REFERENCES \`teams\`(\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_ja_round\` FOREIGN KEY (\`round_id\`) REFERENCES \`rounds\`(\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_ja_event\` FOREIGN KEY (\`event_id\`) REFERENCES \`events\`(\`id\`) ON DELETE CASCADE,
          UNIQUE KEY \`uq_judge_team_round\` (\`judge_id\`, \`team_id\`, \`round_id\`),
          KEY \`idx_judge_assignments_judge\` (\`judge_id\`, \`round_id\`),
          KEY \`idx_judge_assignments_team\` (\`team_id\`, \`round_id\`),
          KEY \`idx_judge_assignments_event\` (\`event_id\`, \`round_id\`)
        );
      `);
      console.log("  ✅ Created judge_assignments table");
    } catch (e: any) {
      if (e.message?.includes("already exists")) {
        console.log("  ⏭️  judge_assignments already exists");
      } else {
        console.error("  ❌ judge_assignments: " + e.message);
      }
    }

    // 3. Create certificate_templates table
    try {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS \`certificate_templates\` (
          \`id\` varchar(36) PRIMARY KEY,
          \`event_id\` varchar(36) NOT NULL,
          \`name\` varchar(255) NOT NULL,
          \`type\` enum('PARTICIPANT','WINNER','RUNNER_UP','FINALIST','SPECIAL','VOLUNTEER','JUDGE','COORDINATOR') NOT NULL,
          \`background_css\` text,
          \`background_image_url\` varchar(512),
          \`field_layout\` json,
          \`dimensions\` json,
          \`is_default\` boolean NOT NULL DEFAULT false,
          \`created_at\` timestamp DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT \`fk_ct_event\` FOREIGN KEY (\`event_id\`) REFERENCES \`events\`(\`id\`) ON DELETE CASCADE,
          KEY \`idx_cert_templates_event\` (\`event_id\`),
          KEY \`idx_cert_templates_type\` (\`event_id\`, \`type\`)
        );
      `);
      console.log("  ✅ Created certificate_templates table");
    } catch (e: any) {
      if (e.message?.includes("already exists")) {
        console.log("  ⏭️  certificate_templates already exists");
      } else {
        console.error("  ❌ certificate_templates: " + e.message);
      }
    }

    // 4. Update certificates table — add new columns
    const certCols = [
      "ALTER TABLE `certificates` ADD COLUMN IF NOT EXISTS `verification_code` varchar(64);",
      "ALTER TABLE `certificates` ADD COLUMN IF NOT EXISTS `recipient_email` varchar(255);",
      "ALTER TABLE `certificates` ADD COLUMN IF NOT EXISTS `template_id` varchar(36);",
    ];
    for (const sql of certCols) {
      try {
        await conn.execute(sql);
        console.log("  ✅ " + sql.substring(0, 80) + "...");
      } catch (e: any) {
        if (e.code === "ER_DUP_FIELDNAME" || e.message?.includes("Duplicate column")) {
          console.log("  ⏭️  Column already exists, skipping");
        } else {
          console.error("  ❌ " + e.message);
        }
      }
    }

    // 5. Update certificates type enum
    try {
      await conn.execute(`
        ALTER TABLE \`certificates\` MODIFY COLUMN \`type\` enum('PARTICIPANT','WINNER','RUNNER_UP','FINALIST','SPECIAL','VOLUNTEER','JUDGE','COORDINATOR') NOT NULL;
      `);
      console.log("  ✅ Updated certificates type enum");
    } catch (e: any) {
      console.error("  ⚠️  certificates type enum: " + e.message);
    }

    // 6. Add unique index on verification_code (update existing null rows first)
    try {
      // Fill any existing null verification_codes with random values
      await conn.execute(`
        UPDATE \`certificates\` SET \`verification_code\` = CONCAT('cert_', REPLACE(UUID(), '-', ''))
        WHERE \`verification_code\` IS NULL;
      `);
      await conn.execute(`
        ALTER TABLE \`certificates\` MODIFY COLUMN \`verification_code\` varchar(64) NOT NULL;
      `);
      console.log("  ✅ Updated verification_code to NOT NULL");
    } catch (e: any) {
      console.log("  ⚠️  verification_code update: " + e.message);
    }

    try {
      await conn.execute(`
        CREATE UNIQUE INDEX \`idx_certificates_verification\` ON \`certificates\` (\`verification_code\`);
      `);
      console.log("  ✅ Added unique index on verification_code");
    } catch (e: any) {
      if (e.message?.includes("Duplicate")) {
        console.log("  ⏭️  verification_code index already exists");
      } else {
        console.log("  ⚠️  verification index: " + e.message);
      }
    }

    console.log("\n✅ Migration complete!");
  } finally {
    await conn.end();
  }
}

migrate().catch(console.error);

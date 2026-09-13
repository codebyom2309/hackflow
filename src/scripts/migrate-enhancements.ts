import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function run() {
  const { poolConnection } = await import("../lib/db");
  const stmts = [
    "ALTER TABLE events ADD COLUMN IF NOT EXISTS google_sheet_url VARCHAR(1024);",
    "ALTER TABLE events ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE;",
    "ALTER TABLE events ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP NULL;",
    "ALTER TABLE events ADD COLUMN IF NOT EXISTS sync_interval_minutes INT NOT NULL DEFAULT 5;",
    "ALTER TABLE events ADD COLUMN IF NOT EXISTS participant_notice TEXT NULL;",
    "ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_venue VARCHAR(100) DEFAULT 'ALL';",
    "ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_team_status VARCHAR(50) DEFAULT 'ALL';",
    "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS project_title VARCHAR(255) NULL;",
    "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS project_description TEXT NULL;",
    "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS demo_url VARCHAR(512) NULL;",
    "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS ppt_url VARCHAR(512) NULL;",
    "ALTER TABLE event_memberships ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP NULL;",
    "ALTER TABLE event_memberships ADD COLUMN IF NOT EXISTS actions_count INT NOT NULL DEFAULT 0;",
    "ALTER TABLE teams ADD COLUMN IF NOT EXISTS github_url VARCHAR(512) NULL;",
    "ALTER TABLE teams ADD COLUMN IF NOT EXISTS ppt_url VARCHAR(512) NULL;",
    "ALTER TABLE teams ADD COLUMN IF NOT EXISTS demo_url VARCHAR(512) NULL;",
  ];

  console.log("Applying schema enhancements to TiDB...");
  for (const sql of stmts) {
    try {
      await poolConnection.query(sql);
      console.log("✓ Success:", sql.slice(0, 55));
    } catch (err: any) {
      console.error("✗ Error executing:", sql, err.message);
    }
  }
  console.log("All migrations applied successfully!");
  process.exit(0);
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});

async function inspectDOM() {
  console.log("=== Inspecting Live HTML / DOM from http://localhost:3000 ===");

  // 1. Inspect Import Page
  try {
    const importRes = await fetch("http://localhost:3000/events/hackathon-824866/manage/import");
    const importHtml = await importRes.text();
    console.log("\n[1] /events/hackathon-824866/manage/import:");
    console.log("  HTTP Status:", importRes.status);
    console.log("  Contains 'Import Registration Roster':", importHtml.includes("Import Registration Roster"));
    console.log("  Contains 'Upload Spreadsheet':", importHtml.includes("Upload Spreadsheet"));
    console.log("  Contains 'Paste Spreadsheet':", importHtml.includes("Paste Spreadsheet"));
    console.log("  Contains 'Live Google Form & Sheet Sync':", importHtml.includes("Live Google Form &amp; Sheet Sync") || importHtml.includes("Live Google Form & Sheet Sync"));
    console.log("  Contains Webhook URL text:", importHtml.includes("/api/events/hackathon-824866/form-webhook"));
    console.log("  Contains Apps Script code:", importHtml.includes("function onFormSubmit(e)"));
    console.log("  Contains 'Send Test Webhook Ping':", importHtml.includes("Send Test Webhook Ping"));
    console.log("  Contains 'Sync Live from Google Sheet Link':", importHtml.includes("Sync Live from Google Sheet Link"));
  } catch (err) {
    console.error("  Error fetching import page:", err.message);
  }

  // 2. Inspect Event Main Portal Page
  try {
    const eventRes = await fetch("http://localhost:3000/events/hackathon-824866");
    const eventHtml = await eventRes.text();
    console.log("\n[2] /events/hackathon-824866:");
    console.log("  HTTP Status:", eventRes.status);
    console.log("  Contains event title:", eventHtml.includes("hackathon"));
    console.log("  Contains 'Enter Participant Dashboard':", eventHtml.includes("Dashboard") || eventHtml.includes("Participant"));
  } catch (err) {
    console.error("  Error fetching event page:", err.message);
  }

  // 3. Inspect Live Webhook Endpoint
  try {
    const hookRes = await fetch("http://localhost:3000/api/events/hackathon-824866/form-webhook");
    const hookJson = await hookRes.json();
    console.log("\n[3] /api/events/hackathon-824866/form-webhook (GET):");
    console.log("  HTTP Status:", hookRes.status);
    console.log("  Payload:", hookJson);
  } catch (err) {
    console.error("  Error fetching webhook:", err.message);
  }

  console.log("\n=== DOM & SERVER INSPECTION COMPLETE ===");
}

inspectDOM();

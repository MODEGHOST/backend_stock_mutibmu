import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { env } from "./config/env.js";
import { sendLineErrorAlert } from "./utils/lineNotify.js";

// Initialize Sentry only if DSN is provided
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0, 
    profilesSampleRate: 1.0, 
  });
  console.log("✓ Sentry tracking initialized");
}

import { createApp } from "./app.js";
import { seedSystemOwner } from "./services/auth.service.js";

const app = createApp();


await seedSystemOwner();

process.on("uncaughtException", async (err) => {
  console.error("Uncaught Exception:", err);
  await sendLineErrorAlert(`🚨 FATAL CRASH (Uncaught Exception)\n\n📝 ${err?.message}`);
  process.exit(1);
});

process.on("unhandledRejection", async (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
  await sendLineErrorAlert(`🚨 FATAL CRASH (Unhandled Rejection)\n\n📝 ${reason}`);
  process.exit(1);
});

app.listen(env.PORT, () => {
  console.log(`API running on :${env.PORT}`);
});

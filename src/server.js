import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { seedSystemOwner } from "./services/auth.service.js";

const app = createApp();

await seedSystemOwner();

app.listen(env.PORT, () => {
  console.log(`API running on :${env.PORT}`);
});

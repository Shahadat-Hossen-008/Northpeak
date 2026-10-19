import { startServer } from "./server.js";

startServer().catch((err) => {
  console.error("[Server] Startup failed:", err);
  process.exit(1);
});

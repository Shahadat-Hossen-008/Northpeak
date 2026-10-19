import { app } from "./app.js";
import { startServer } from "./server.js";

// Start server if index.ts is run directly outside tests
startServer().catch((err) => {
  console.error("[Server] Startup failed:", err);
  process.exit(1);
});

export { app, startServer };
export default app;

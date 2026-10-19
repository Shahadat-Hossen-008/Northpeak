import { app } from "./app.js";
import { config } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { startAssignmentReconciler } from "./services/reconcile.service.js";
import { setupGracefulShutdown } from "./services/shutdown.js";

export async function startServer() {
  await connectDB();

  const server = app.listen(config.PORT, () => {
    console.log(
      `[Server] Northpeak Express server running in ${config.NODE_ENV} mode on http://localhost:${config.PORT}`,
    );
  });

  // Safety-net reconciler (RECONCILE_INTERVAL_MS, default 5 min; 0 disables).
  const parsedInterval = Number.parseInt(process.env.RECONCILE_INTERVAL_MS ?? "", 10);
  startAssignmentReconciler(Number.isFinite(parsedInterval) ? parsedInterval : 5 * 60 * 1000);

  setupGracefulShutdown(server);
  return server;
}

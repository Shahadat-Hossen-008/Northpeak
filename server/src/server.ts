import { app } from "./app.js";
import { config } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { setupGracefulShutdown } from "./services/shutdown.js";

export async function startServer() {
  await connectDB();

  const server = app.listen(config.PORT, () => {
    console.log(
      `[Server] Northpeak Express server running in ${config.NODE_ENV} mode on http://localhost:${config.PORT}`,
    );
  });

  setupGracefulShutdown(server);
  return server;
}


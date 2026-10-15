import type { Server } from "node:http";
import mongoose from "mongoose";

export function setupGracefulShutdown(server: Server): void {
  let isShuttingDown = false;

  async function shutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[Server] Received ${signal}. Starting graceful shutdown...`);

    // Force exit after 10 seconds if shutdown hangs
    const forceExitTimer = setTimeout(() => {
      console.error("[Server] Graceful shutdown timed out after 10s. Forcing exit.");
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    // 1. Stop accepting new HTTP connections and close idle keep-alive connections
    server.closeIdleConnections?.();
    server.close(async (err) => {
      if (err) {
        console.error("[Server] Error closing HTTP listener:", err);
        process.exit(1);
      }

      console.log("[Server] HTTP server closed. Draining database connection...");

      try {
        // 2. Cleanly close Mongoose connection
        await mongoose.connection.close(false);
        console.log("[Server] Database connection closed cleanly.");
        process.exit(0);
      } catch (dbErr) {
        console.error("[Server] Error closing database connection:", dbErr);
        process.exit(1);
      }
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    console.error("[Server] Unhandled Promise Rejection:", reason);
    shutdown("unhandledRejection");
  });

  process.on("uncaughtException", (error) => {
    console.error("[Server] Uncaught Exception:", error);
    shutdown("uncaughtException");
  });
}

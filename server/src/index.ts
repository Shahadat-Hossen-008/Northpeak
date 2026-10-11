import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import { authRouter } from "./routes/auth.js";
import { membersRouter } from "./routes/members.js";
import { projectsRouter } from "./routes/projects.js";
import { tasksRouter } from "./routes/tasks.js";
import { subtasksRouter } from "./routes/subtasks.js";
import { commentsRouter } from "./routes/comments.js";
import { notificationsRouter } from "./routes/notifications.js";
import { activityRouter } from "./routes/activity.js";
import { testBarriersRouter } from "./routes/testBarriers.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173", "http://localhost:8080"],
    credentials: true,
  }),
);
app.use(express.json());

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/members", membersRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/subtasks", subtasksRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/activity", activityRouter);
app.use("/api/test/barriers", testBarriersRouter);

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "Northpeak API",
    timestamp: new Date().toISOString(),
  });
});

// Start server
async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[Server] Northpeak Express server running on http://localhost:${PORT}`);
  });
}

startServer();

export default app;

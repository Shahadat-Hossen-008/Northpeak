import mongoose from "mongoose";
import { config } from "./env.js";

export async function connectDB(overrideUri?: string): Promise<void> {
  const uri = overrideUri || config.MONGODB_URI;

  try {
    const conn = await mongoose.connect(uri);
    console.log(`[Database] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error("[Database] MongoDB connection error:", error);
    process.exit(1);
  }
}

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "../config/db.js";
import { User } from "../models/User.js";
import { Project } from "../models/Project.js";
import { Task } from "../models/Task.js";
import { Subtask } from "../models/Subtask.js";
import { Comment } from "../models/Comment.js";
import { Activity } from "../models/Activity.js";
import { Notification } from "../models/Notification.js";

async function seed() {
  console.log("[Seed] Starting MongoDB database seeder...");
  await connectDB();

  // Clear existing collections
  await Promise.all([
    User.deleteMany({}),
    Project.deleteMany({}),
    Task.deleteMany({}),
    Subtask.deleteMany({}),
    Comment.deleteMany({}),
    Activity.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash("password123", salt);

  // 1. Create Users
  const nadia = await User.create({
    name: "Nadia Chowdhury",
    email: "nadia@northpeak.dev",
    passwordHash,
    role: "manager",
  });

  const sarah = await User.create({
    name: "Sarah Khan",
    email: "sarah@northpeak.dev",
    passwordHash,
    role: "developer",
  });

  const rahim = await User.create({
    name: "Rahim Ahmed",
    email: "rahim@northpeak.dev",
    passwordHash,
    role: "developer",
  });

  const john = await User.create({
    name: "John Smith",
    email: "john@northpeak.dev",
    passwordHash,
    role: "developer",
  });

  const ayesha = await User.create({
    name: "Ayesha Rahman",
    email: "ayesha@northpeak.dev",
    passwordHash,
    role: "developer",
  });

  console.log("[Seed] Created 5 users");

  // 2. Create Projects
  const now = new Date();
  const dayMs = 86_400_000;

  const ecommerce = await Project.create({
    title: "E-Commerce Platform",
    description: "Storefront, cart, checkout and order management for a multi-vendor marketplace.",
    manager: nadia._id,
    team: [sarah._id, rahim._id, john._id, ayesha._id],
    startDate: new Date(now.getTime() - 40 * dayMs),
    deadline: new Date(now.getTime() + 18 * dayMs),
    priority: "high",
  });

  const banking = await Project.create({
    title: "Mobile Banking Application",
    description: "Secure account access, transfers and card controls for iOS and Android.",
    manager: nadia._id,
    team: [rahim._id, sarah._id],
    startDate: new Date(now.getTime() - 25 * dayMs),
    deadline: new Date(now.getTime() + 9 * dayMs),
    priority: "critical",
  });

  const hospital = await Project.create({
    title: "Hospital Management System",
    description: "Patient records, appointment scheduling and billing for a 300-bed hospital.",
    manager: nadia._id,
    team: [john._id],
    startDate: new Date(now.getTime() - 60 * dayMs),
    deadline: new Date(now.getTime() - 3 * dayMs), // Overdue
    priority: "high",
  });

  const lms = await Project.create({
    title: "Learning Management System",
    description: "Course authoring, enrolments and progress tracking for online cohorts.",
    manager: nadia._id,
    team: [ayesha._id],
    startDate: new Date(now.getTime() - 12 * dayMs),
    deadline: new Date(now.getTime() + 46 * dayMs),
    priority: "medium",
  });

  console.log("[Seed] Created 4 projects");

  // 3. Create Tasks
  const task1 = await Task.create({
    project: ecommerce._id,
    title: "Authentication API",
    description: "JWT login, refresh tokens and password reset endpoints.",
    assignedDeveloper: sarah._id,
    deadline: new Date(now.getTime() + 4 * dayMs),
    priority: "high",
    isCompleted: false,
  });

  const task2 = await Task.create({
    project: ecommerce._id,
    title: "Product catalogue service",
    description: "Search, filtering and pagination across vendor catalogues.",
    assignedDeveloper: rahim._id,
    deadline: new Date(now.getTime() + 1 * dayMs), // Due soon
    priority: "critical",
    isCompleted: false,
  });

  const task3 = await Task.create({
    project: ecommerce._id,
    title: "Checkout flow UI",
    description: "Multi-step checkout with address book and saved cards.",
    assignedDeveloper: john._id,
    deadline: new Date(now.getTime() - 2 * dayMs), // Overdue
    priority: "high",
    isCompleted: false,
  });

  const task4 = await Task.create({
    project: ecommerce._id,
    title: "Vendor onboarding forms",
    description: "KYC upload and store profile setup.",
    assignedDeveloper: ayesha._id,
    deadline: new Date(now.getTime() - 6 * dayMs),
    priority: "medium",
    isCompleted: true,
    completedAt: new Date(now.getTime() - 7 * dayMs),
  });

  const task5 = await Task.create({
    project: banking._id,
    title: "Biometric login",
    description: "Face ID and fingerprint unlock with secure enclave storage.",
    assignedDeveloper: rahim._id,
    deadline: new Date(now.getTime() + 2 * dayMs), // Due soon
    priority: "critical",
    isCompleted: false,
  });

  const task6 = await Task.create({
    project: hospital._id,
    title: "Patient records module",
    description: "Create, search and version patient medical records.",
    assignedDeveloper: john._id,
    deadline: new Date(now.getTime() - 8 * dayMs), // Overdue
    priority: "critical",
    isCompleted: false,
  });

  const task7 = await Task.create({
    project: lms._id,
    title: "Course builder",
    description: "Drag-and-drop lesson and module authoring.",
    assignedDeveloper: ayesha._id,
    deadline: new Date(now.getTime() + 15 * dayMs),
    priority: "high",
    isCompleted: false,
  });

  console.log("[Seed] Created 7 tasks");

  // 4. Create Subtasks
  await Subtask.create([
    {
      task: task1._id,
      title: "Create User model",
      isCompleted: true,
      completedAt: new Date(now.getTime() - 6 * dayMs),
    },
    {
      task: task1._id,
      title: "Configure JWT signing",
      isCompleted: true,
      completedAt: new Date(now.getTime() - 4 * dayMs),
    },
    { task: task1._id, title: "Login endpoint", isCompleted: false },
    { task: task1._id, title: "Refresh token rotation", isCompleted: false },
    {
      task: task2._id,
      title: "Elasticsearch index mapping",
      isCompleted: true,
      completedAt: new Date(now.getTime() - 3 * dayMs),
    },
    { task: task2._id, title: "Faceted filter API", isCompleted: false },
    {
      task: task3._id,
      title: "Address book component",
      isCompleted: true,
      completedAt: new Date(now.getTime() - 5 * dayMs),
    },
    { task: task3._id, title: "Payment step validation", isCompleted: false },
    {
      task: task5._id,
      title: "Secure enclave key storage",
      isCompleted: true,
      completedAt: new Date(now.getTime() - 2 * dayMs),
    },
    { task: task5._id, title: "Fallback PIN flow", isCompleted: false },
    { task: task6._id, title: "Record versioning schema", isCompleted: false },
    { task: task7._id, title: "Lesson drag-and-drop", isCompleted: false },
  ]);

  console.log("[Seed] Created subtasks");

  // 5. Create Comments
  await Comment.create([
    {
      task: task1._id,
      author: sarah._id,
      body: "I've completed the JWT middleware. Login endpoint is next.",
    },
    {
      task: task1._id,
      author: nadia._id,
      body: "Great. Please keep refresh token rotation in the same PR.",
    },
    {
      task: task2._id,
      author: rahim._id,
      body: "Search latency is at 90ms after the new index mapping.",
    },
    {
      task: task6._id,
      author: nadia._id,
      body: "This one is overdue — can we get a status update today?",
    },
  ]);

  console.log("[Seed] Created comments");

  // 6. Create Activities
  await Activity.create([
    {
      project: ecommerce._id,
      task: task1._id,
      actor: sarah._id,
      message: "commented on Authentication API",
    },
    { project: banking._id, task: task5._id, actor: rahim._id, message: "started Biometric login" },
    {
      project: hospital._id,
      task: task6._id,
      actor: nadia._id,
      message: "flagged Patient records module as overdue",
    },
    { project: lms._id, task: task7._id, actor: nadia._id, message: "created Course builder" },
  ]);

  // 7. Create Notifications
  await Notification.create([
    {
      audience: "manager",
      kind: "task_overdue",
      title: "Task overdue",
      body: "Patient records module is 8 days past its deadline.",
      task: task6._id,
      project: hospital._id,
      isRead: false,
    },
    {
      audience: "manager",
      kind: "deadline_approaching",
      title: "Deadline approaching",
      body: "Product catalogue service is due tomorrow.",
      task: task2._id,
      project: ecommerce._id,
      isRead: false,
    },
    {
      recipient: sarah._id,
      kind: "task_assigned",
      title: "New task assigned",
      body: "Authentication API",
      task: task1._id,
      project: ecommerce._id,
      isRead: false,
    },
  ]);

  console.log("[Seed] Database seeded successfully!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("[Seed] Error:", err);
  process.exit(1);
});

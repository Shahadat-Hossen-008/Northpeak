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

const MANAGER = {
  name: "Nadia Chowdhury",
  email: "nadia@northpeak.dev",
  password: "Password123!",
};

const DAY = 86_400_000;

const dateOffset = (days: number) => new Date(Date.now() + days * DAY);

const stats = {
  users: 0,
  projects: 0,
  tasks: 0,
  subtasks: 0,
  comments: 0,
  activities: 0,
  notifications: 0,
};

async function upsert<T>(
  Model: mongoose.Model<T>,
  filter: mongoose.FilterQuery<T>,
  document: Record<string, unknown>,
) {
  return Model.findOneAndUpdate(
    filter,
    { $setOnInsert: document },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    },
  );
}

// Each task: title, description, priority, deadline offset,
// status, subtasks.
const projectDefinitions = [
  {
    title: "E-Commerce Platform",
    description:
      "Development of a scalable multi-vendor commerce platform covering storefronts, product discovery, checkout, payments and order management.",
    priority: "high",
    start: -40,
    deadline: 25,
    tasks: [
      {
        title: "Design storefront architecture",
        description:
          "Define the storefront application structure, reusable layouts and component boundaries.",
        priority: "high",
        due: 4,
        status: "done",
        subtasks: ["Define page architecture", "Document component boundaries"],
      },
      {
        title: "Implement authentication endpoints",
        description: "Build registration, login, refresh token and logout endpoints.",
        priority: "critical",
        due: 3,
        status: "in_progress",
        subtasks: ["Implement login endpoint", "Implement refresh token rotation"],
      },
      {
        title: "Build product catalogue API",
        description: "Develop product listing, filtering, sorting and pagination.",
        priority: "critical",
        due: 1,
        status: "todo",
        subtasks: ["Implement product filters", "Add pagination support"],
      },
      {
        title: "Create product detail page",
        description: "Build product information, pricing, stock and image presentation.",
        priority: "high",
        due: 8,
        status: "in_progress",
        subtasks: ["Build product gallery", "Display product specifications"],
      },
      {
        title: "Develop shopping cart",
        description: "Implement cart operations and persistent cart state.",
        priority: "high",
        due: 10,
        status: "todo",
        subtasks: ["Add items to cart", "Implement quantity updates"],
      },
      {
        title: "Implement checkout workflow",
        description:
          "Build the multi-step checkout experience with shipping and billing information.",
        priority: "critical",
        due: -2,
        status: "in_review",
        subtasks: ["Build shipping form", "Add order summary"],
      },
      {
        title: "Integrate payment gateway",
        description:
          "Connect payment processing with transaction verification and failure handling.",
        priority: "critical",
        due: 12,
        status: "todo",
        subtasks: ["Configure payment provider", "Handle payment callbacks"],
      },
      {
        title: "Build vendor onboarding",
        description: "Create vendor registration and store profile setup.",
        priority: "medium",
        due: -5,
        status: "done",
        subtasks: ["Create vendor registration form", "Add store profile fields"],
      },
      {
        title: "Implement order management",
        description: "Create order processing, order history and status tracking.",
        priority: "high",
        due: 15,
        status: "todo",
        subtasks: ["Create order history API", "Implement order status tracking"],
      },
      {
        title: "Add automated checkout tests",
        description: "Cover checkout validation, payment failures and successful order placement.",
        priority: "medium",
        due: 20,
        status: "todo",
        subtasks: ["Test successful checkout", "Test payment failure scenarios"],
      },
    ],
  },
  {
    title: "Mobile Banking Application",
    description:
      "A secure digital banking experience with account overview, fund transfers, transaction history, authentication and card management.",
    priority: "critical",
    start: -28,
    deadline: 18,
    tasks: [
      {
        title: "Define banking API architecture",
        description: "Establish API boundaries, security requirements and service communication.",
        priority: "critical",
        due: -3,
        status: "done",
        subtasks: ["Document API contracts", "Define service boundaries"],
      },
      {
        title: "Implement secure login",
        description: "Develop secure authentication with session management and token validation.",
        priority: "critical",
        due: 2,
        status: "in_progress",
        subtasks: ["Implement authentication service", "Add session validation"],
      },
      {
        title: "Integrate biometric authentication",
        description: "Support device biometric authentication for returning users.",
        priority: "critical",
        due: 5,
        status: "todo",
        subtasks: ["Configure biometric API", "Implement fallback authentication"],
      },
      {
        title: "Build account overview",
        description: "Display account balances, account information and recent transactions.",
        priority: "high",
        due: 7,
        status: "in_review",
        subtasks: ["Create balance component", "Display recent transactions"],
      },
      {
        title: "Implement fund transfers",
        description: "Develop internal and external fund transfer workflows.",
        priority: "critical",
        due: -1,
        status: "in_progress",
        subtasks: ["Create transfer validation", "Implement transfer confirmation"],
      },
      {
        title: "Develop transaction history",
        description: "Provide searchable and filterable transaction records.",
        priority: "medium",
        due: 10,
        status: "todo",
        subtasks: ["Create transaction list", "Add date filters"],
      },
      {
        title: "Add card management",
        description: "Allow users to view, freeze and manage their payment cards.",
        priority: "high",
        due: 12,
        status: "todo",
        subtasks: ["Build card overview", "Implement card freeze workflow"],
      },
      {
        title: "Implement transaction notifications",
        description: "Provide transaction alerts and account activity notifications.",
        priority: "medium",
        due: 14,
        status: "todo",
        subtasks: ["Configure notification events", "Build notification preferences"],
      },
      {
        title: "Perform security testing",
        description: "Validate authentication, transfer authorization and sensitive data handling.",
        priority: "critical",
        due: 16,
        status: "todo",
        subtasks: ["Test authentication security", "Verify transfer authorization"],
      },
    ],
  },
  {
    title: "Hospital Management System",
    description:
      "A hospital operations platform for patient records, appointments, medical staff workflows, billing and administrative reporting.",
    priority: "high",
    start: -55,
    deadline: -5,
    tasks: [
      {
        title: "Design patient database structure",
        description:
          "Define patient information, medical record relationships and data validation.",
        priority: "critical",
        due: -15,
        status: "done",
        subtasks: ["Define patient fields", "Design medical record relationships"],
      },
      {
        title: "Build patient registration",
        description: "Implement patient registration and profile management.",
        priority: "high",
        due: -8,
        status: "done",
        subtasks: ["Create registration form", "Implement profile validation"],
      },
      {
        title: "Implement medical records",
        description: "Develop medical history, diagnosis and clinical record management.",
        priority: "critical",
        due: -3,
        status: "in_progress",
        subtasks: ["Create medical record schema", "Implement record history"],
      },
      {
        title: "Develop appointment scheduling",
        description: "Allow administrators to schedule and manage patient appointments.",
        priority: "high",
        due: -2,
        status: "in_review",
        subtasks: ["Build appointment calendar", "Add scheduling validation"],
      },
      {
        title: "Create doctor management",
        description: "Manage doctor profiles, departments and availability.",
        priority: "medium",
        due: 4,
        status: "todo",
        subtasks: ["Create doctor profiles", "Manage department assignments"],
      },
      {
        title: "Implement billing module",
        description: "Generate patient invoices and maintain payment records.",
        priority: "high",
        due: -6,
        status: "todo",
        subtasks: ["Create invoice generation", "Add payment record management"],
      },
      {
        title: "Build pharmacy inventory",
        description: "Track medicine inventory, stock levels and expiry dates.",
        priority: "medium",
        due: 8,
        status: "todo",
        subtasks: ["Create inventory records", "Add expiry date tracking"],
      },
      {
        title: "Develop administrative reports",
        description:
          "Provide operational reports for appointments, billing and patient statistics.",
        priority: "low",
        due: 12,
        status: "todo",
        subtasks: ["Create appointment report", "Create billing summary"],
      },
    ],
  },
  {
    title: "Learning Management System",
    description:
      "An online learning platform for course creation, lesson delivery, student enrolment, assessments and learning progress.",
    priority: "medium",
    start: -12,
    deadline: 45,
    tasks: [
      {
        title: "Design course management architecture",
        description: "Define course, module, lesson and enrolment relationships.",
        priority: "high",
        due: 5,
        status: "done",
        subtasks: ["Define course structure", "Document enrolment relationships"],
      },
      {
        title: "Build course creation interface",
        description: "Create an interface for instructors to create and edit courses.",
        priority: "high",
        due: 9,
        status: "in_progress",
        subtasks: ["Build course form", "Implement course editing"],
      },
      {
        title: "Implement lesson builder",
        description: "Develop lesson creation with support for structured learning content.",
        priority: "critical",
        due: 15,
        status: "todo",
        subtasks: ["Create lesson editor", "Support lesson ordering"],
      },
      {
        title: "Develop student enrolment",
        description: "Implement student enrolment and course access management.",
        priority: "high",
        due: 18,
        status: "todo",
        subtasks: ["Create enrolment endpoint", "Validate course access"],
      },
      {
        title: "Build learning progress tracking",
        description: "Track lesson completion and overall course progress.",
        priority: "medium",
        due: 20,
        status: "in_progress",
        subtasks: ["Track lesson completion", "Calculate course progress"],
      },
      {
        title: "Implement assessment module",
        description: "Create quizzes, questions and automated assessment results.",
        priority: "high",
        due: 25,
        status: "todo",
        subtasks: ["Create question management", "Implement assessment scoring"],
      },
      {
        title: "Create instructor dashboard",
        description: "Display course statistics, student activity and learning performance.",
        priority: "medium",
        due: 30,
        status: "todo",
        subtasks: ["Display course statistics", "Show student activity"],
      },
      {
        title: "Add course completion certificates",
        description: "Generate completion certificates after students meet course requirements.",
        priority: "low",
        due: 35,
        status: "todo",
        subtasks: ["Define certificate template", "Implement certificate generation"],
      },
    ],
  },
];

const commentDefinitions = [
  [
    "E-Commerce Platform",
    "Implement authentication endpoints",
    "The authentication flow is in progress. We should keep refresh token rotation and session invalidation consistent.",
  ],
  [
    "E-Commerce Platform",
    "Build product catalogue API",
    "Please make sure filtering and pagination can work together without affecting query performance.",
  ],
  [
    "E-Commerce Platform",
    "Implement checkout workflow",
    "The checkout review should include shipping details, totals and payment validation.",
  ],
  [
    "E-Commerce Platform",
    "Develop shopping cart",
    "We should preserve cart state when the user refreshes the page.",
  ],
  [
    "E-Commerce Platform",
    "Integrate payment gateway",
    "Please include proper handling for unsuccessful and interrupted payment callbacks.",
  ],
  [
    "Mobile Banking Application",
    "Implement secure login",
    "Security validation should be completed before connecting the remaining account features.",
  ],
  [
    "Mobile Banking Application",
    "Implement fund transfers",
    "Please include transfer confirmation and clear transaction failure messages.",
  ],
  [
    "Mobile Banking Application",
    "Integrate biometric authentication",
    "The fallback authentication flow should remain available when biometrics are unavailable.",
  ],
  [
    "Mobile Banking Application",
    "Perform security testing",
    "Let's verify authorization at the service layer, not only in the interface.",
  ],
  [
    "Hospital Management System",
    "Implement medical records",
    "Medical record updates should preserve the history of previous versions.",
  ],
  [
    "Hospital Management System",
    "Develop appointment scheduling",
    "Please account for doctor availability and conflicting appointment times.",
  ],
  [
    "Hospital Management System",
    "Implement billing module",
    "Invoice totals and payment records should remain consistent.",
  ],
  [
    "Learning Management System",
    "Build course creation interface",
    "Keep the course editor easy to navigate for instructors.",
  ],
  [
    "Learning Management System",
    "Implement lesson builder",
    "Lesson ordering should remain stable when modules are edited.",
  ],
  [
    "Learning Management System",
    "Build learning progress tracking",
    "Progress should be calculated from completed lessons rather than page visits.",
  ],
];

const notificationDefinitions = [
  {
    project: "E-Commerce Platform",
    task: "Build product catalogue API",
    kind: "deadline_approaching",
    title: "Product catalogue deadline approaching",
    body: "The product catalogue API is approaching its deadline. Review its progress.",
  },
  {
    project: "E-Commerce Platform",
    task: "Implement checkout workflow",
    kind: "task_overdue",
    title: "Checkout workflow is overdue",
    body: "The checkout workflow has passed its planned deadline and requires attention.",
  },
  {
    project: "Mobile Banking Application",
    task: "Implement fund transfers",
    kind: "deadline_approaching",
    title: "Fund transfer milestone approaching",
    body: "The fund transfer implementation is approaching its planned deadline.",
  },
  {
    project: "Mobile Banking Application",
    task: "Integrate biometric authentication",
    kind: "task_assigned",
    title: "Biometric authentication awaiting assignment",
    body: "This task is currently unassigned and requires a developer.",
  },
  {
    project: "Hospital Management System",
    task: "Implement medical records",
    kind: "task_overdue",
    title: "Medical records require attention",
    body: "The medical records implementation is behind its planned deadline.",
  },
  {
    project: "Hospital Management System",
    task: "Implement billing module",
    kind: "deadline_approaching",
    title: "Billing module deadline approaching",
    body: "Review the remaining work on the hospital billing module.",
  },
  {
    project: "Learning Management System",
    task: "Implement lesson builder",
    kind: "deadline_approaching",
    title: "Lesson builder milestone approaching",
    body: "The lesson builder milestone is approaching.",
  },
  {
    project: "Learning Management System",
    task: "Build learning progress tracking",
    kind: "task_assigned",
    title: "Learning progress task awaiting assignment",
    body: "This task is currently unassigned and ready for assignment.",
  },
];

async function seed() {
  console.log("\n[Seed] Starting Northpeak demo data seeding...\n");

  await connectDB();

  // 1. Create or reuse the manager.
  const passwordHash = await bcrypt.hash(MANAGER.password, 10);

  let manager = await User.findOne({ email: MANAGER.email });

  if (manager) {
    if (manager.role !== "manager") {
      throw new Error(
        `${MANAGER.email} already exists but is not a manager. ` +
          "Refusing to change an existing user's role.",
      );
    }

    manager.passwordHash = passwordHash;
    await manager.save();

    console.log("[Seed] Existing manager reused; demo password refreshed.");
  } else {
    manager = await User.create({
      name: MANAGER.name,
      email: MANAGER.email,
      passwordHash,
      role: "manager",
    });

    console.log("[Seed] Manager created.");
  }

  stats.users = 1;

  // 2. Create or reuse projects.
  const projects = new Map<string, any>();

  for (const definition of projectDefinitions) {
    const project = await upsert(
      Project,
      {
        manager: manager._id,
        title: definition.title,
      },
      {
        title: definition.title,
        description: definition.description,
        manager: manager._id,
        team: [],
        startDate: dateOffset(definition.start),
        deadline: dateOffset(definition.deadline),
        priority: definition.priority,
      },
    );

    if (!project) {
      throw new Error(`Could not create or retrieve project: ${definition.title}`);
    }

    projects.set(definition.title, project);
    stats.projects++;
  }

  console.log(`[Seed] Projects ready: ${stats.projects}`);

  // 3. Create or synchronize tasks.
  // Unlike the generic upsert helper, this deliberately uses $set
  // so existing demo tasks are also reset to the defined demo state.
  const tasks = new Map<string, any>();

  for (const projectDefinition of projectDefinitions) {
    const project = projects.get(projectDefinition.title);

    for (const definition of projectDefinition.tasks) {
      const completed = definition.status === "done";

      const task = await Task.findOneAndUpdate(
        {
          project: project._id,
          title: definition.title,
        },
        {
          $set: {
            description: definition.description,
            assignedDeveloper: null,
            deadline: dateOffset(definition.due),
            priority: definition.priority,
            status: definition.status,
            isCompleted: completed,
            completedAt: completed ? dateOffset(-2) : null,
          },
          $setOnInsert: {
            project: project._id,
            title: definition.title,
          },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      );

      if (!task) {
        throw new Error(`Could not create or retrieve task: ${definition.title}`);
      }

      tasks.set(`${projectDefinition.title}::${definition.title}`, task);
      stats.tasks++;
    }
  }

  console.log(`[Seed] Tasks ready: ${stats.tasks}`);

  // 4. Create or reuse subtasks.
  for (const projectDefinition of projectDefinitions) {
    for (const definition of projectDefinition.tasks) {
      const task = tasks.get(`${projectDefinition.title}::${definition.title}`);

      for (const [index, title] of definition.subtasks.entries()) {
        const completed =
          definition.status === "done" || (definition.status === "in_progress" && index === 0);

        await upsert(
          Subtask,
          {
            task: task._id,
            title,
          },
          {
            task: task._id,
            title,
            isCompleted: completed,
            completedAt: completed ? dateOffset(-1) : null,
          },
        );

        stats.subtasks++;
      }
    }
  }

  console.log(`[Seed] Subtasks ready: ${stats.subtasks}`);

  // 5. Create or reuse comments.
  for (const [projectTitle, taskTitle, body] of commentDefinitions) {
    const task = tasks.get(`${projectTitle}::${taskTitle}`);

    if (!task) {
      throw new Error(`Comment references unknown task: ${taskTitle}`);
    }

    await upsert(
      Comment,
      {
        task: task._id,
        author: manager._id,
        body,
      },
      {
        task: task._id,
        author: manager._id,
        body,
      },
    );

    stats.comments++;
  }

  console.log(`[Seed] Comments ready: ${stats.comments}`);

  // 6. Create or reuse activity history.
  for (const projectDefinition of projectDefinitions) {
    const project = projects.get(projectDefinition.title);

    for (const definition of projectDefinition.tasks) {
      const task = tasks.get(`${projectDefinition.title}::${definition.title}`);
      const message = `created task "${definition.title}"`;

      await upsert(
        Activity,
        {
          project: project._id,
          task: task._id,
          actor: manager._id,
          message,
        },
        {
          project: project._id,
          task: task._id,
          actor: manager._id,
          message,
        },
      );

      stats.activities++;
    }
  }

  console.log(`[Seed] Activities ready: ${stats.activities}`);

  // 7. Create or reuse manager notifications.
  for (const definition of notificationDefinitions) {
    const project = projects.get(definition.project);
    const task = tasks.get(`${definition.project}::${definition.task}`);

    if (!project || !task) {
      throw new Error(`Invalid notification relationship: ${definition.title}`);
    }

    await upsert(
      Notification,
      {
        audience: "manager",
        kind: definition.kind,
        title: definition.title,
        task: task._id,
        project: project._id,
      },
      {
        recipient: null,
        audience: "manager",
        kind: definition.kind,
        title: definition.title,
        body: definition.body,
        task: task._id,
        project: project._id,
        isRead: false,
      },
    );

    stats.notifications++;
  }

  console.log(`[Seed] Notifications ready: ${stats.notifications}`);

  // 8. Final verification.
  const projectIds = [...projects.values()].map((project) => project._id);

  const [
    projectCount,
    taskCount,
    unassignedCount,
    subtaskCount,
    commentCount,
    activityCount,
    notificationCount,
  ] = await Promise.all([
    Project.countDocuments({ manager: manager._id }),
    Task.countDocuments({ project: { $in: projectIds } }),
    Task.countDocuments({
      project: { $in: projectIds },
      assignedDeveloper: null,
    }),
    Subtask.countDocuments({
      task: { $in: [...tasks.values()].map((task) => task._id) },
    }),
    Comment.countDocuments({
      task: { $in: [...tasks.values()].map((task) => task._id) },
      author: manager._id,
    }),
    Activity.countDocuments({
      project: { $in: projectIds },
      actor: manager._id,
    }),
    Notification.countDocuments({
      audience: "manager",
      project: { $in: projectIds },
    }),
  ]);

  const verification = {
    projects: projectCount,
    tasks: taskCount,
    unassigned: unassignedCount,
    subtasks: subtaskCount,
    comments: commentCount,
    activities: activityCount,
    notifications: notificationCount,
  };

  console.log("\n[Seed] Database verification:");
  console.table(verification);

  if (
    projectCount < 4 ||
    taskCount !== 35 ||
    unassignedCount !== 35 ||
    subtaskCount < 70 ||
    commentCount < 15 ||
    activityCount < 35 ||
    notificationCount < 8
  ) {
    throw new Error(`Verification failed: ${JSON.stringify(verification)}`);
  }

  console.log("\n========================================");
  console.log(" NORTHPEAK SEED COMPLETED SUCCESSFULLY");
  console.log("========================================");
  console.log(`Manager:       ${MANAGER.email}`);
  console.log(`Password:      ${MANAGER.password}`);
  console.log(`Projects:      ${projectCount}`);
  console.log(`Tasks:         ${taskCount}`);
  console.log(`Unassigned:    ${unassignedCount}`);
  console.log(`Subtasks:      ${subtaskCount}`);
  console.log(`Comments:      ${commentCount}`);
  console.log(`Activities:    ${activityCount}`);
  console.log(`Notifications: ${notificationCount}`);
  console.log("========================================\n");
}

seed()
  .catch((error) => {
    console.error("\n[Seed] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

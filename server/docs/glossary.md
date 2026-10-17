# Backend Glossary

## Model

A Mongoose model is the object used to read and write one MongoDB collection. For example, `Task` represents documents in the tasks collection.

## Schema

A schema describes the fields a document may contain, their types, defaults, required status, enums, timestamps, and indexes. Schemas are defined in [`server/src/models/`](../src/models).

## Document

A document is one stored MongoDB record, represented in application code as a Mongoose object. A Task document has fields such as `title`, `project`, and `status`.

## ObjectId

An ObjectId is MongoDB's identifier type. It is stored as a compact identifier and is used in this backend to connect documents.

## Reference

A reference is an ObjectId field that points to another document. For example, `Task.project` references a Project. The reference is logical; MongoDB does not automatically delete or validate the target.

## `ref`

`ref: "User"` tells Mongoose which model a reference belongs to. It enables explicit population, such as `.populate("assignedDeveloper")`.

## Populate

Population replaces a referenced ObjectId with selected fields from the referenced document for a read. It is similar to a join, but it is performed by Mongoose after the query.

## Serializer

A serializer converts an internal Mongoose document into the public API response shape. Northpeak serializers commonly convert camelCase fields such as `assignedDeveloper` into snake_case fields such as `assigned_developer_id`.

## Middleware

Middleware is code that runs during request processing before or after a route handler. Authentication, security headers, request logging, body parsing, and rate limiting are middleware.

## Service

A service contains domain behavior. It loads models, validates business rules, checks authorization, writes data, records side effects, and returns serialized results.

## Controller / route handler

In this backend, route handlers are the controller-like layer. They receive the HTTP request, call middleware and a service, and send the HTTP response. The project uses route files rather than a separate controller directory.

## DTO / API response

A DTO, or Data Transfer Object, is a defined shape used across a boundary. In this project, serializer interfaces such as `SerializedTask` describe API response DTOs.

## Validation

Validation checks whether input has an acceptable shape or value. Mongoose performs schema validation; services perform business validation such as checking project ownership or team membership.

## Authentication

Authentication answers “Who is making this request?” Northpeak uses a JWT in a Bearer authorization header and then verifies that the user still exists in MongoDB.

## Authorization

Authorization answers “Is this authenticated user allowed to do this?” A route may require the manager role, while a service may additionally require that the manager owns the project or that the developer is assigned to the task.

## Role

A role is a broad permission category. Northpeak has `manager` and `developer` roles.

## ABAC

Attribute-based access control makes decisions using resource and user attributes. For example, a developer may edit a task only when their user ID equals the task's assigned developer ID.

## Transaction

A transaction groups database operations so they can commit together or roll back together. Project team removal uses a Mongoose session and transaction when MongoDB supports it.

## Compensating rollback

A compensating rollback is application code that tries to undo an earlier write when a transaction is unavailable. The project service has a standalone MongoDB fallback for team removal.

## Cascade delete

A cascade delete removes related records when a parent is deleted. Northpeak performs cascades in services; the Mongoose schemas do not define database-level cascade hooks.

## Race condition

A race condition occurs when the result depends on the timing of concurrent operations. Example: a task is assigned while another request removes that developer from the project team.

## Concurrency

Concurrency means multiple operations are in progress at the same time. The backend uses membership re-checks, transactions for team removal, and test barriers to verify race behavior.

## Optimistic concurrency

Optimistic concurrency assumes conflicts are uncommon and detects them when saving a document. The Project schema enables Mongoose `optimisticConcurrency`; the Task schema currently does not.

## Index

An index is a MongoDB data structure that helps queries find records faster. Indexes can also support uniqueness, as with the User email field.

## Population versus enforcement

Population helps read related data. It does not enforce that the relationship is valid. Enforcement of project ownership, developer role, and team membership happens in services.

## `AppError`

`AppError` is the project's custom operational error class. A service can throw `new AppError("...", 403)`, and the centralized error handler sends that status and message.

## `asyncHandler`

`asyncHandler` wraps an async Express route and forwards rejected promises to the centralized error handler.

## Request ID

A request ID uniquely identifies one HTTP request in logs and the `X-Request-Id` response header. It helps connect an error response to server logs.

## Rate limiter

A rate limiter counts requests in a time window and rejects excessive requests. Northpeak applies an in-memory limiter to login and registration.

## Health check

A health check endpoint reports whether the process is alive or whether its MongoDB connection is ready. Northpeak exposes `/api/health`, `/api/health/live`, and `/api/health/ready`.

## Activity event

An Activity document is an audit-style record with a human-readable message and optional project, task, and actor references.

## Notification audience

A notification can target one `recipient` user or a role-wide `audience`. The notification service filters records so users receive applicable notifications.

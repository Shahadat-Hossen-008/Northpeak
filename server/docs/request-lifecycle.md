# Request Lifecycle

## Application pipeline

The Express application is assembled in [`app.ts`](../src/app.ts). The server is started separately by [`server.ts`](../src/server.ts).

```mermaid
flowchart TD
    Request([HTTP request]) --> Headers[Security headers]
    Headers --> Cors[CORS]
    Cors --> Body[express.json 100kb limit]
    Body --> RequestId[Request ID logger]
    RequestId --> RateLimit{Auth login/register?}
    RateLimit -->|Yes| Limit[Auth rate limiter]
    RateLimit -->|No| Router[Route matching]
    Limit --> Router
    Router --> Auth{Route requires authentication?}
    Auth -->|No| Handler[Route handler]
    Auth -->|Yes| Authenticate[authenticate]
    Authenticate --> Role{Route has requireRole?}
    Role -->|No| Handler
    Role -->|Yes| RequireRole[requireRole]
    RequireRole --> Handler
    Handler --> Async[asyncHandler]
    Async --> Service[Domain service]
    Service --> Database[(MongoDB via Mongoose)]
    Database --> Serializer[Serializer]
    Serializer --> Response([JSON response])
    Async --> Error[errorHandler]
    Error --> ErrorResponse([JSON error response])
```

## Middleware order

The actual order in [`app.ts`](../src/app.ts) is:

1. `securityHeaders`
2. CORS
3. `express.json({ limit: "100kb" })`
4. `requestLogger`
5. auth rate limiter for login and registration
6. domain routers
7. test-only barrier router when `NODE_ENV === "test"`
8. public health endpoints
9. `errorHandler`

The error handler must remain last so it can receive errors passed by `asyncHandler` and body parsing.

## Authentication

```mermaid
sequenceDiagram
    actor Client
    participant Route as Protected route
    participant Auth as authenticate
    participant JWT as jsonwebtoken
    participant DB as User model
    participant Service as Domain service

    Client->>Route: Request with Bearer token
    Route->>Auth: authenticate(req, res, next)
    Auth->>JWT: verify(token, JWT_SECRET)
    JWT-->>Auth: decoded user ID
    Auth->>DB: User.findById(decoded.id)
    alt User missing
        Auth-->>Client: 401 account no longer exists
    else User exists
        Auth->>Auth: rebuild req.user from current DB role/name
        Auth->>Route: next()
        Route->>Service: business operation
        Service-->>Client: serialized response
    end
```

Missing, malformed, expired, or invalid tokens return 401. `requireRole` performs a coarse role check after authentication. Resource ownership and assignment checks happen in services because they require loading the target resource.

## Validation and errors

Validation is split across layers:

- Express JSON parsing rejects bodies over 100 KB.
- Route code extracts request values and passes them to services.
- Services validate business requirements and ObjectId formats.
- Mongoose validates schema-level required fields and enum values.
- `errorHandler` maps known errors to `{ message }`.

Known error mappings in [`middleware/error.ts`](../src/middleware/error.ts):

| Error | HTTP status |
|---|---:|
| Mongoose `CastError` | 400 |
| Mongoose `ValidationError` | 400 |
| Mongo duplicate key | 400 |
| `AppError` with status | That status |
| Oversized body | 413 |
| Unknown error | 500 |

## Example Task request

```text
POST /api/tasks
  → securityHeaders
  → cors
  → express.json
  → requestLogger
  → tasksRouter.post("/")
  → authenticate
  → requireRole("manager")
  → asyncHandler
  → taskService.createTask
  → Project/Task/User database operations
  → Activity and Notification writes
  → serializeTask
  → 201 JSON
```

## Transactions

Most routes do not start a database transaction. Project team removal is the important exception:

```mermaid
flowchart TD
    Update[ProjectService.updateProject] --> Validate[Validate new team]
    Validate --> Removed[Calculate removed developer IDs]
    Removed --> Session[Start Mongoose session]
    Session --> Begin[startTransaction]
    Begin --> SaveProject[Save project in session]
    SaveProject --> Unassign[Task.updateMany in session]
    Unassign --> Commit[commitTransaction]
    Commit --> Sweep[Post-commit Task.updateMany sweep]
    Sweep --> Activity[Create project Activity]
    Activity --> Response[Return serialized project]
    Unassign -->|Failure| Abort[abortTransaction]
    Abort --> Fallback{Standalone MongoDB error?}
    Fallback -->|Yes| Compensate[Save project and compensate task update]
    Fallback -->|No| Error[Pass error to errorHandler]
    Compensate --> Response
```

If the post-commit sweep fails, the current implementation logs the failure and still returns the project update. This is verified current behavior and is also an audit concern.

## Startup and shutdown

```text
index.ts
  → startServer()
  → connectDB()
  → app.listen(PORT)
  → setupGracefulShutdown(server)
```

Shutdown handles SIGINT, SIGTERM, unhandled rejections, and uncaught exceptions. It closes the HTTP server and then the Mongoose connection, with a ten-second force-exit timer.

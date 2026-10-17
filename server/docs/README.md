# Northpeak Backend Documentation

This folder explains the current backend implementation in beginner-friendly terms. The documentation describes the code that exists today; it does not define a new architecture or change API behavior.

## Recommended reading order

1. **[glossary.md](./glossary.md)** — Learn the backend vocabulary used throughout the other documents.
2. **[data-model.md](./data-model.md)** — Read every Mongoose model, field, validation rule, and index.
3. **[data-relationships.md](./data-relationships.md)** — See how the models reference one another.
4. **[backend-file-map.md](./backend-file-map.md)** — Understand where routes, services, models, serializers, and middleware live.
5. **[request-lifecycle.md](./request-lifecycle.md)** — Follow a request through Express and the database.
6. **[task-lifecycle.md](./task-lifecycle.md)** — Trace the main Task feature end to end.
7. **[backend-understandability-audit.md](./backend-understandability-audit.md)** — Review the broader audit findings and future normalization plan.

## Source of truth

The source files under [`server/src/`](../src/) are authoritative. Where a document describes behavior that is enforced only in application code, that distinction is called out explicitly.

Validation performed for the current source:

```bash
npm --prefix server run build
npm --prefix server test
```

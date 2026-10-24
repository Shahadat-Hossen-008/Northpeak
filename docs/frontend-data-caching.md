# Frontend data caching

Last updated: 2026-10-24

## In one minute

- **What:** the app keeps API responses in memory (the TanStack Query cache) and reuses them when you return to a page, instead of asking the server again.
- **Why:** before this change, revisiting a page after 10 seconds fetched the same data again, and a 1.4 second loader hid the data we already had. The app felt slow and sent needless requests to the server and the database.
- **How:** one freshness time per kind of data, an exact refresh after every change, and a full cache wipe whenever the user changes or the session expires.
- **Not done on purpose:** saving data in localStorage or sessionStorage, polling, and new dependencies. See "Left out on purpose".

No server code changed for this work.

## The problem before

| Symptom | Cause |
|---|---|
| Every revisit after 10 seconds fetched again | The global `staleTime` was 10 seconds. |
| `/auth/me` was called on almost every navigation | The authenticated route checks the current user, and that query was also stale after 10 seconds. |
| Notifications were fetched on most navigations | Each page renders its own `AppShell`, so the notifications query remounts, and it was stale after 10 seconds. |
| Cached pages still looked like a reload | `useMinimumLoading` showed a 1.4 second loader on every mount, even when the data was cached. |
| One edit refetched many lists, and an expired session kept showing old data | Invalidation was coarse in some places, and nothing handled a 401 response. |

## How the cache works (short version)

- **Fresh:** the data is younger than its `staleTime`. It is reused and no request is sent.
- **Stale:** older than `staleTime`. It is still shown immediately, and a request refreshes it in the background when a component that uses it mounts or the window regains focus.
- **gcTime:** how long data nobody is using stays in memory before it is deleted (10 minutes here).

Example with the 1 minute tier:

| Time | What you do | What happens |
|---|---|---|
| 0:00 | Open Tasks | The page queries populate their cache entries. |
| 0:20 | Go to Dashboard and back to Tasks | No request, the data is fresh. |
| 1:30 | Open Tasks again | The old list shows instantly, and one background request updates it. |

## Freshness tiers

The tiers live in one file, `src/hooks/queries/stale-times.ts`. Every query hook picks one.

| Tier | Time | Data | Why |
|---|---|---|---|
| static | 10 minutes | members, current user | Changes rarely. The current user is also refreshed right after login or a profile change, and a 401 response ends an expired session. |
| normal | 1 minute | projects, tasks, subtasks, member workload | Changes only when someone edits. Edits refresh the right queries (see below). |
| live | 30 seconds | comments, comment counts, notifications, activity | Other people can change it at any time. |

To change how fresh a kind of data is, change the number in that one file.

## Global defaults

Set where the query client is created (`src/router.tsx`):

| Option | Value | Note |
|---|---|---|
| `staleTime` | 1 minute (normal tier) | Default for any query that does not pick a tier. |
| `gcTime` | 10 minutes | Unused data is dropped after this. |
| `retry` | 1 | Failed requests are retried once. |
| `refetchOnWindowFocus` | default (on) | Only refetches data that is already stale. |
| `defaultPreloadStaleTime` | 0 | The router must not keep its own cache. TanStack Query does the caching. |

## Keeping data correct after a change

A long cache is only safe if every write refreshes the data it affects. After each mutation we invalidate the affected top-level keys. Invalidating marks those queries stale and refetches only the ones currently on screen, so listing a few extra keys is cheap and listing too few shows old data. When in doubt, add the key.

| Mutation | Keys refreshed |
|---|---|
| Create task | tasks, projects, members, activity, notifications, member-workload |
| Update task | tasks, task, projects, members, activity, notifications, member-workload |
| Update task status | tasks, task, activity, member-workload (the screen updates optimistically first) |
| Set task completion | tasks, task, activity, member-workload |
| Delete task | tasks, task, projects, members, activity, notifications, comments, comment-counts, subtasks, member-workload |
| Create project | projects, members, activity, notifications |
| Update project | projects, members, tasks, activity, member-workload |
| Delete project | projects, tasks, activity, members, member-workload, subtasks, comments, comment-counts |
| Add, rename, assign or remove a subtask | subtasks, member-workload (add also activity) |
| Toggle a subtask | subtasks, notifications, member-workload |
| Add comment | comments, comment-counts, activity, notifications |
| Delete comment | comments, comment-counts |
| Update comment | comments |
| Mark notifications read | notifications |

Task data has no subtask counts. Task cards and details read them from the subtask queries, so subtask mutations refresh `subtasks`, not `tasks`.

## Session safety

Cache keys do not contain the user. So the whole cache is cleared whenever the identity may change:

| Trigger | What happens |
|---|---|
| Logout | Token removed, cache cleared, redirect to login. |
| A new token is stored (login, Google sign-in, email verification) | Cache cleared before the new user is loaded, so one user never sees another's cached data. |
| A 401 response on a request that carried a token | Treated as an expired or invalid session and runs the same logout. It runs once, even if several requests fail together. |

The 401 rule ignores these endpoints, because a 401 there means a wrong password or code, not an expired session: `/auth/login`, `/auth/register`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/google`.

The handler is registered from `src/hooks/auth-provider.tsx`, so `src/backend/client.ts` does not import the query client.

## Loader on revisits

`useMinimumLoading` keeps the loader up for at least 1.4 seconds so a fast response does not flash. It now does that only on a first visit. If every query for the page already has cached data when the page opens, the page shows immediately, and stale data refreshes in the background.

## Left out on purpose

| Not done | Why | When to reconsider |
|---|---|---|
| Saving the cache in localStorage or sessionStorage | Data would survive logout and shared computers and could be old. A refetch after a full page reload is normal. | Only if instant load after reload becomes a requirement. Then use sessionStorage, clear it on logout, and store only non-sensitive lists. |
| Polling or websockets | The live tier plus refetch on focus is enough for this app. | If people must see changes within seconds. |
| Moving `AppShell` into the authenticated layout route | Each page renders its own shell, so it remounts on navigation. This is harmless now because notifications refetch only when stale. | If shell flicker or sidebar state loss becomes a problem. |
| Skipping retries for 4xx errors | The global retry is 1 for all errors; the current-user query overrides it with `retry: false`. A status-aware rule needs the HTTP status on the error object. | If error screens feel slow. |
| Cache keys per user | We clear the whole cache when identity changes instead. | If two users must share one browser session. |

## How to add a query or mutation

**New query**
1. Pick a tier: how fast does this data change, and how bad is it if it is 30 seconds, 1 minute or 10 minutes old?
2. Use a stable key made of serializable values. Plain objects are hashed by contents; avoid functions and unstable values such as `Date.now()`.
3. Set `staleTime: STALE.<tier>` and add a one-line comment saying why that tier.

**New mutation**
1. List every cached query that shows data this write can change.
2. Invalidate their top-level keys with `useInvalidate` (`src/hooks/queries/utils.ts`).
3. When in doubt, invalidate more.
4. Add a row to the mutation table in this document.

## How to check it works

Open Chrome DevTools, the Network tab, filter Fetch/XHR.

1. Log in. Go Dashboard, Tasks, Dashboard within 60 seconds. Projects, tasks and members are not fetched again, and `/auth/me` is not called again.
2. Edit a task. The related lists refetch once and show the new data.
3. Add or toggle a subtask, then open the member workload. The counts are current.
4. Log out and log in as another user. Nothing from the first user shows.
5. Keep a token the backend rejects and open a page that makes an authenticated request. You land on login with an empty cache.
6. A first visit shows the loader. Going back to the page shows it immediately.

## Troubleshooting

| Problem | Likely cause |
|---|---|
| I changed data and the screen still shows the old version | The mutation does not invalidate a key that screen uses. Add the key and update the table above. |
| A page fetches again on every visit | Its query has no tier, or its key changes on every render. |
| I see data from another account | The cache was not cleared. Check the three triggers in "Session safety". |
| The loader shows on a revisit | Not every query for that page has cached data yet, or the page does not pass its query keys to `useMinimumLoading`. |

## Where it lives

| File | Role |
|---|---|
| `src/hooks/queries/stale-times.ts` | The three tiers. |
| `src/router.tsx` | Query client defaults. |
| `src/hooks/queries/*.ts` | One hook per data type, each with its tier and its mutations. |
| `src/hooks/queries/utils.ts` | `useInvalidate`. |
| `src/backend/client.ts` | Request helper and the 401 detection. |
| `src/hooks/auth-provider.tsx` | Logout, the 401 handler, and cache clearing on a new token. |
| `src/hooks/use-minimum-loading.ts` | The first-visit-only loader rule. |

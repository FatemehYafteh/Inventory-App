# mocks

MSW handlers for pages built before their real API exists. They must follow the exact response shapes in `docs/prds/PRD.md` section 6 (`{ data, page, limit, total }` for lists, `{ message, code?, errors? }` for errors). Remove each handler in the task that connects the page to the real API.

Shared test handlers live in `src/test/server.js`.

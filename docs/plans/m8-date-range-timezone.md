# M8.1 decision: what a date range means (timezone)

Status: **needs the owner's decision before M8.1 starts.** A default is proposed so M8.1 is never blocked; it applies if no other answer is given.
Inputs: `docs/plans/phase-l-multilingual.md` (3.8, U6), sub-PRD 08 (3.1 Filters, `GET /movements`, 3.3 CSV export), `server/src/services/stock.service.js` (`listMovements`), `shared/schemas/stock.js`, `client/src/lib/format.js`.

## 1. The question

Movements can be filtered by a date range (`GET /movements?...&from=&to=`), and the Movements page, the CSV export of the filtered result and the Users drawer link ("that user's movements") must all mean the same thing by "14 October". Three things make this a real decision, not a detail:

1. A movement's `createdAt` is a UTC instant. A **day** only exists once a timezone is chosen.
2. Persian users pick **Jalali** days (22 Mehr 1405 is 14 October 2026). The picker works with ordinary `Date` values (see the plan, U1), so the Jalali day still has to become an exact start and end instant.
3. The server, the browser and the team may not share a zone. This development machine runs in `Asia/Tehran` (UTC+03:30, no daylight saving since 2022).

## 2. Evidence (inspected 2026-10-21)

| What | Finding |
|---|---|
| API today | `listMovementsQuerySchema` accepts only `page` and `limit`. No `from`/`to` exists yet, so nothing has to be preserved. |
| Spec | sub-PRD 08 names `from` and `to` but says nothing about inclusive or exclusive ends, or timezone. |
| Stored data | `createdAt` is a UTC instant (Mongo `Date`). The seed and tests can use fixed instants. |
| Display | The client formats times with `Intl` in the **browser's** zone for both languages (`formatDate`, `formatDateTime`). |
| Server config | No timezone setting exists in the server, client, docs or env example. |
| Machine | The development machine's zone is `Asia/Tehran`. |

## 3. Why it matters: one movement, three answers

Using the instant **2026-10-14 20:30:00Z**, the first moment of 15 October in Tehran:

| Instant (UTC) | UTC day | Tehran day | New York day |
|---|---|---|---|
| 2026-10-14 20:29:59 | 14 Oct | 14 Oct | 14 Oct |
| 2026-10-14 20:30:00 | 14 Oct | **15 Oct** | 14 Oct |
| 2026-10-14 23:59:00 | 14 Oct | **15 Oct** | 14 Oct |
| 2026-10-15 00:30:00 | 15 Oct | 15 Oct | **14 Oct** |

A "14 October" filter would include or exclude the 20:30 to 23:59 UTC movements depending on the zone. For Tehran users that is every movement made between 00:00 and 03:30 local time, which the table shows as 15 October. If the table and the filter disagree, a user sees a movement dated 15 October inside a "14 October" result, or missing from "15 October".

## 4. Options

| | A. The browser's zone (client converts) | B. One configured business zone | C. UTC days |
|---|---|---|---|
| How | The client turns the chosen days into UTC instants using the browser's zone and sends full ISO values: `from` = start of the first day (inclusive), `to` = start of the day after the last chosen day (exclusive). The API stays zone-free. | The server reads a zone (for example `APP_TIMEZONE=Asia/Tehran`), the client sends date-only values and the server converts them. The table would also have to display in that zone. | The client sends date-only values and the server treats them as UTC days. |
| Table and filter agree? | Yes, both use the browser's zone. | Only if the table also displays in the business zone (a change to `formatDateTime`). | No for anyone not in UTC (the table shows local time). |
| Everyone in one zone | Same result as B. | Same. | Wrong around midnight, for 3.5 hours a day in Tehran. |
| People in different zones | Each sees days in their own zone; the same filter can differ between two people. | Everyone sees the same days. | Everyone sees the same days, but not matching the displayed time. |
| New config / code | None on the server. | An env variable, validation, and a zone-aware formatter on the client. | None. |
| CSV export | Uses the same instants, so the file matches the page. | Same, in the business zone. | Same, in UTC. |
| Jalali | Works: the picker gives `Date` values, converted in the browser's zone. | Works, but the day boundaries come from the server's zone. | Works, but off by hours. |

## 5. Recommendation

**Option A**, with these exact rules:

- The API takes `from` and `to` as full ISO instants (`2026-10-14T20:30:00.000Z`), `from` **inclusive** and `to` **exclusive**. A date-only value is rejected with a validation error, so no day is ever guessed on the server.
- The client builds them from the chosen days in the browser's zone (the start of the first chosen day, and the start of the day after the last chosen one), using the same zone it uses to display times.
- The Users drawer link and the CSV export pass the same instants in the query string, so the page, the link and the file agree.
- If the team later needs "everyone sees the same days", Option B can be added without changing the API, because the client would just compute the instants in the business zone.

Why: the app already displays times in the browser's zone in both languages, so A is the only option that needs no new setting and keeps the table and the filter consistent. The API stays timezone-free and easy to test with fixed instants.

## 6. What the owner needs to decide

1. **Is Option A acceptable?** The only real cost is that two people in different zones can see different day boundaries for the same filter. If your whole team is in one zone, there is no cost.
2. **Does the team need identical day boundaries for everyone** (for example, a shared daily report in `Asia/Tehran`)? If yes, choose B and name the zone.

If no answer is given, M8.1 follows Option A.

## 7. M8.1 acceptance tests (whichever option is chosen)

Using fixed instants and a fixed zone passed to the test (never the machine's zone):

1. A movement at 23:30 and one at 00:30 local time on the boundary day fall in the right day's result.
2. A one-day range returns only that day; `to` is exclusive.
3. A range across a Jalali month end (for example 30 Shahrivar to 1 Mehr) and across the Gregorian year end.
4. A range crossing a daylight-saving change in a zone that has one (for example `America/New_York`) is 23 or 25 hours long, not 24.
5. The CSV of a filtered range contains exactly the rows the page shows.
6. A date-only value, a missing `from` with a `to`, and `from` later than `to` give validation errors with codes from the shared catalogue.
7. The Users drawer link opens the page already filtered, and shows the same rows.

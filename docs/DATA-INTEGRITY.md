# One configuration per scope - decision record (#87)

**Decided:** 2026-10-08, build 2026100801 (1.4.0). **Status:** in force. Replaces the decision of
build 2026100800, which kept the invariant in the application only (see the end).

## The invariant

The table `local_stackmatheditor` holds the toolbar configuration per scope:

| Scope | `cmid` | `questionbankentryid` |
|---|---|---|
| global question default | 0 | the entry |
| quiz default | the activity | `0` (`config_manager::QUIZ_DEFAULT`) |
| question in a quiz | the quiz | the entry |

There is exactly one row per scope.

## How the database enforces it

* `questionbankentryid` is `NOT NULL` with default `0`. The quiz default is stored as `0`; no
  question bank entry has id 0.
* `(cmid, questionbankentryid)` is the unique index `cmid_qbeid_uix`. Every scope - the quiz
  default included - takes part in it, on every database Moodle supports.

With `NULL` for the quiz default the index could not be unique in a portable way: PostgreSQL and
MariaDB never treat two `NULL`s as equal, so any number of quiz defaults would have passed. That
was the reason the previous decision kept the rule in the application; the sentinel `0` removes it.

## What the application adds

`config_manager::upsert_record()` still takes a Moodle lock per scope and reads and writes in one
delegated transaction. The index makes a second row impossible; the lock makes a concurrent second
writer wait and then update the row the first one inserted, instead of failing on the index.

Restore maps a backup's rows onto the new activity. A backup of an earlier version carries the
quiz default without a question bank entry; it is read as `0`. Two rows the restore would put into
one scope - possible only from a backup of a site that still had duplicates - become one: the
newer configuration is kept.

## Existing data

The upgrade to 2026100801 (after the repair of 2026100800, for sites coming from 1.3.0):

1. drops the non-unique index of earlier versions;
2. sets `NULL` to `0` and makes the column `NOT NULL` with default `0`;
3. reduces every scope with more than one row to the row every read returned - newest
   `timemodified`, then highest id - including an activity that had its default both as `NULL`
   and as `0`;
4. creates the unique index.

Each part checks the state first; running the step again changes nothing.

## Evidence

- `tests/unit/config_scope_integrity_test.php`: the schema (NOT NULL, default 0, unique index);
  the database refuses a second row for a question scope, a global default and a quiz default;
  repeated saves keep one row; a held scope lock makes a second writer fail with `locktimeout`.
- `tests/unit/upgrade_step_test.php`: puts the table back into the shape of 1.3.0 (nullable
  column, non-unique index), inserts the data 1.3.0 leaves behind - duplicates, an orphan, a
  default both as `NULL` and as `0` - and upgrades: the result has the schema and the rows of a
  fresh install; a second run from either earlier build changes nothing.
- `tests/concurrency/concurrent_save.php`: several PHP processes write the same two scopes at the
  same moment. With the plugin's write path no writer fails and each scope has one row. The
  control run writes without lock and transaction; the database refuses every second row - 8 to 9
  refusals per run locally with 8 writers, on PostgreSQL and MariaDB - and each scope still has
  one row. Main CI job *Concurrent writes* (PostgreSQL, MariaDB) and the release workflow run it.
- `tests/upgrade/*`: the upgrade from the build the plugins directory published, on PostgreSQL
  and MariaDB, checks the schema and the rows afterwards.

## The previous decision (build 2026100800)

It kept `questionbankentryid` nullable and enforced one row per scope with lock, transaction and
a repair after each write, because a unique index on the nullable column would not have caught
duplicate quiz defaults. It was accepted as residual risk R5 and replaced on 8 October 2026 at the
maintainer's request by the enforcement in the database described above.

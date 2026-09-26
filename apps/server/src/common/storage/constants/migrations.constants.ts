/**
 * Ordered schema migrations. Index + 1 is the schema version stored in
 * PRAGMA user_version; never edit a shipped entry, append a new one.
 */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE profile (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    data         TEXT NOT NULL,
    resume_path  TEXT,
    resume_name  TEXT,
    resume_text  TEXT,
    updated_at   TEXT NOT NULL
  );

  -- Answer memory: every screening question ever answered, keyed by its
  -- normalised text. This is what makes the 50th application free.
  CREATE TABLE answers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    key         TEXT NOT NULL UNIQUE,
    question    TEXT NOT NULL,
    answer      TEXT NOT NULL,
    field_type  TEXT,
    source      TEXT NOT NULL,
    uses        INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  -- Jobs double as the work queue: status is the queue state, so a crash or
  -- restart never loses work (see JobsService.recoverInterrupted).
  CREATE TABLE jobs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    source        TEXT NOT NULL,
    external_id   TEXT NOT NULL,
    url           TEXT NOT NULL,
    apply_url     TEXT,
    title         TEXT NOT NULL,
    company       TEXT NOT NULL DEFAULT '',
    location      TEXT NOT NULL DEFAULT '',
    is_remote     INTEGER NOT NULL DEFAULT 0,
    easy_apply    INTEGER NOT NULL DEFAULT 0,
    salary_raw    TEXT,
    salary_min    REAL,
    salary_max    REAL,
    description   TEXT NOT NULL DEFAULT '',
    skills        TEXT NOT NULL DEFAULT '[]',
    posted_at     TEXT,
    status        TEXT NOT NULL,
    score         INTEGER,
    score_detail  TEXT,
    reason        TEXT,
    attempts      INTEGER NOT NULL DEFAULT 0,
    origin        TEXT NOT NULL DEFAULT 'search',
    discovered_at TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    applied_at    TEXT,
    UNIQUE (source, external_id)
  );
  CREATE INDEX idx_jobs_status ON jobs (status, score DESC);
  CREATE INDEX idx_jobs_applied_at ON jobs (applied_at);
  CREATE INDEX idx_jobs_company ON jobs (company);

  CREATE TABLE attempts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id       INTEGER NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
    started_at   TEXT NOT NULL,
    finished_at  TEXT,
    outcome      TEXT,
    detail       TEXT,
    steps        INTEGER NOT NULL DEFAULT 0,
    fields       INTEGER NOT NULL DEFAULT 0,
    llm_calls    INTEGER NOT NULL DEFAULT 0,
    memory_hits  INTEGER NOT NULL DEFAULT 0,
    duration_ms  INTEGER,
    screenshot   TEXT,
    trace        TEXT
  );
  CREATE INDEX idx_attempts_job ON attempts (job_id);

  -- Questions the agent could not answer on its own. Answering one stores it
  -- in answer memory and re-queues every job that was waiting on it.
  CREATE TABLE pending_questions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    key         TEXT NOT NULL,
    job_id      INTEGER REFERENCES jobs (id) ON DELETE CASCADE,
    question    TEXT NOT NULL,
    field_type  TEXT NOT NULL,
    options     TEXT NOT NULL DEFAULT '[]',
    suggestion  TEXT,
    status      TEXT NOT NULL DEFAULT 'open',
    created_at  TEXT NOT NULL,
    UNIQUE (key, job_id)
  );
  CREATE INDEX idx_pending_status ON pending_questions (status);

  -- Learned per-site navigation hints (which control opens the form, which
  -- button advances it, what success looks like). Filled by the LLM once,
  -- replayed without it afterwards.
  CREATE TABLE recipes (
    domain      TEXT PRIMARY KEY,
    data        TEXT NOT NULL,
    successes   INTEGER NOT NULL DEFAULT 0,
    failures    INTEGER NOT NULL DEFAULT 0,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE llm_usage (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    at                TEXT NOT NULL,
    provider          TEXT NOT NULL,
    model             TEXT NOT NULL,
    purpose           TEXT NOT NULL,
    prompt_tokens     INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    duration_ms       INTEGER NOT NULL DEFAULT 0,
    ok                INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX idx_llm_usage_at ON llm_usage (at);
  `,
];

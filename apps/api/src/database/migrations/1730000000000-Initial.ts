import type { MigrationInterface, QueryRunner } from 'typeorm';
export class Initial1730000000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE runs (
      id uuid PRIMARY KEY, task text NOT NULL, status varchar NOT NULL, "agentConfig" jsonb NOT NULL,
      pricing jsonb NOT NULL, mock boolean NOT NULL, "maxCostUsd" numeric(14,8) NOT NULL,
      result text, error text, "createdAt" timestamptz NOT NULL, "startedAt" timestamptz, "endedAt" timestamptz,
      "latencyMs" integer, "promptTokens" integer NOT NULL DEFAULT 0, "completionTokens" integer NOT NULL DEFAULT 0,
      "costUsd" numeric(14,8) NOT NULL DEFAULT 0, "eventSequence" integer NOT NULL DEFAULT 0
    )`);
    await q.query(`CREATE TABLE steps (
      id uuid PRIMARY KEY, "runId" uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      "parentStepId" uuid REFERENCES steps(id), agent varchar NOT NULL, model varchar NOT NULL, provider varchar NOT NULL,
      attempt integer NOT NULL, input text NOT NULL, output text NOT NULL, status varchar NOT NULL,
      "startedAt" timestamptz NOT NULL, "endedAt" timestamptz, "latencyMs" integer,
      "promptTokens" integer NOT NULL DEFAULT 0, "completionTokens" integer NOT NULL DEFAULT 0,
      "costUsd" numeric(14,8) NOT NULL DEFAULT 0, error text
    )`);
    await q.query(`CREATE TABLE run_events (
      "runId" uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE, sequence integer NOT NULL,
      type varchar NOT NULL, "stepId" uuid, payload jsonb NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(),
      "publishedAt" timestamptz, PRIMARY KEY ("runId", sequence)
    )`);
    await q.query('CREATE INDEX runs_created_id ON runs ("createdAt" DESC, id DESC)');
    await q.query('CREATE INDEX runs_status_created ON runs (status, "createdAt" DESC, id DESC)');
    await q.query('CREATE INDEX steps_run_parent ON steps ("runId", "parentStepId")');
    await q.query('CREATE INDEX steps_model_run ON steps (model, "runId")');
    await q.query('CREATE INDEX events_pending ON run_events ("createdAt") WHERE "publishedAt" IS NULL');
  }
  async down(q: QueryRunner) { await q.query('DROP TABLE run_events, steps, runs'); }
}

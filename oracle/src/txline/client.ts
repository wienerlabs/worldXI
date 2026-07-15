/**
 * TxLINE data client. ONLY score/event/lineup endpoints are used (odds NEVER).
 *
 * Endpoints (OpenAPI v1.5.2):
 *  - GET /api/fixtures/snapshot?startEpochDay&competitionId
 *  - GET /api/scores/snapshot/{fixtureId}?asOf
 *  - GET /api/scores/historical/{fixtureId}
 *  - GET /api/scores/stream (Server-Sent Events, live)
 *
 * On 401 (JWT expired) the credentials are refreshed automatically.
 */
import type { Keypair } from "@solana/web3.js";
import type { Config } from "../config.js";
import { logger, errorMessage } from "../logger.js";
import { resolveCredentials, type TxlineCredentials } from "./auth.js";
import type { TxFixture, TxScores, TxScoresStreamEvent } from "./types.js";

const MAX_RETRIES = 4;
const RETRY_BASE_MS = 500;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class TxlineClient {
  private creds: TxlineCredentials | null = null;

  constructor(
    private readonly cfg: Config,
    private readonly wallet: Keypair
  ) {}

  async init(): Promise<void> {
    this.creds = await resolveCredentials(this.cfg, this.wallet);
  }

  private authHeaders(): Record<string, string> {
    if (!this.creds) throw new Error("TxlineClient.init() was not called");
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.creds.jwt}`,
    };
    // The API token is only sent if present (guest-only mode support).
    if (this.creds.apiToken) headers["X-Api-Token"] = this.creds.apiToken;
    return headers;
  }

  /** Refreshes credentials on 401, retries transient errors with exponential backoff. */
  private async getJson<T>(path: string): Promise<T> {
    const url = `${this.cfg.TXLINE_BASE_URL}${path}`;
    let lastErr: unknown;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(url, { headers: this.authHeaders() });
        if (res.status === 401) {
          logger.warn("TxLINE 401 - refreshing credentials");
          this.creds = await resolveCredentials(this.cfg, this.wallet);
          continue;
        }
        if (res.status === 429 || res.status >= 500) {
          throw new Error(`transient error ${res.status}`);
        }
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`TxLINE GET ${path} failed: ${res.status} ${text}`);
        }
        // Empty body (no data) -> treat as empty array.
        const body = await res.text();
        if (!body || body.trim().length === 0) return [] as unknown as T;
        return JSON.parse(body) as T;
      } catch (error: unknown) {
        lastErr = error;
        const wait = RETRY_BASE_MS * 2 ** attempt;
        logger.warn("TxLINE request will be retried", {
          path,
          attempt,
          wait,
          error: errorMessage(error),
        });
        await sleep(wait);
      }
    }
    throw new Error(`TxLINE GET ${path} failed after ${MAX_RETRIES} attempts: ${errorMessage(lastErr)}`);
  }

  /** Fixture snapshot (optional competition filter). */
  async getFixtures(startEpochDay?: number, competitionId?: number): Promise<TxFixture[]> {
    const params = new URLSearchParams();
    if (startEpochDay !== undefined) params.set("startEpochDay", String(startEpochDay));
    if (competitionId !== undefined) params.set("competitionId", String(competitionId));
    const q = params.toString();
    return this.getJson<TxFixture[]>(`/api/fixtures/snapshot${q ? `?${q}` : ""}`);
  }

  /** Snapshot of a fixture's live (or asOf-time) score events. */
  async getScoresSnapshot(fixtureId: number, asOf?: number): Promise<TxScores[]> {
    const q = asOf !== undefined ? `?asOf=${asOf}` : "";
    return this.getJson<TxScores[]>(`/api/scores/snapshot/${fixtureId}${q}`);
  }

  /** A fixture's full array of score updates (including history - for retroactive calculation). */
  async getScoresHistorical(fixtureId: number): Promise<TxScores[]> {
    return this.getJson<TxScores[]>(`/api/scores/historical/${fixtureId}`);
  }

  /**
   * Live score SSE stream. onEvent is called for each `Scores` event.
   * If the connection drops it reconnects with exponential backoff (until aborted).
   */
  async streamScores(
    onEvent: (event: TxScores) => void | Promise<void>,
    signal: AbortSignal
  ): Promise<void> {
    let backoff = RETRY_BASE_MS;
    while (!signal.aborted) {
      try {
        const res = await fetch(`${this.cfg.TXLINE_BASE_URL}/api/scores/stream`, {
          headers: { ...this.authHeaders(), Accept: "text/event-stream" },
          signal,
        });
        if (res.status === 401) {
          this.creds = await resolveCredentials(this.cfg, this.wallet);
          continue;
        }
        if (!res.ok || !res.body) {
          throw new Error(`could not open stream: ${res.status}`);
        }
        logger.info("TxLINE live score stream opened");
        backoff = RETRY_BASE_MS;
        await this.consumeSse(res.body, onEvent, signal);
      } catch (error: unknown) {
        if (signal.aborted) break;
        logger.warn("TxLINE stream dropped, reconnecting", {
          backoff,
          error: errorMessage(error),
        });
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 15_000);
      }
    }
  }

  /** Parses the SSE body line by line and decodes `data:` blocks as JSON. */
  private async consumeSse(
    body: ReadableStream<Uint8Array>,
    onEvent: (event: TxScores) => void | Promise<void>,
    signal: AbortSignal
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let dataLines: string[] = [];

    const flush = async (): Promise<void> => {
      if (dataLines.length === 0) return;
      const payload = dataLines.join("\n");
      dataLines = [];
      try {
        const parsed = JSON.parse(payload) as TxScoresStreamEvent | TxScores;
        const scores = "data" in parsed ? parsed.data : parsed;
        if (
          scores &&
          typeof scores === "object" &&
          ("FixtureId" in scores || "fixtureId" in scores)
        ) {
          await onEvent(scores as TxScores);
        }
      } catch (error: unknown) {
        logger.debug("Could not parse SSE JSON", { error: errorMessage(error) });
      }
    };

    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.replace(/\r$/, "");
        if (trimmed === "") {
          await flush(); // end of event
        } else if (trimmed.startsWith("data:")) {
          dataLines.push(trimmed.slice(5).trimStart());
        }
        // "id:" / "event:" lines are not needed for TxScores; data is enough.
      }
    }
    await flush();
  }
}

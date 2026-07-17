/**
 * Lightweight, dependency-free HTTP hardening middleware for the oracle API:
 *  - rateLimiter: per-IP fixed-window limiter (blunts the RPC-draining DoS surface).
 *  - responseCache: short-TTL GET response cache for heavy, RPC-backed endpoints so a
 *    request loop cannot repeatedly trigger full getProgramAccounts scans.
 *  - corsOrigins: restricts CORS to an allow-list instead of a wildcard.
 */
import type { Request, Response, NextFunction } from "express";

type Middleware = (req: Request, res: Response, next: NextFunction) => void;

/** Per-IP fixed-window rate limiter. Returns 429 once a client exceeds `max` per `windowMs`. */
export function rateLimiter(opts: { windowMs: number; max: number }): Middleware {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const rec = hits.get(ip);
    if (!rec || now > rec.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + opts.windowMs });
      // Opportunistic cleanup of expired buckets so the map cannot grow unbounded.
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
      }
      next();
      return;
    }
    rec.count += 1;
    if (rec.count > opts.max) {
      res.status(429).json({ error: "too many requests" });
      return;
    }
    next();
  };
}

/** Short-TTL response cache for heavy GET endpoints, keyed by full URL (path + query). */
export function responseCache(ttlMs: number): Middleware {
  const store = new Map<string, { body: unknown; ts: number }>();
  return (req, res, next) => {
    if (req.method !== "GET") {
      next();
      return;
    }
    const key = req.originalUrl;
    const now = Date.now();
    const hit = store.get(key);
    if (hit && now - hit.ts < ttlMs) {
      res.json(hit.body);
      return;
    }
    const original = res.json.bind(res);
    res.json = (body: unknown): Response => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        store.set(key, { body, ts: now });
        if (store.size > 4_000) {
          for (const [k, v] of store) if (now - v.ts > ttlMs) store.delete(k);
        }
      }
      return original(body);
    };
    next();
  };
}

/** CORS allow-list. `"*"` in the list keeps the wildcard; otherwise only listed origins echo back. */
export function corsOrigins(allowed: string[]): Middleware {
  const set = new Set(allowed);
  const wildcard = set.has("*");
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (wildcard) {
      res.header("Access-Control-Allow-Origin", "*");
    } else if (origin && set.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  };
}

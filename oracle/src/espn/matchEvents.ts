/**
 * ESPN match event stream (keyEvents): returns an event's FULL chronological events
 * with minutes - goal (scorer + assist), penalty, yellow/red card, substitution (in/out).
 * Because TxLINE does not provide the past timeline of finished matches (historical is
 * empty), the full event list comes from here. 100% real ESPN data, no mock.
 *
 * Source: site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event={id}
 */
import { errorMessage, logger } from "../logger.js";

const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary";

export type EspnEventType = "goal" | "own_goal" | "penalty" | "yellow_card" | "red_card" | "substitution" | "halftime";

export interface EspnMatchEvent {
  type: EspnEventType;
  minute: number | null;
  team: "home" | "away" | null;
  primary: string | null; // scorer / carded player / player coming on
  secondary: string | null; // assist / player going off
  text: string;
}

/** ESPN match status (most reliable source of finish/halftime). */
export interface EspnStatus {
  state: "pre" | "in" | "post"; // pre=not started, in=ongoing, post=finished
  completed: boolean;
  halftime: boolean;
}

export interface EspnSummary {
  events: EspnMatchEvent[];
  status: EspnStatus | null;
}

interface SummaryEvent {
  type?: { text?: string; type?: string };
  clock?: { value?: number; displayValue?: string };
  team?: { id?: string };
  text?: string;
  participants?: Array<{ athlete?: { displayName?: string } }>;
}
interface SummaryHeader {
  competitions?: Array<{
    competitors?: Array<{ homeAway?: string; team?: { id?: string } }>;
    status?: { type?: { state?: string; completed?: boolean; description?: string } };
  }>;
}
interface Summary {
  keyEvents?: SummaryEvent[];
  header?: SummaryHeader;
}

/** ESPN keyEvent type slug -> our type. Filters out meaningless ones (kickoff, halftime...). */
function mapType(slug: string): EspnEventType | null {
  if (/own.?goal/.test(slug)) return "own_goal";
  if (/penalty.*(scored|goal)/.test(slug)) return "penalty";
  // "goal", "goal---header", "goal---shot" etc. are all goals. Exact equality would
  // miss header/volley goals (like Lautaro's header). own_goal/penalty filtered above.
  if (/goal/.test(slug)) return "goal";
  if (/yellow.?card/.test(slug)) return "yellow_card";
  if (/red.?card/.test(slug)) return "red_card";
  if (/substitution/.test(slug)) return "substitution";
  if (/half.?time/.test(slug)) return "halftime"; // halftime separator
  return null;
}

function parseMinute(clock: SummaryEvent["clock"]): number | null {
  const dv = clock?.displayValue;
  if (dv) {
    const m = /(\d+)/.exec(dv);
    if (m && m[1]) return Number.parseInt(m[1], 10);
  }
  return clock?.value ? Math.round(clock.value / 60) : null;
}

/** Returns an ESPN event's full event stream (with minutes, named). May be empty. */
/** An ESPN event's full event stream (with minutes, named) + match status. Single fetch. */
export async function fetchEspnSummary(eventId: string): Promise<EspnSummary> {
  let data: Summary;
  try {
    const res = await fetch(`${BASE}?event=${eventId}`);
    if (!res.ok) return { events: [], status: null };
    data = (await res.json()) as Summary;
  } catch (e: unknown) {
    logger.warn("Failed to fetch ESPN summary", { eventId, error: errorMessage(e) });
    return { events: [], status: null };
  }

  const competition = data.header?.competitions?.[0];
  // home/away team id mapping.
  const comp = competition?.competitors ?? [];
  const homeId = comp.find((c) => c.homeAway === "home")?.team?.id;
  const awayId = comp.find((c) => c.homeAway === "away")?.team?.id;

  const out: EspnMatchEvent[] = [];
  for (const e of data.keyEvents ?? []) {
    const type = mapType(String(e.type?.type ?? ""));
    if (!type) continue;
    const teamId = e.team?.id;
    const team: EspnMatchEvent["team"] = teamId === homeId ? "home" : teamId === awayId ? "away" : null;
    const parts = e.participants ?? [];
    out.push({
      type,
      minute: parseMinute(e.clock),
      team,
      primary: parts[0]?.athlete?.displayName ?? null,
      secondary: parts[1]?.athlete?.displayName ?? null,
      text: e.text ?? "",
    });
  }

  const st = competition?.status?.type;
  const rawState = st?.state;
  const status: EspnStatus | null = st
    ? {
        state: rawState === "in" || rawState === "post" ? rawState : "pre",
        completed: st.completed === true,
        halftime: /halftime/i.test(st.description ?? ""),
      }
    : null;

  return { events: out.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0)), status };
}

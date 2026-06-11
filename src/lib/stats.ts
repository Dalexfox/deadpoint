/**
 * Pure, unit-testable stat helpers for single-player progress.
 *
 * Everything here is a pure function of its inputs (sessions + an injectable
 * `now`), so the date math can be reasoned about and tested without a DB or a
 * real clock. No Supabase, no React, no side effects.
 *
 * All date reasoning is in the device's LOCAL time — "this month" and "this
 * week" mean what they mean to the user looking at their phone.
 */

export type StatSession = {
  createdAt: string;       // ISO timestamp (sessions.created_at)
  grade: string | null;    // V-scale grade for that session's single climb
};

/** 'V5' → 5, 'V10' → 10, null/garbage → -1. */
export function gradeValue(grade: string | null | undefined): number {
  if (!grade) return -1;
  const m = /^V(\d+)$/i.exec(grade.trim());
  return m ? parseInt(m[1], 10) : -1;
}

/** The user's hardest send, or null if they have none. */
export function highestGrade(sessions: StatSession[]): string | null {
  let best: string | null = null;
  let bestVal = -1;
  for (const s of sessions) {
    const v = gradeValue(s.grade);
    if (v > bestVal) { bestVal = v; best = s.grade; }
  }
  return best;
}

/**
 * Is `currentGrade` strictly harder than every grade in `previousGrades`?
 * Empty `previousGrades` (first-ever log) → true. Ties → false.
 */
export function isNewHighPoint(currentGrade: string, previousGrades: (string | null)[]): boolean {
  const cur = gradeValue(currentGrade);
  if (cur < 0) return false;
  let prevMax = -1;
  for (const g of previousGrades) {
    const v = gradeValue(g);
    if (v > prevMax) prevMax = v;
  }
  return cur > prevMax;
}

/** Local YYYY-M-D key for a date (collapses a timestamp to a calendar day). */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Sends and distinct days climbed in `now`'s calendar month.
 * A "day climbed" is a distinct local calendar day with ≥1 session.
 */
export function monthStats(
  sessions: StatSession[],
  now: Date = new Date(),
): { sends: number; daysClimbed: number } {
  const y = now.getFullYear();
  const m = now.getMonth();
  let sends = 0;
  const days = new Set<string>();
  for (const s of sessions) {
    const d = new Date(s.createdAt);
    if (d.getFullYear() === y && d.getMonth() === m) {
      sends += 1;
      days.add(dayKey(d));
    }
  }
  return { sends, daysClimbed: days.size };
}

/** Local midnight of the Monday that starts `d`'s week (Mon–Sun weeks). */
function startOfWeekMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); // strip time
  const day = x.getDay();              // 0=Sun … 6=Sat
  const shift = day === 0 ? -6 : 1 - day; // move back to Monday
  x.setDate(x.getDate() + shift);
  return x;
}

/**
 * Consecutive Mon–Sun weeks with ≥1 session, counted backward from the current
 * week.
 *
 * Semantics (intentionally forgiving so a streak isn't shown as broken just
 * because the user hasn't climbed yet THIS week):
 *   - The current week is included in the count when it has a session.
 *   - If the current week has no session yet, the streak is NOT broken — we
 *     start counting from last week (a one-week grace for the in-progress week).
 *   - Any earlier week with no session ends the streak.
 *
 * Returns 0 when there's no qualifying recent activity.
 */
export function weekStreak(sessions: StatSession[], now: Date = new Date()): number {
  const weeks = new Set<string>();
  for (const s of sessions) {
    weeks.add(dayKey(startOfWeekMonday(new Date(s.createdAt))));
  }

  let cursor = startOfWeekMonday(now);
  // Grace for the in-progress current week: if it's empty, drop to last week
  // without counting it, but don't treat it as a break.
  if (!weeks.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 7);
  }

  let count = 0;
  while (weeks.has(dayKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  return count;
}

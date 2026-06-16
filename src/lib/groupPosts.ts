/**
 * Feed session grouping — a pure, render-time fold. No DB changes, no delayed
 * posting: posts hit the feed instantly and are only *visually* clustered here.
 *
 * Group key = same user_id + same gym_id + same LOCAL calendar day.
 * - Members need NOT be adjacent (another user's post between two of mine on the
 *   same day at the same gym does not split the group).
 * - Grouping by user_id can never cross the feed's two ordering segments
 *   (followed-first vs. by-likes), because every one of a given user's posts
 *   lives in exactly one segment. So this can safely run on the concatenated list.
 * - A group occupies its MOST RECENT member's position (a new send bubbles it up).
 * - Single-member "groups" are returned as plain posts (zero visual change).
 */
import { type Post } from './store';
import { gradeValue } from './stats';

// Spec alias — the grouping operates on the feed's existing Post shape.
export type FeedPost = Post;

export type GroupedPost = {
  groupKey: string;
  members: Post[];
  anchor: Post;   // most recent member — determines feed position
  cover: Post;    // hardest grade (gradeValue); ties → most recent
  pages: Post[];  // cover first, then oldest → newest (unless feed_rank overrides)
};

/** Discriminates a grouped card from a plain post in the folded output. */
export function isGroupedPost(item: Post | GroupedPost): item is GroupedPost {
  return (item as GroupedPost).members !== undefined;
}

function time(p: Post): number {
  return new Date(p.createdAt ?? 0).getTime();
}

/** Local Y-M-D key (device timezone) so "same day" matches what the user sees. */
function localDayKey(iso: string | undefined): string {
  const d = new Date(iso ?? 0);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function groupKeyFor(p: Post): string {
  // A solo session gets a unique key, so it's always a singleton bucket and
  // renders as its own card — even if it shares a day/gym with other sends.
  if (p.solo) return `solo|${p.id}`;
  return `${p.userId ?? '?'}|${p.gymId ?? '?'}|${localDayKey(p.createdAt)}`;
}

function mostRecent(members: Post[]): Post {
  return members.reduce((a, b) => (time(b) > time(a) ? b : a));
}

/** Hardest grade wins; ties broken by most recent. */
function pickCover(members: Post[]): Post {
  return members.reduce((best, m) => {
    const mv = gradeValue(m.topGrade ?? null);
    const bv = gradeValue(best.topGrade ?? null);
    if (mv > bv) return m;
    if (mv === bv) return time(m) > time(best) ? m : best;
    return best;
  });
}

function hasRank(p: Post): boolean {
  return p.feedRank !== null && p.feedRank !== undefined;
}

/**
 * Page order:
 *  - If ANY member has feed_rank set, order ALL pages by feed_rank ascending,
 *    nulls last (the user's custom order is never overridden; new sends append).
 *  - Otherwise: cover first, then the rest oldest → newest.
 */
function buildPages(members: Post[], cover: Post): Post[] {
  if (members.some(hasRank)) {
    const ranked = members.filter(hasRank).sort((a, b) => (a.feedRank as number) - (b.feedRank as number));
    const nulls  = members.filter(m => !hasRank(m)).sort((a, b) => time(a) - time(b));
    return [...ranked, ...nulls];
  }
  const rest = members.filter(m => m.id !== cover.id).sort((a, b) => time(a) - time(b));
  return [cover, ...rest];
}

export function groupPosts(posts: Post[]): (Post | GroupedPost)[] {
  // Bucket every post by its group key.
  const groups = new Map<string, Post[]>();
  for (const p of posts) {
    const key = groupKeyFor(p);
    const arr = groups.get(key);
    if (arr) arr.push(p);
    else groups.set(key, [p]);
  }

  // Walk the ORIGINAL ordered list. Emit singles in place; emit a grouped card
  // at its anchor's slot (most recent member) and skip the absorbed members.
  const out: (Post | GroupedPost)[] = [];
  for (const p of posts) {
    const members = groups.get(groupKeyFor(p))!;
    if (members.length === 1) {
      out.push(p);
      continue;
    }
    const anchor = mostRecent(members);
    if (p.id === anchor.id) {
      const cover = pickCover(members);
      out.push({ groupKey: groupKeyFor(p), members, anchor, cover, pages: buildPages(members, cover) });
    }
    // non-anchor members are absorbed into the group → skip
  }
  return out;
}

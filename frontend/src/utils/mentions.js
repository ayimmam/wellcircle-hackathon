// Shared @mention helpers for the post composer and rendered post/comment
// text. Mentions only resolve against the member list of the circle/
// community the post belongs to (passed in as `membersByHandle`), so a
// "@handle" that isn't a member of this group renders as plain text.

const MENTION_TOKEN = /@([A-Za-z0-9_]+)/g;

export function buildMembersByHandle(members) {
  const map = new Map();
  for (const m of members || []) {
    const handle = (m.telegram_handle || m.name || '').toLowerCase().replace(/\s+/g, '');
    if (handle) map.set(handle, m);
  }
  return map;
}

// Given the composer's current text and cursor position, returns the
// in-progress "@query" being typed (without the @) and the index where it
// starts, or null if the cursor isn't inside a mention token right now.
export function findActiveMention(text, cursor) {
  const upToCursor = text.slice(0, cursor);
  const at = upToCursor.lastIndexOf('@');
  if (at === -1) return null;
  const between = upToCursor.slice(at + 1);
  // A space (or another @) between the @ and the cursor means we've moved
  // past that mention already.
  if (/[\s@]/.test(between)) return null;
  return { start: at, query: between };
}

export function insertMention(text, start, query, handle) {
  const before = text.slice(0, start);
  const after = text.slice(start + 1 + query.length);
  return `${before}@${handle} ${after}`;
}

// Splits text into an array of strings and { mention, member } tokens for
// the caller to render — kept framework-agnostic so it's easy to map to JSX.
export function splitMentions(text, membersByHandle) {
  const parts = [];
  let lastIndex = 0;
  for (const match of text.matchAll(MENTION_TOKEN)) {
    const [full, handle] = match;
    const index = match.index;
    if (index > lastIndex) parts.push(text.slice(lastIndex, index));
    const member = membersByHandle?.get(handle.toLowerCase());
    parts.push(member ? { mention: full, member } : full);
    lastIndex = index + full.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

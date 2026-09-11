/**
 * How the palette matches and ranks.
 *
 * Pure, so the unit tests can hold the rules to cases: "hamilton" offers Sir
 * Lewis before Duncan, "raikkonen" finds Räikkönen and "Räikkönen" finds
 * Raikkonen, "monaco 1996" finds the 1996 Monaco Grand Prix. The interaction
 * critique found the previous rule put the wrong driver first for 11 of the
 * 25 winningest drivers, because the only tie-break was label length; it
 * matched accents only one way, depending on which spelling the register
 * happened to hold; and it required the reader's words in the label's order.
 */

/**
 * Lower-case, and strip diacritics both from the label and from what was typed.
 *
 * NFD takes care of the marks - Räikkönen, Pérez, Hülkenberg - but a letter
 * that is its own letter has no mark to strip: ø, ł, ß, ð, æ. Tom Belsø was
 * the one driver "belso" could not find, and the review found him.
 */
const LETTERS = { ø: 'o', ł: 'l', ß: 'ss', ð: 'd', æ: 'ae', þ: 'th', đ: 'd', œ: 'oe' }
export const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[øłßðæþđœ]/g, (c) => LETTERS[c])

/**
 * A rank for `entry` against what was typed, or -1 for no match.
 *
 * Every word typed must appear somewhere in the label. The rank is where the
 * best-placed word sits — start of the label beats start of a word beats
 * anywhere — plus prominence, so that among names that match equally the one
 * with the most wins (or races, for a circuit) comes first, and only then the
 * shorter label. `entry.needle` is the folded label; `entry.weight` the
 * prominence figure the index carries.
 */
export function rank(entry, typed) {
  const words = fold(typed).split(/\s+/).filter(Boolean)
  if (words.length === 0) return -1
  let best = 0
  for (const word of words) {
    const at = entry.needle.indexOf(word)
    if (at === -1) return -1
    const cls = at === 0 ? 100 : entry.needle[at - 1] === ' ' || entry.needle[at - 1] === '-' ? 60 : 20
    if (cls > best) best = cls
  }
  const prominence = Math.min(Number(entry.weight) || 0, 100) / 100
  return best + prominence - entry.needle.length / 2000
}

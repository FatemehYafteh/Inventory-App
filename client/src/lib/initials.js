/**
 * Avatar initials. Latin names give the first letter of the first two words ("FY"). Persian and
 * Arabic names give only the first letter of the first word, because joined letters such as "فی"
 * would read as a word.
 */
export function initials(name) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = Array.from(words[0])[0];
  if (/\p{Script=Arabic}/u.test(first)) return first;
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join('')
    .toUpperCase();
}

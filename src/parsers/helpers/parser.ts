import { Stat } from 'obsidian';
import { Item } from 'src/components/types';

export interface FileAccessor {
  isEmbed: boolean;
  target: string;
  stats?: Stat;
}

export function markRangeForDeletion(str: string, range: { start: number; end: number }): string {
  const len = str.length;

  let start = range.start;
  while (start > 0 && str[start - 1] === ' ') start--;

  let end = range.end;
  while (end < len - 1 && str[end + 1] === ' ') end++;

  return str.slice(0, start) + '\u0000'.repeat(end - start) + str.slice(end);
}

export function executeDeletion(str: string) {
  return str.replace(/ *\0+ */g, ' ').trim();
}

export function replaceNewLines(str: string) {
  return str.trim().replace(/(?:\r\n|\n)/g, '<br>');
}

export function replaceBrs(str: string) {
  return str.replace(/<br>/g, '\n').trim();
}

export function indentNewLines(str: string) {
  const useTab = (app.vault as any).getConfig('useTab');
  return str.trim().replace(/(?:\r\n|\n)/g, useTab ? '\n\t' : '\n    ');
}

// Lines that start a new markdown block (list, heading, quote, code fence, table)
const blockStartRegex = /^\s*(?:[-*+]\s|\d+[.)]\s|#{1,6}\s|>|```|~~~|\|)/;

// Index of the last line of the card's first paragraph. A block ID only works
// (and is only hidden by Obsidian) at the end of a paragraph, not mid-paragraph.
function getFirstParagraphEnd(lines: string[]) {
  let end = 0;
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim() || blockStartRegex.test(lines[i])) break;
    end = i;
  }
  return end;
}

export function addBlockId(str: string, item: Item) {
  if (!item.data.blockId) return str;

  const lines = str.split(/(?:\r\n|\n)/g);
  lines[getFirstParagraphEnd(lines)] += ' ^' + item.data.blockId;

  return lines.join('\n');
}

export function removeBlockId(str: string) {
  const lines = str.split(/(?:\r\n|\n)/g);
  const end = getFirstParagraphEnd(lines);

  // Older versions wrote the ID at the end of the first line, so check every line
  // of the first paragraph
  for (let i = 0; i <= end; i++) {
    lines[i] = lines[i].replace(/\s+\^([a-zA-Z0-9-]+)$/, '');
  }

  return lines.join('\n');
}

export function dedentNewLines(str: string) {
  return str.trim().replace(/(?:\r\n|\n)(?: {4}|\t)/g, '\n');
}

export function parseLaneTitle(str: string) {
  str = replaceBrs(str);

  const match = str.match(/^(.*?)\s*\((\d+)\)$/);
  if (match == null) return { title: str, maxItems: 0 };

  return { title: match[1], maxItems: Number(match[2]) };
}

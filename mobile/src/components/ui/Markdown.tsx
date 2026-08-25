import React, { useMemo } from 'react';
import { Linking, Text, View } from 'react-native';

/**
 * A small Markdown renderer for the subset the clinical engines actually emit:
 * headings, bullet and numbered lists, tables, rules, bold/italic/code and
 * inline citation links such as `[2](https://pubmed…)`.
 *
 * A purpose-built renderer keeps the output on the design system and avoids a
 * heavyweight dependency for six block types.
 */

type Block =
  | { kind: 'heading'; level: 2 | 3 | 4; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'numbered'; index: number; text: string }
  | { kind: 'rule' }
  | { kind: 'table'; rows: string[][] };

export function Markdown({ content, allowLinks = true }: { content: string; allowLinks?: boolean }) {
  const blocks = useMemo(() => parse(content), [content]);

  return (
    <View>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} first={index === 0} allowLinks={allowLinks} />
      ))}
    </View>
  );
}

function BlockView({
  block,
  first,
  allowLinks,
}: {
  block: Block;
  first: boolean;
  allowLinks: boolean;
}) {
  switch (block.kind) {
    case 'heading': {
      const size =
        block.level === 2 ? 'text-lg font-bold' : block.level === 3 ? 'text-base font-bold' : 'text-base font-semibold';
      return (
        <View className={first ? '' : 'mt-5'}>
          {block.level === 2 ? <View className="mb-2 h-0.5 w-9 rounded-full bg-accent-200" /> : null}
          <Text className={`${size} text-text-100`}>
            <Inline text={block.text} allowLinks={allowLinks} />
          </Text>
        </View>
      );
    }

    case 'bullet':
      return (
        <View className="mt-2 flex-row pl-1">
          <View className="mr-2.5 mt-2.5 h-1.5 w-1.5 rounded-full bg-primary-300" />
          <Text className="flex-1 text-base text-text-200">
            <Inline text={block.text} allowLinks={allowLinks} />
          </Text>
        </View>
      );

    case 'numbered':
      return (
        <View className="mt-2 flex-row pl-1">
          <Text className="mr-2 text-base font-bold text-primary-200">{block.index}.</Text>
          <Text className="flex-1 text-base text-text-200">
            <Inline text={block.text} allowLinks={allowLinks} />
          </Text>
        </View>
      );

    case 'rule':
      return <View className="my-4 h-px bg-bg-300" />;

    case 'table':
      return (
        <View className="mt-3 overflow-hidden rounded-xl border border-bg-300">
          {block.rows.map((cells, rowIndex) => (
            <View
              key={rowIndex}
              className={`flex-row ${rowIndex === 0 ? 'bg-bg-200' : rowIndex % 2 === 0 ? 'bg-bg-100' : 'bg-surface'} ${
                rowIndex > 0 ? 'border-t border-bg-300' : ''
              }`}
            >
              {cells.map((cell, cellIndex) => (
                <View key={cellIndex} className="flex-1 px-2.5 py-2">
                  <Text className={`text-sm ${rowIndex === 0 ? 'font-semibold text-text-100' : 'text-text-200'}`}>
                    <Inline text={cell} allowLinks={allowLinks} />
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      );

    case 'paragraph':
    default:
      return (
        <Text className={`${first ? '' : 'mt-3'} text-base text-text-200`}>
          <Inline text={block.text} allowLinks={allowLinks} />
        </Text>
      );
  }
}

/** Renders bold, italic, inline code and links inside a single line of text. */
function Inline({ text, allowLinks = true }: { text: string; allowLinks?: boolean }) {
  const tokens = useMemo(() => tokenise(text), [text]);

  return (
    <>
      {tokens.map((token, index) => {
        if (token.type === 'bold') {
          return (
            <Text key={index} className="font-bold text-text-100">
              {token.value}
            </Text>
          );
        }
        if (token.type === 'italic') {
          return (
            <Text key={index} className="italic">
              {token.value}
            </Text>
          );
        }
        if (token.type === 'code') {
          return (
            <Text key={index} className="rounded bg-bg-200 px-1 font-mono text-sm text-primary-100">
              {token.value}
            </Text>
          );
        }
        if (token.type === 'link') {
          if (!allowLinks) {
            if (isCitation(token.value)) return null;
            return <Text key={index}>{token.value}</Text>;
          }
          return (
            <Text
              key={index}
              className="font-semibold text-primary-200 underline"
              suppressHighlighting
              onPress={() => {
                Linking.openURL(token.href!).catch(() => undefined);
              }}
            >
              {isCitation(token.value) ? `[${token.value}]` : token.value}
            </Text>
          );
        }
        return <Text key={index}>{token.value}</Text>;
      })}
    </>
  );
}

type Token = { type: 'text' | 'bold' | 'italic' | 'code' | 'link'; value: string; href?: string };

const INLINE_PATTERN = /(\[[^\]]*\]\([^)]+\))|(\*\*[^*]+\*\*)|(`[^`]+`)|(\*[^*\n]+\*)/g;

function tokenise(text: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const start = match.index ?? 0;
    if (start > cursor) tokens.push({ type: 'text', value: text.slice(cursor, start) });

    const raw = match[0];
    if (raw.startsWith('[')) {
      const parts = /^\[([^\]]*)\]\(([^)]+)\)$/.exec(raw);
      if (parts) tokens.push({ type: 'link', value: parts[1], href: parts[2] });
    } else if (raw.startsWith('**')) {
      tokens.push({ type: 'bold', value: raw.slice(2, -2) });
    } else if (raw.startsWith('`')) {
      tokens.push({ type: 'code', value: raw.slice(1, -1) });
    } else {
      tokens.push({ type: 'italic', value: raw.slice(1, -1) });
    }

    cursor = start + raw.length;
  }

  if (cursor < text.length) tokens.push({ type: 'text', value: text.slice(cursor) });
  return tokens.length > 0 ? tokens : [{ type: 'text', value: text }];
}

/** EvidenceMD emits sources as `[3](url)`; render those as visible reference markers. */
function isCitation(label: string): boolean {
  return /^\d{1,3}$/.test(label.trim());
}

function parse(content: string): Block[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let table: string[][] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', text: paragraph.join(' ').trim() });
      paragraph = [];
    }
  };
  const flushTable = () => {
    if (table.length > 0) {
      blocks.push({ kind: 'table', rows: table });
      table = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushTable();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim() === '') {
      flushAll();
      continue;
    }

    if (/^\s*(---|___|\*\*\*)\s*$/.test(line)) {
      flushAll();
      blocks.push({ kind: 'rule' });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      const level = Math.min(4, Math.max(2, heading[1].length)) as 2 | 3 | 4;
      blocks.push({ kind: 'heading', level, text: heading[2].trim() });
      continue;
    }

    if (line.trim().startsWith('|') && line.includes('|', 1)) {
      flushParagraph();
      const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      // Skip the |---|---| separator row.
      if (!cells.every((cell) => /^:?-{2,}:?$/.test(cell))) table.push(cells);
      continue;
    }
    flushTable();

    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      blocks.push({ kind: 'bullet', text: bullet[1].trim() });
      continue;
    }

    const numbered = /^\s*(\d{1,2})[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      flushParagraph();
      blocks.push({ kind: 'numbered', index: Number(numbered[1]), text: numbered[2].trim() });
      continue;
    }

    paragraph.push(line.trim());
  }

  flushAll();
  return blocks;
}

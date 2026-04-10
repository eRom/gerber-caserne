import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import type { Root, RootContent, Heading } from 'mdast';
import { sha256 } from '../db/hash.js';
import { countTokens } from './tokenizer.js';

import { CHUNK_CONFIG } from '../config.js';

export interface ChunkResult {
  position: number;
  heading_path: string;
  content: string;
  content_hash: string;
}

const parser = unified().use(remarkParse).use(remarkGfm);
const serializer = unified().use(remarkStringify);

function serializeNodes(nodes: RootContent[]): string {
  if (nodes.length === 0) return '';
  const root: Root = { type: 'root', children: nodes };
  return serializer.stringify(root).trim();
}

function isHeadingSplit(node: RootContent): node is Heading {
  return node.type === 'heading' && node.depth <= CHUNK_CONFIG.maxDepth;
}

function headingText(node: Heading): string {
  // Extract plain text from heading children
  return node.children
    .map((c) => ('value' in c ? c.value : ''))
    .join('')
    .trim();
}

export async function chunk(markdown: string): Promise<ChunkResult[]> {
  const tree = parser.parse(markdown);
  const children = tree.children;

  const results: ChunkResult[] = [];
  const headingStack: string[] = [];
  let accum: RootContent[] = [];

  function flush() {
    const content = serializeNodes(accum);
    if (content.length === 0 && headingStack.length === 0) {
      accum = [];
      return;
    }
    const headingPath = headingStack.join(' > ');
    results.push({
      position: results.length,
      heading_path: headingPath,
      content,
      content_hash: sha256(content),
    });
    accum = [];
  }

  for (const node of children) {
    if (isHeadingSplit(node)) {
      // Flush accumulated content as a chunk
      flush();

      // Update heading stack: pop everything at or deeper than current depth
      while (headingStack.length >= node.depth) {
        headingStack.pop();
      }
      headingStack.push(headingText(node));
    } else {
      accum.push(node);
    }
  }

  // Flush remaining content
  flush();

  return results;
}

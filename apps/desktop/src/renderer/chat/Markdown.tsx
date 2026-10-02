/** Renders markdown-lite nodes as React elements: text stays text (no HTML is ever injected). */
import { useMemo, type JSX } from 'react';
import { parseMarkdownLite, type Inline } from './markdown-lite.js';

function InlineNodes({ nodes }: { readonly nodes: readonly Inline[] }): JSX.Element {
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.type) {
          case 'text':
            return <span key={index}>{node.text}</span>;
          case 'code':
            return <code key={index}>{node.text}</code>;
          case 'strong':
            return (
              <strong key={index}>
                <InlineNodes nodes={node.children} />
              </strong>
            );
          case 'em':
            return (
              <em key={index}>
                <InlineNodes nodes={node.children} />
              </em>
            );
        }
      })}
    </>
  );
}

export function Markdown({ text }: { readonly text: string }): JSX.Element {
  const blocks = useMemo(() => parseMarkdownLite(text), [text]);
  return (
    <div className="markdown">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'paragraph':
            return (
              <p key={index}>
                <InlineNodes nodes={block.children} />
              </p>
            );
          case 'heading':
            return (
              <p key={index} className="markdown-heading">
                <InlineNodes nodes={block.children} />
              </p>
            );
          case 'code':
            return (
              <pre key={index}>
                <code>{block.text}</code>
              </pre>
            );
          case 'list': {
            const items = block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <InlineNodes nodes={item} />
              </li>
            ));
            return block.ordered ? <ol key={index}>{items}</ol> : <ul key={index}>{items}</ul>;
          }
        }
      })}
    </div>
  );
}

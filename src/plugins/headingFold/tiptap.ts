/**
 * Heading Fold Tiptap Extension
 *
 * Purpose: Adds visual-only collapse controls to WYSIWYG headings. Folding
 * hides the blocks under a heading until the next same-or-higher-level heading
 * without changing the Markdown document.
 *
 * @module plugins/headingFold/tiptap
 */

import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import "./heading-fold.css";

export interface HeadingSection {
  key: string;
  level: number;
  text: string;
  pos: number;
  contentFrom: number;
  contentTo: number;
  node: PMNode;
}

export interface HeadingFoldPluginState {
  collapsedKeys: Set<string>;
}

type HeadingFoldMeta = {
  type: "toggle";
  key: string;
};

export const headingFoldPluginKey = new PluginKey<HeadingFoldPluginState>("headingFold");

function isHeadingNode(node: PMNode): boolean {
  return node.type.name === "heading" && typeof node.attrs.level === "number";
}

function createSectionKey(level: number, text: string, occurrence: number): string {
  return `${level}:${text}:${occurrence}`;
}

export function collectHeadingSections(doc: PMNode): HeadingSection[] {
  const headings: HeadingSection[] = [];
  const occurrenceCounts = new Map<string, number>();

  doc.descendants((node, pos) => {
    if (!isHeadingNode(node)) return true;

    const level = node.attrs.level as number;
    const text = node.textContent.trim();
    const occurrenceBase = `${level}:${text}`;
    const occurrence = (occurrenceCounts.get(occurrenceBase) ?? 0) + 1;
    occurrenceCounts.set(occurrenceBase, occurrence);

    headings.push({
      key: createSectionKey(level, text, occurrence),
      level,
      text,
      pos,
      contentFrom: pos + node.nodeSize,
      contentTo: doc.content.size,
      node,
    });

    return false;
  });

  for (let i = 0; i < headings.length; i += 1) {
    const current = headings[i];
    const nextBoundary = headings.find((candidate, index) =>
      index > i && candidate.level <= current.level
    );
    current.contentTo = nextBoundary?.pos ?? doc.content.size;
  }

  return headings;
}

function createToggleButton(
  view: EditorView,
  section: HeadingSection,
  collapsed: boolean,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "heading-fold-toggle";
  button.dataset.headingFoldKey = section.key;
  button.dataset.collapsed = collapsed ? "true" : "false";
  button.setAttribute("aria-label", collapsed ? "Expand section" : "Collapse section");
  button.setAttribute("aria-expanded", collapsed ? "false" : "true");
  button.title = collapsed ? "Expand section" : "Collapse section";

  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    view.dispatch(
      view.state.tr.setMeta(headingFoldPluginKey, { type: "toggle", key: section.key } satisfies HeadingFoldMeta),
    );
    view.focus();
  });

  return button;
}

function shouldStopHeadingFoldEvent(event: Event): boolean {
  return event.target instanceof Element && event.target.closest(".heading-fold-toggle") !== null;
}

export function buildHeadingFoldDecorations(
  doc: PMNode,
  collapsedKeys: Set<string>,
): DecorationSet {
  const sections = collectHeadingSections(doc);
  if (sections.length === 0) return DecorationSet.empty;

  const decorations: Decoration[] = [];
  const hiddenBlockKeys = new Set<string>();

  for (const section of sections) {
    const collapsed = collapsedKeys.has(section.key);
    decorations.push(
      Decoration.widget(
        section.pos + 1,
        (view) => createToggleButton(view, section, collapsed),
        {
          key: `heading-fold-toggle:${section.key}:${collapsed ? "closed" : "open"}`,
          side: -1,
          stopEvent: shouldStopHeadingFoldEvent,
          headingFoldToggle: true,
        },
      ),
    );

    if (!collapsed || section.contentFrom >= section.contentTo) continue;

    doc.nodesBetween(section.contentFrom, section.contentTo, (node, pos, parent) => {
      if (!node.isBlock || parent !== doc) return true;
      const hiddenBlockKey = `${pos}:${node.nodeSize}`;
      if (!hiddenBlockKeys.has(hiddenBlockKey)) {
        hiddenBlockKeys.add(hiddenBlockKey);
        decorations.push(
          Decoration.node(pos, pos + node.nodeSize, { class: "heading-fold-hidden" }, {
            headingFoldHidden: true,
          }),
        );
      }
      return false;
    });
  }

  return DecorationSet.create(doc, decorations);
}

function filterCollapsedKeys(doc: PMNode, collapsedKeys: Set<string>): Set<string> {
  if (collapsedKeys.size === 0) return collapsedKeys;
  const currentKeys = new Set(collectHeadingSections(doc).map((section) => section.key));
  const nextKeys = new Set<string>();
  for (const key of collapsedKeys) {
    if (currentKeys.has(key)) nextKeys.add(key);
  }
  return nextKeys;
}

export const headingFoldExtension = Extension.create({
  name: "headingFold",
  priority: 90,

  addProseMirrorPlugins() {
    return [
      new Plugin<HeadingFoldPluginState>({
        key: headingFoldPluginKey,
        state: {
          init: () => ({ collapsedKeys: new Set<string>() }),
          apply(tr, value) {
            let collapsedKeys = tr.docChanged
              ? filterCollapsedKeys(tr.doc, value.collapsedKeys)
              : value.collapsedKeys;

            const meta = tr.getMeta(headingFoldPluginKey) as HeadingFoldMeta | undefined;
            if (meta?.type === "toggle") {
              collapsedKeys = new Set(collapsedKeys);
              if (collapsedKeys.has(meta.key)) {
                collapsedKeys.delete(meta.key);
              } else {
                collapsedKeys.add(meta.key);
              }
            }

            return { collapsedKeys };
          },
        },
        props: {
          decorations(state) {
            const pluginState = headingFoldPluginKey.getState(state);
            return buildHeadingFoldDecorations(state.doc, pluginState?.collapsedKeys ?? new Set());
          },
        },
      }),
    ];
  },
});

/**
 * Heading Fold Tiptap Extension Tests
 *
 * Covers section range detection and the ProseMirror plugin state used by
 * inline heading collapse controls.
 */

import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import type { DecorationSet } from "@tiptap/pm/view";

import {
  buildHeadingFoldDecorations,
  collectHeadingSections,
  headingFoldExtension,
  headingFoldPluginKey,
} from "./tiptap";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    text: { inline: true },
    paragraph: { group: "block", content: "text*" },
    heading: {
      group: "block",
      content: "text*",
      attrs: { level: { default: 1 } },
      toDOM: (node) => [`h${node.attrs.level}`, 0],
      parseDOM: [
        { tag: "h1", attrs: { level: 1 } },
        { tag: "h2", attrs: { level: 2 } },
        { tag: "h3", attrs: { level: 3 } },
        { tag: "h4", attrs: { level: 4 } },
        { tag: "h5", attrs: { level: 5 } },
        { tag: "h6", attrs: { level: 6 } },
      ],
    },
  },
});

function p(text: string) {
  return schema.node("paragraph", null, text ? [schema.text(text)] : []);
}

function h(level: number, text: string) {
  return schema.node("heading", { level }, text ? [schema.text(text)] : []);
}

function createDoc() {
  return schema.node("doc", null, [
    h(1, "Title"),
    p("Intro"),
    h(2, "Child"),
    p("Child text"),
    h(2, "Next"),
    p("Next text"),
    h(1, "End"),
    p("End text"),
  ]);
}

function createPlugin() {
  return headingFoldExtension.config.addProseMirrorPlugins!.call({
    editor: {},
    name: "headingFold",
    options: {},
    storage: {},
    type: undefined,
    parent: undefined,
  } as never)[0];
}

describe("collectHeadingSections", () => {
  it("stops each heading range at the next same-or-higher-level heading", () => {
    const doc = createDoc();
    const sections = collectHeadingSections(doc);

    expect(sections.map((section) => ({
      level: section.level,
      text: section.text,
      hiddenText: doc.textBetween(section.contentFrom, section.contentTo, "\n"),
    }))).toEqual([
      {
        level: 1,
        text: "Title",
        hiddenText: "Intro\nChild\nChild text\nNext\nNext text",
      },
      { level: 2, text: "Child", hiddenText: "Child text" },
      { level: 2, text: "Next", hiddenText: "Next text" },
      { level: 1, text: "End", hiddenText: "End text" },
    ]);
  });
});

describe("buildHeadingFoldDecorations", () => {
  it("adds a toggle widget for headings and hides folded section blocks", () => {
    const doc = createDoc();
    const titleKey = collectHeadingSections(doc)[0].key;
    const decorations = buildHeadingFoldDecorations(doc, new Set([titleKey]));

    expect(decorations.find(undefined, undefined, (spec) => spec.headingFoldToggle)).toHaveLength(4);
    expect(decorations.find(undefined, undefined, (spec) => spec.headingFoldHidden)).toHaveLength(5);
  });
});

describe("headingFoldExtension", () => {
  it("toggles collapsed heading state through plugin meta", () => {
    const plugin = createPlugin();
    const doc = createDoc();
    const firstKey = collectHeadingSections(doc)[0].key;
    const state = EditorState.create({ doc, schema, plugins: [plugin] });

    const collapsed = state.apply(
      state.tr.setMeta(headingFoldPluginKey, { type: "toggle", key: firstKey }),
    );

    expect(headingFoldPluginKey.getState(collapsed)?.collapsedKeys.has(firstKey)).toBe(true);

    const decorations = plugin.props.decorations?.(collapsed) as DecorationSet;
    expect(decorations.find(undefined, undefined, (spec) => spec.headingFoldHidden)).toHaveLength(5);
  });
});

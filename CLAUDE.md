# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Plugin Does

This is an Obsidian plugin that expands `&[[Note#Heading]]` tags inline. When triggered, it reads the referenced note from the vault, finds the specified heading, extracts that section's content (up to the next same-or-higher heading), strips trailing blank lines, and replaces the tag line with the raw section text.

## No Build System

This plugin has no build step, no `package.json`, and no dependencies. `main.js` is plain CommonJS JavaScript loaded directly by Obsidian. Edit it directly — there is nothing to compile or bundle.

## Development Workflow

To test changes, copy `main.js`, `manifest.json`, and `style.css` into an Obsidian vault's plugin directory:

```
<vault>/.obsidian/plugins/expand-insert-tag/
```

Then reload the plugin in Obsidian via **Settings → Community Plugins → disable/enable** or use the **Reload app without saving** command.

There are no automated tests.

## Architecture

Everything lives in `main.js` as a single class extending Obsidian's `Plugin`. The core logic is the `expandAtLine(editor, lineIndex)` inner function, which:

1. Matches the tag regex `^&\[\[([^\]#]+)#+([^\]]+)\]\]` against the line.
2. Resolves the note file via `app.metadataCache.getFirstLinkpathDest()`.
3. Reads file content with `app.vault.read()` and finds the heading by case-insensitive comparison.
4. Collects lines from that heading until a heading of equal or lesser depth.
5. Calls `editor.setLine()` to replace the tag line in place.

Two entry points call `expandAtLine`:
- A command (`expand-insert-tag`) triggered from the command palette.
- A `keydown` DOM event listener registered in **capture phase** so it fires before CodeMirror, allowing `evt.preventDefault()` to suppress Obsidian's normal Enter behaviour when the cursor line contains a tag.

On failure (note not found, heading not found), the tag line is replaced with an HTML comment `<!-- &[[...]] — not found -->` and a `Notice` is shown.

## Obsidian API Surface Used

- `app.workspace.getActiveFile()` / `getActiveViewOfType(MarkdownView)`
- `app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath)`
- `app.vault.read(file)`
- `editor.getLine()`, `editor.setLine()`, `editor.getCursor()`
- `new Notice(message)`
- `this.addCommand()`, `this.registerDomEvent()`

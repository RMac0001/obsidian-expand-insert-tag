const { Plugin, Notice, MarkdownView } = require("obsidian");

module.exports = class ExpandInsertTagPlugin extends Plugin {
  async onload() {
    const expandAtLine = async (editor, lineIndex) => {
      const activeFile = this.app.workspace.getActiveFile();
      if (!activeFile) return false;

      const lineText = editor.getLine(lineIndex);
      const match = lineText.match(/^&\[\[([^\]#]+)#+([^\]]+)\]\]/);
      if (!match) return false;

      const [fullMatch, noteName, headingText] = match;
      const errorTag = `<!-- ${fullMatch} — not found -->`;

      const file = this.app.metadataCache.getFirstLinkpathDest(noteName, activeFile.path);
      if (!file) {
        editor.setLine(lineIndex, errorTag);
        new Notice(`Could not find note: "${noteName}"`);
        return true;
      }

      const content = await this.app.vault.read(file);
      const lines = content.split("\n");

      const headingNormalized = headingText.trim().toLowerCase();
      let headingLineIndex = -1;
      let headingLevel = 0;

      for (let i = 0; i < lines.length; i++) {
        const hMatch = lines[i].match(/^(#{1,6})\s+(.+)/);
        if (hMatch) {
          const level = hMatch[1].length;
          const text = hMatch[2].trim().toLowerCase();
          if (text === headingNormalized) {
            headingLineIndex = i;
            headingLevel = level;
            break;
          }
        }
      }

      if (headingLineIndex === -1) {
        editor.setLine(lineIndex, errorTag);
        new Notice(`Could not find heading "#${headingText}" in "${noteName}"`);
        return true;
      }

      const sectionLines = [lines[headingLineIndex]];
      for (let i = headingLineIndex + 1; i < lines.length; i++) {
        const hMatch = lines[i].match(/^(#{1,6})\s+/);
        if (hMatch && hMatch[1].length <= headingLevel) break;
        sectionLines.push(lines[i]);
      }

      while (sectionLines.length > 0 && sectionLines[sectionLines.length - 1].trim() === "") {
        sectionLines.pop();
      }

      editor.setLine(lineIndex, sectionLines.join("\n"));
      new Notice(`Expanded: ${noteName}#${headingText}`);
      return true;
    };

    this.addCommand({
      id: "expand-insert-tag",
      name: "Expand Insert Tag at Cursor",
      editorCallback: async (editor) => {
        const expanded = await expandAtLine(editor, editor.getCursor().line);
        if (!expanded) new Notice("No &[[Note#Heading]] tag found on this line.");
      },
    });

    this.addCommand({
      id: "expand-insert-tag-debug",
      name: "Debug: Show Raw Line Text",
      editorCallback: (editor) => {
        const line = editor.getCursor().line;
        const text = editor.getLine(line);
        new Notice(`Line ${line}: "${text}"`, 10000);
      },
    });

    // Intercept Enter in capture phase so we fire before CodeMirror processes it.
    // If the current line matches the tag, expand it and suppress the newline.
    this.registerDomEvent(document, "keydown", async (evt) => {
      if (evt.key !== "Enter") return;
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) return;
      const editor = view.editor;
      const cursor = editor.getCursor();
      if (!editor.getLine(cursor.line).match(/^&\[\[([^\]#]+)#+([^\]]+)\]\]/)) return;
      evt.preventDefault();
      evt.stopPropagation();
      await expandAtLine(editor, cursor.line);
    }, { capture: true });
  }
};

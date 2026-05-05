const { Plugin, Notice } = require("obsidian");

module.exports = class ExpandInsertTagPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: "expand-insert-tag",
      name: "Expand Insert Tag at Cursor",
      editorCallback: async (editor) => {
        const cursor = editor.getCursor();
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return;
        const lineText = editor.getLine(cursor.line);

        // Match &[[Note#Heading]] — note name may contain spaces, heading is required
        const match = lineText.match(/^&\[\[([^\]#]+)#+([^\]]+)\]\]/);

        if (!match) {
          new Notice("No &[[Note#Heading]] tag found on this line.");
          return;
        }

        const [fullMatch, noteName, headingText] = match;
        const errorTag = `<!-- ${fullMatch} — not found -->`;

        // Find the note file in the vault
        const file = this.app.metadataCache.getFirstLinkpathDest(noteName, activeFile.path);

        if (!file) {
          editor.setLine(cursor.line, errorTag);
          new Notice(`Could not find note: "${noteName}"`);
          return;
        }

        const content = await this.app.vault.read(file);
        const lines = content.split("\n");

        // Find the target heading line
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
          editor.setLine(cursor.line, errorTag);
          new Notice(`Could not find heading "#${headingText}" in "${noteName}"`);
          return;
        }

        // Collect lines from the heading down to the next equal-or-higher heading
        const sectionLines = [lines[headingLineIndex]];

        for (let i = headingLineIndex + 1; i < lines.length; i++) {
          const hMatch = lines[i].match(/^(#{1,6})\s+/);
          if (hMatch && hMatch[1].length <= headingLevel) {
            break;
          }
          sectionLines.push(lines[i]);
        }

        // Trim trailing blank lines
        while (sectionLines.length > 0 && sectionLines[sectionLines.length - 1].trim() === "") {
          sectionLines.pop();
        }

        const sectionContent = sectionLines.join("\n");
        editor.setLine(cursor.line, sectionContent);
        new Notice(`Expanded: ${noteName}#${headingText}`);
      },
    });
  }
};

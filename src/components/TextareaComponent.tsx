import React, { useEffect } from 'react';

interface TextareaComponentProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  editorContent: string;
  handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleContextMenu: (e: React.MouseEvent) => void;
  isEditFull: boolean;
  isHorizontal: boolean;
  setEditorContent: (content: string) => void;
  cursorPositionRef: React.RefObject<number>;
}

const formatMarkdownTable = (rows: string[][]): string[] => {
  const colWidths: number[] = [];
  rows.forEach(row => {
    row.forEach((cell, i) => {
      if ((i === 0 && cell === '') || (i === row.length - 1 && cell === '')) return;
      const content = cell.trim();
      const isSeparator = /^[:\-]*-+[:\-]*$/.test(content);
      const width = isSeparator ? 3 : content.length;
      colWidths[i] = Math.max(colWidths[i] || 0, width);
    });
  });

  return rows.map(row => {
    return row.map((cell, i) => {
      if ((i === 0 && cell === '') || (i === row.length - 1 && cell === '')) return '';
      const content = cell.trim();
      const width = colWidths[i] || 0;
      const isSeparator = /^[:\-]*-+[:\-]*$/.test(content);

      if (isSeparator) {
        const left = content.startsWith(':');
        const right = content.endsWith(':');
        // Use width + 2 to match the padding of normal cells (' ' + content + ' ')
        const targetLen = Math.max(3, width + 2);
        let dashes = '-'.repeat(targetLen);
        if (left && right) dashes = ':' + '-'.repeat(Math.max(1, targetLen - 2)) + ':';
        else if (left) dashes = ':' + '-'.repeat(Math.max(2, targetLen - 1));
        else if (right) dashes = '-'.repeat(Math.max(2, targetLen - 1)) + ':';
        return dashes;
      } else {
        return ' ' + content + ' '.repeat(Math.max(0, width - content.length)) + ' ';
      }
    }).join('|');
  });
};

const TextareaComponent: React.FC<TextareaComponentProps> = React.memo(({
  textareaRef,
  editorContent,
  handleChange,
  handleContextMenu,
  isEditFull,
  isHorizontal,
  setEditorContent,
  cursorPositionRef
}) => {
  useEffect(() => {
    if (textareaRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = textareaRef.current;
      const isAtBottom = scrollHeight - scrollTop === clientHeight;
      if (isAtBottom) {
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    }
  }, [editorContent]);

  return (
    <textarea
      id="editor-textarea"
      ref={textareaRef}
      value={editorContent}
      onChange={handleChange}
      onContextMenu={handleContextMenu}
      className={
        isEditFull
          ? 'textarea-horizontal-full'
          : isHorizontal
            ? 'textarea-horizontal'
            : 'textarea-parallel'
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          const target = e.target as HTMLTextAreaElement;
          const { selectionStart, selectionEnd } = target;
          const currentLine = editorContent.substring(
            editorContent.lastIndexOf('\n', selectionStart - 1) + 1,
            selectionStart
          );

          if (currentLine.trim().startsWith('|') && currentLine.trim().endsWith('|') && (currentLine.match(/\|/g) || []).length > 1) {
            e.preventDefault();

            // Find table bounds
            const lines = editorContent.split('\n');
            let lineIndex = 0;
            let currentPos = 0;
            for (let i = 0; i < lines.length; i++) {
              if (currentPos + lines[i].length + 1 > selectionStart) {
                lineIndex = i;
                break;
              }
              currentPos += lines[i].length + 1;
            }

            let startLine = lineIndex;
            while (startLine > 0 && lines[startLine - 1].trim().startsWith('|')) startLine--;

            let endLine = lineIndex;
            while (endLine < lines.length - 1 && lines[endLine + 1].trim().startsWith('|')) endLine++;

            const tableLines = lines.slice(startLine, endLine + 1);

            // Format existing rows + new row together
            // 1. Convert lines to cell arrays (handling the fact they are raw strings)
            // Note: split('|') on "| a |" gives ["", " a ", ""]
            const tableRows = tableLines.map(line => {
              const cells = line.trim().split('|');
              // We know it starts/ends with pipe from loop checks, but careful
              if (line.trim().startsWith('|')) cells.shift();
              if (line.trim().endsWith('|')) cells.pop();
              return cells;
            });

            const maxCols = tableRows.reduce((max, row) => Math.max(max, row.length), 0);

            // 2. Insert new row
            const newRowCells = Array(maxCols).fill('');
            const relativeIndex = lineIndex - startLine;
            // Insert AFTER the current line
            tableRows.splice(relativeIndex + 1, 0, newRowCells);

            // 3. Format everything
            // Restore empty first/last for the helper which expects ["", "a", ""] structure for rendering pipes
            const preparedRows = tableRows.map(row => ['', ...row, '']);
            const formattedTableLines = formatMarkdownTable(preparedRows);

            // Reconstruct full content
            lines.splice(startLine, endLine - startLine + 1, ...formattedTableLines);
            const newValue = lines.join('\n');

            setEditorContent(newValue);
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.value = newValue;
                // Position cursor
                // formattedTableLines now has the new row at [relativeIndex + 1]
                // We want to place cursor in the first cell of that row
                const beforeTable = lines.slice(0, startLine).join('\n');
                const tableBeforeNewRow = formattedTableLines.slice(0, relativeIndex + 1).join('\n');

                // Calculate offset
                const startOfNewRow = (beforeTable.length > 0 ? beforeTable.length + 1 : 0) + tableBeforeNewRow.length + 1;

                // Jump into first cell: pipe + space
                cursorPositionRef.current = startOfNewRow + 2;
                textareaRef.current.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current);
              }
            }, 0);
          } else if (currentLine.startsWith('>>> ') || currentLine.startsWith('> > > ')) {
            e.preventDefault();
            const newValue = editorContent.substring(0, selectionStart) + '   \n>>> ' + editorContent.substring(selectionEnd);
            setEditorContent(newValue);
            setTimeout(() => { if (textareaRef.current) { textareaRef.current.value = newValue; cursorPositionRef.current = selectionStart + 8; textareaRef.current.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current); } }, 0);
          } else if (currentLine.startsWith('>>') || currentLine.startsWith('> >')) {
            e.preventDefault();
            const newValue = editorContent.substring(0, selectionStart) + '   \n>> ' + editorContent.substring(selectionEnd);
            setEditorContent(newValue);
            setTimeout(() => { if (textareaRef.current) { textareaRef.current.value = newValue; cursorPositionRef.current = selectionStart + 7; textareaRef.current.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current); } }, 0);
          } else if (currentLine.startsWith('> ')) {
            e.preventDefault();
            const newValue = editorContent.substring(0, selectionStart) + '   \n> ' + editorContent.substring(selectionEnd);
            setEditorContent(newValue);
            setTimeout(() => { if (textareaRef.current) { textareaRef.current.value = newValue; cursorPositionRef.current = selectionStart + 6; textareaRef.current.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current); } }, 0);
          } else if (currentLine.startsWith('- - - ')) {
            e.preventDefault();
            const newValue = editorContent.substring(0, selectionStart) + '\n- - - ' + editorContent.substring(selectionEnd);
            setEditorContent(newValue);
            setTimeout(() => { if (textareaRef.current) { textareaRef.current.value = newValue; cursorPositionRef.current = selectionStart + 7; textareaRef.current.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current); } }, 0);
          } else if (currentLine.startsWith('- - ')) {
            e.preventDefault();
            const newValue = editorContent.substring(0, selectionStart) + '\n- - ' + editorContent.substring(selectionEnd);
            setEditorContent(newValue);
            setTimeout(() => { if (textareaRef.current) { textareaRef.current.value = newValue; cursorPositionRef.current = selectionStart + 5; textareaRef.current.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current); } }, 0);
          } else if (currentLine.startsWith('- ')) {
            e.preventDefault();
            const newValue = editorContent.substring(0, selectionStart) + '\n- ' + editorContent.substring(selectionEnd);
            setEditorContent(newValue);
            setTimeout(() => { if (textareaRef.current) { textareaRef.current.value = newValue; cursorPositionRef.current = selectionStart + 3; textareaRef.current.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current); } }, 0);
          } else {
            // Standard enter
            e.preventDefault();
            const newValue = editorContent.substring(0, selectionStart) + '\n' + editorContent.substring(selectionEnd);
            setEditorContent(newValue);
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.value = newValue;
                cursorPositionRef.current = selectionStart + 1;
                textareaRef.current.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current);
              }
            }, 0);
          }
        } else if (e.key === '|') {
          const target = e.target as HTMLTextAreaElement;
          const { selectionStart, selectionEnd } = target;
          const currentLine = editorContent.substring(
            editorContent.lastIndexOf('\n', selectionStart - 1) + 1,
            editorContent.indexOf('\n', selectionStart) === -1 ? editorContent.length : editorContent.indexOf('\n', selectionStart)
          );

          if (currentLine.trim().startsWith('|')) {
            e.preventDefault();

            // Count pipes before cursor to restore position
            const preCursorLine = editorContent.substring(editorContent.lastIndexOf('\n', selectionStart - 1) + 1, selectionStart);
            const pipeIndex = (preCursorLine.match(/\|/g) || []).length;

            const lines = editorContent.split('\n');
            let lineIndex = 0;
            let currentPos = 0;
            for (let i = 0; i < lines.length; i++) {
              if (currentPos + lines[i].length + 1 > selectionStart) {
                lineIndex = i;
                break;
              }
              currentPos += lines[i].length + 1;
            }

            // Insert pipe locally first to format table with it
            lines[lineIndex] = lines[lineIndex].substring(0, selectionStart - currentPos) + '|' + lines[lineIndex].substring(selectionStart - currentPos);

            let startLine = lineIndex;
            while (startLine > 0 && lines[startLine - 1].trim().startsWith('|')) startLine--;

            let endLine = lineIndex;
            while (endLine < lines.length - 1 && lines[endLine + 1].trim().startsWith('|')) endLine++;

            const tableLines = lines.slice(startLine, endLine + 1);
            const tableRows = tableLines.map(line => line.split('|'));
            const formattedTableLines = formatMarkdownTable(tableRows);

            lines.splice(startLine, endLine - startLine + 1, ...formattedTableLines);
            const newValue = lines.join('\n');

            setEditorContent(newValue);
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.value = newValue;
                // Restore cursor
                // Find formatted line
                const formattedLine = formattedTableLines[lineIndex - startLine];
                // Find Nth pipe
                let pipesFound = 0;
                let newColIndex = 0;
                for (let i = 0; i < formattedLine.length; i++) {
                  if (formattedLine[i] === '|') {
                    pipesFound++;
                    if (pipesFound === pipeIndex + 1) { // +1 because we inserted one
                      newColIndex = i + 1; // After pipe
                      break;
                    }
                  }
                }

                // Global cursor pos
                const prefix = lines.slice(0, lineIndex).join('\n') + '\n';
                cursorPositionRef.current = prefix.length + newColIndex;
                textareaRef.current.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current);
              }
            }, 0);
          }
        } else if (e.key === 'Tab') {
          e.preventDefault();
          const target = e.target as HTMLTextAreaElement;
          const { selectionStart, selectionEnd } = target;

          const currentLine = editorContent.substring(
            editorContent.lastIndexOf('\n', selectionStart - 1) + 1,
            editorContent.indexOf('\n', selectionStart) === -1 ? editorContent.length : editorContent.indexOf('\n', selectionStart)
          );

          // Check if we are inside a table
          if (currentLine.trim().startsWith('|') && (currentLine.match(/\|/g) || []).length > 1) {
            // Initial simple table navigation: find next pipe after cursor
            const nextPipeIndex = editorContent.indexOf('|', selectionStart);
            const nextNewLineIndex = editorContent.indexOf('\n', selectionStart);

            // If next pipe is on the same line (before next new line or end of string)
            if (nextPipeIndex !== -1 && (nextNewLineIndex === -1 || nextPipeIndex < nextNewLineIndex)) {
              // But wait, if we are at `| cell |`, selectionStart might be inside `cell`. 
              // We want to jump to the start of the NEXT cell content.
              // That means jumping over the next pipe and the spaces.
              // Let's find the position after the next pipe.

              // If we are at the last pipe of the row, next pipe might be on next line (if we searched globally), 
              // but we restricted search to current line implicitly by comparing with nextNewLineIndex.
              // Actually `indexOf` searches globally. `nextPipeIndex < nextNewLineIndex` checks if it is on current line.

              // Current logic check:
              // | cell 1 | cell 2 |
              //        ^ cursor
              // nextPipeIndex is after cell 1.
              // We want to jump to `cell 2`.

              const posAfterPipe = nextPipeIndex + 1;
              // Check character after pipe
              // Usually it is ` ` then content.
              // formatting puts ` ` padding.

              cursorPositionRef.current = posAfterPipe + 1; // Skip pipe and 1 space?
              // Let's be safer. Move to pipe + 1. If it's space, move +1 again?
              // Or just move to pipe + 2 assuming formatted table.

              // However, we need to handle "Last cell".
              // If we are in the last cell `| last |`, the next pipe is the final pipe of the row.
              // Jumping after it puts us outside the table row.
              // User asked "if it is the last cell jump outside the last |" -> Correct.

              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.setSelectionRange(posAfterPipe + 1, posAfterPipe + 1);
                  // If we are strictly formatted, we have `| cell |`.
                  // Jumping to `posAfterPipe + 1` lands on start of text (after 1 space padding).
                  // If it is the last pipe `... |`, `posAfterPipe` is EOL. `+1` is next line.
                  // We need to check if `posAfterPipe` is EOL.
                  if (posAfterPipe >= editorContent.length || editorContent[posAfterPipe] === '\n') {
                    // Actually we want to stay on end of line?
                    // "jump outside the last |" means just after it.
                    textareaRef.current.setSelectionRange(posAfterPipe, posAfterPipe);
                  }
                }
              }, 0);
            } else {
              // No pipe on this line anymore.
              // Try to move to next row first cell? 
              // User said "jump outside the last |".
              // If we strictly follow "jump to next cell", we might want to go to next row start.
              // But "if last cell jump outside line" implies staying on this line.
              // If we are ALREADY outside (after last pipe), maybe then go to next row?
              // Let's implement: If we are inside a cell, go to next cell. If we are in last cell, go outside.
              // If next pipe is < newline, we are not in last cell yet (or we are before the closing pipe).

              // Case 1: Cursor `| ce|ll |` -> Tab -> `| cell | [cursor] ` (next cell)
              // Case 2: Cursor `| last|` -> Tab -> `| last |[cursor]` (outside)

              // My logic above `nextPipeIndex < nextNewLineIndex` handles both if we treat closing pipe as "next pipe".
              // If I am in `| last |`, next pipe is the end pipe. Jumping after it puts me outside. Correct.

              // What if I am already outside? e.g. `| ... |  [cursor]`
              // Then `nextPipeIndex` will be on NEXT line (if any).
              // `nextPipeIndex < nextNewLineIndex` will be FALSE.
              // So we fall here.
              // In this case, let's look for the start of the next row.
              if (nextNewLineIndex !== -1) {
                // Check if next line is a table row
                const nextLineStart = nextNewLineIndex + 1;
                const nextLineEnd = editorContent.indexOf('\n', nextLineStart);
                const nextLine = editorContent.substring(nextLineStart, nextLineEnd === -1 ? editorContent.length : nextLineEnd);

                if (nextLine.trim().startsWith('|')) {
                  // It is a table row. Move to first cell.
                  const firstPipe = editorContent.indexOf('|', nextLineStart);
                  if (firstPipe !== -1) {
                    setTimeout(() => {
                      if (textareaRef.current) {
                        // Jump to first pipe + 2 (padding)
                        textareaRef.current.setSelectionRange(firstPipe + 2, firstPipe + 2);
                      }
                    }, 0);
                  }
                } else {
                  // Next line is not table. Do default tab? Or nothing?
                  // Maybe just insert space as fallback?
                  // Let's default toinserting 4 spaces if we can't navigate table
                  const newValue = editorContent.substring(0, selectionStart) + '    ' + editorContent.substring(selectionEnd);
                  setEditorContent(newValue);
                  setTimeout(() => {
                    if (textareaRef.current) {
                      textareaRef.current.value = newValue;
                      cursorPositionRef.current = selectionStart + 4;
                      textareaRef.current.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current);
                    }
                  }, 0);
                }
              }
            }
          } else {
            // Not in table - insert 4 spaces
            const newValue = editorContent.substring(0, selectionStart) + '    ' + editorContent.substring(selectionEnd);
            setEditorContent(newValue);
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.value = newValue;
                cursorPositionRef.current = selectionStart + 4;
                textareaRef.current.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current);
              }
            }, 0);
          }
        }
      }}
    />
  );
});

export default TextareaComponent;
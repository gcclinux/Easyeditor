import React, { useEffect, useRef } from 'react';

interface ContextMenuProps {
  contextMenu: { visible: boolean; x: number; y: number };
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  editorContent: string;
  setEditorContent: (content: string) => void;
  cursorPositionRef: React.RefObject<number>;
  setContextMenu: (contextMenu: { visible: boolean; x: number; y: number }) => void;
  setCachedSelection: (selection: { start: number; end: number } | null) => void;
  setSelectionStart: (start: number | null) => void;
  setSelectionEnd: (end: number | null) => void;
  cachedSelection: { start: number; end: number } | null;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  contextMenu,
  textareaRef,
  editorContent,
  setEditorContent,
  cursorPositionRef,
  setContextMenu,
  setCachedSelection,
  setSelectionStart,
  setSelectionEnd,
  cachedSelection
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setContextMenu({ visible: false, x: 0, y: 0 });
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setContextMenu({ visible: false, x: 0, y: 0 });
      }
    };

    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu.visible, setContextMenu]);

  return (
    <div
      ref={menuRef}
      className="context-menu-container"
      style={{
        position: 'fixed',
        top: contextMenu.y,
        left: contextMenu.x,
      }}
    >

      {/* Menu entry for Cut */}
      <div
        className="context-menu-item"
        onMouseDown={(e) => {
          e.preventDefault();
          if (textareaRef.current && cachedSelection) {
            const selectedText = editorContent.slice(
              cachedSelection.start,
              cachedSelection.end
            );

            // Copy to clipboard
            navigator.clipboard.writeText(selectedText);

            // Update content by removing selected text
            const newContent =
              editorContent.slice(0, cachedSelection.start) +
              editorContent.slice(cachedSelection.end);

            setEditorContent(newContent);

            // Update cursor position
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(
                  cachedSelection.start,
                  cachedSelection.start
                );
              }
            }, 0);
          }
          setContextMenu({ visible: false, x: 0, y: 0 });
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <span>Cut</span>
          <span style={{ opacity: 0.7 }}>Ctrl+X</span>
        </div>
      </div>

      {/* Menu entry for Copy */}
      <div className="context-menu-item"
        onMouseDown={(e) => {
          e.preventDefault();
          if (textareaRef.current && cachedSelection) {
            const selectedText = editorContent.substring(
              cachedSelection.start,
              cachedSelection.end
            );
            if (selectedText) {
              navigator.clipboard.writeText(selectedText);
            }
          }
          setContextMenu({ visible: false, x: 0, y: 0 });
          textareaRef.current?.focus();
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%'
        }}>
          <span>Copy</span>
          <span style={{ marginLeft: 'auto', opacity: 0.7 }}>Ctrl+C</span>
        </div>
      </div>

      {/* Menu entry for Paste */}
      <div className="context-menu-item"
        onMouseDown={async (e) => {
          e.preventDefault();
          if (textareaRef.current) {
            try {
              const clipText = await navigator.clipboard.readText();
              const start = textareaRef.current.selectionStart;
              const end = textareaRef.current.selectionEnd;
              const newText =
                editorContent.substring(0, start) +
                clipText +
                editorContent.substring(end);
              setEditorContent(newText);
              cursorPositionRef.current = start + clipText.length;
            } catch (err) {
              console.error('Failed to read clipboard:', err);
            }
          }
          setContextMenu({ visible: false, x: 0, y: 0 });
          textareaRef.current?.focus();
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%'
        }}>
          <span>Paste</span>
          <span style={{ marginLeft: 'auto', opacity: 0.7 }}>Ctrl+V</span>
        </div>
      </div>

      {/* Menu entry for Select All */}
      <div
        className="context-menu-item"
        onMouseDown={(e) => {
          e.preventDefault();
          if (textareaRef.current) {
            setCachedSelection({
              start: 0,
              end: editorContent.length
            });
            setSelectionStart(0);
            setSelectionEnd(editorContent.length);

            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(0, editorContent.length);
              }
            }, 0);
          }
          setContextMenu({ visible: false, x: 0, y: 0 });
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%'
        }}>
          <span>SelectAll</span>
          <span style={{ marginLeft: 'auto', opacity: 0.7 }}>Ctrl+A</span>
        </div>
      </div>
    </div>
  );
};

export default ContextMenu;
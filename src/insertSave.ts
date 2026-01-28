// src/mainHandler.ts
import { RefObject, MutableRefObject } from 'react';
import { saveAs } from 'file-saver';



export interface HistoryState {
  content: string;
  cursorPosition: number;
}



// Store file handle for File System Access API (modern browsers)
let currentFileHandle: any = null;

// Check if File System Access API is available
const hasFileSystemAccess = (): boolean => {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
};

// Get the file handle for saving back to the same file
export const getCurrentFileHandle = () => currentFileHandle;

// Clear the file handle (e.g., when creating a new file)
export const clearFileHandle = () => {
  currentFileHandle = null;
};

// Detect if a directory is a Git repository
export const detectGitRepoInDirectory = async (dirHandle: any): Promise<boolean> => {
  if (!dirHandle) return false;

  try {
    // Try to access .git directory
    const gitDir = await dirHandle.getDirectoryHandle('.git', { create: false });
    if (gitDir) {
      console.log('[GitDetection] Found .git directory in:', dirHandle.name);
      return true;
    }
    return false;
  } catch (e) {
    // .git not found
    console.log('[GitDetection] No .git directory found in:', dirHandle.name);
    return false;
  }
};

// Open a directory picker and check if it's a Git repository
export const selectGitRepository = async (): Promise<{ dirHandle: any; isGitRepo: boolean; path: string } | null> => {
  if (!('showDirectoryPicker' in window)) {
    console.log('[GitDetection] showDirectoryPicker not available');
    return null;
  }

  try {
    const dirHandle = await (window as any).showDirectoryPicker({
      mode: 'readwrite'
    });

    const isGitRepo = await detectGitRepoInDirectory(dirHandle);
    const path = dirHandle.name || 'repository';

    console.log('[GitDetection] Selected directory:', path, 'Is Git repo:', isGitRepo);

    return { dirHandle, isGitRepo, path };
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      console.error('[GitDetection] Error selecting directory:', error);
    }
    return null;
  }
};

// Enhanced: Detect if a file is in a Git repository with fallback options
export const detectGitRepo = async (fileHandle: any): Promise<string | null> => {
  if (!fileHandle) return null;

  try {
    // First try: Use getParent() if available (limited browser support)
    let dirHandle = await (fileHandle as any).getParent?.();

    if (dirHandle) {
      // Walk up the directory tree looking for .git folder
      let currentDir = dirHandle;
      let depth = 0;
      const maxDepth = 10;

      while (currentDir && depth < maxDepth) {
        try {
          const gitDir = await currentDir.getDirectoryHandle('.git', { create: false });
          if (gitDir) {
            console.log('[GitDetection] Found .git directory at depth', depth);
            return (currentDir as any).name || 'repository';
          }
        } catch (e) {
          // .git not found, continue
        }

        try {
          const parent = await (currentDir as any).getParent?.();
          if (!parent || parent === currentDir) {
            break;
          }
          currentDir = parent;
          depth++;
        } catch (e) {
          break;
        }
      }

      console.log('[GitDetection] No .git directory found after checking', depth, 'levels');
      return null;
    } else {
      console.log('[GitDetection] getParent() not available - use "Git → Open Repository" for full Git features');
      return null;
    }
  } catch (error) {
    console.error('[GitDetection] Error detecting Git repo:', error);
    return null;
  }
};

// Open a repository directory and then select a file from it
export const handleOpenRepository = async (
  _setEditorContent: (content: string, filePath?: string | null) => void,
  onGitRepoDetected?: (repoPath: string, dirHandle: any) => void,
  onFileListReady?: (files: string[], dirHandle: any) => void
): Promise<void> => {
  // Check if Directory Picker is available
  if (!('showDirectoryPicker' in window)) {
    console.log('[OpenRepository] showDirectoryPicker not available');
    return;
  }

  try {
    // Select directory
    const dirHandle = await (window as any).showDirectoryPicker({
      mode: 'readwrite'
    });

    console.log('[OpenRepository] Selected directory:', dirHandle.name);

    // Check if it's a Git repository
    const isGitRepo = await detectGitRepoInDirectory(dirHandle);

    if (isGitRepo && onGitRepoDetected) {
      console.log('[OpenRepository] Git repository detected');
      await onGitRepoDetected(dirHandle.name, dirHandle);
    }

    // Get list of markdown files
    const files: string[] = [];
    await scanDirectoryForMarkdown(dirHandle, '', files);

    console.log('[OpenRepository] Found', files.length, 'markdown files');

    if (onFileListReady) {
      onFileListReady(files, dirHandle);
    }

  } catch (error: any) {
    if (error.name !== 'AbortError') {
      console.error('[OpenRepository] Error:', error);
    }
  }
};

// Recursively scan directory for markdown files
async function scanDirectoryForMarkdown(dirHandle: any, path: string, files: string[]): Promise<void> {
  try {
    for await (const entry of dirHandle.values()) {
      const entryPath = path ? `${path}/${entry.name}` : entry.name;

      if (entry.kind === 'file') {
        // Check if it's a markdown file
        if (entry.name.endsWith('.md') || entry.name.endsWith('.markdown') || entry.name.endsWith('.txt')) {
          files.push(entryPath);
        }
      } else if (entry.kind === 'directory') {
        // Skip hidden directories and common ignore patterns
        if (!entry.name.startsWith('.') &&
          entry.name !== 'node_modules' &&
          entry.name !== 'dist' &&
          entry.name !== 'build') {
          await scanDirectoryForMarkdown(entry, entryPath, files);
        }
      }
    }
  } catch (error) {
    console.error('[ScanDirectory] Error scanning:', path, error);
  }
}

// Read a file from a directory handle
export const readFileFromDirectory = async (
  dirHandle: any,
  filePath: string
): Promise<{ content: string; fileHandle: any } | null> => {
  try {
    console.log('[ReadFile] Reading file:', filePath);
    console.log('[ReadFile] Directory handle:', dirHandle?.name);

    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, '/');
    const pathParts = normalizedPath.split('/').filter(part => part.length > 0);

    console.log('[ReadFile] Path parts:', pathParts);

    let currentHandle = dirHandle;

    // Navigate to the file through subdirectories
    for (let i = 0; i < pathParts.length - 1; i++) {
      console.log('[ReadFile] Navigating to directory:', pathParts[i]);
      currentHandle = await currentHandle.getDirectoryHandle(pathParts[i], { create: false });
    }

    // Get the file
    const fileName = pathParts[pathParts.length - 1];
    console.log('[ReadFile] Getting file:', fileName);
    const fileHandle = await currentHandle.getFileHandle(fileName, { create: false });
    const file = await fileHandle.getFile();
    const content = await file.text();

    console.log('[ReadFile] Successfully read:', filePath, '- Length:', content.length);
    return { content, fileHandle };
  } catch (error) {
    console.error('[ReadFile] Error reading file:', filePath, error);
    console.error('[ReadFile] Error details:', (error as Error).message);
    return null;
  }
};

// Write a file to a directory handle
export const writeFileToDirectory = async (
  dirHandle: any,
  filePath: string,
  content: string
): Promise<boolean> => {
  try {
    const pathParts = filePath.split('/');
    let currentHandle = dirHandle;

    // Navigate to the directory (create if needed)
    for (let i = 0; i < pathParts.length - 1; i++) {
      try {
        currentHandle = await currentHandle.getDirectoryHandle(pathParts[i]);
      } catch (e) {
        // Directory doesn't exist, create it
        currentHandle = await currentHandle.getDirectoryHandle(pathParts[i], { create: true });
      }
    }

    // Get or create the file
    const fileName = pathParts[pathParts.length - 1];
    const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });

    // Write the content
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    console.log('[WriteFile] Successfully wrote:', filePath);
    return true;
  } catch (error) {
    console.error('[WriteFile] Error writing file:', filePath, error);
    return false;
  }
};

export const handleOpenClick = async (
  setEditorContent: (content: string, filePath?: string | null) => void,
  onGitRepoDetected?: (repoPath: string, fileHandle: any) => void
): Promise<void> => {

  // Modern browsers: Try File System Access API first
  if (hasFileSystemAccess()) {
    try {
      const [fileHandle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'Markdown Files',
            accept: {
              'text/markdown': ['.md', '.markdown'],
              'text/plain': ['.txt']
            }
          }
        ],
        multiple: false
      });

      // Store the file handle for later saving
      currentFileHandle = fileHandle;

      // Read the file
      const file = await fileHandle.getFile();
      const content = await file.text();

      // Get the full path if available (Chromium provides it)
      const filePath = (file as any).path || file.name;

      console.log('[FileSystemAccess] Opened file:', filePath);

      // Try to detect if file is in a Git repository
      const repoPath = await detectGitRepo(fileHandle);
      if (repoPath && onGitRepoDetected) {
        console.log('[FileSystemAccess] Git repository detected:', repoPath);
        // Use the stored directory handle if available
        const dirHandle = (window as any).selectedDirHandle;
        onGitRepoDetected(repoPath, dirHandle || fileHandle);
      }

      setEditorContent(content, filePath);

      return;
    } catch (error: any) {
      // User cancelled or error occurred
      if (error.name !== 'AbortError') {
        console.error('File System Access API error:', error);
      }
      return;
    }
  }

  // Browser fallback: use DOM file input (for older browsers)
  const input = document.createElement("input");
  input.type = "file";
  // Accept common markdown extensions and mime types
  input.accept = ".md,.markdown,text/markdown,application/markdown";
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const contents = e.target?.result;
        if (typeof contents === "string") {
          // In the browser we don't have a real path; pass name only
          setEditorContent(contents, (file as any).path || file.name || null);
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();
};

// Open a plain text (.txt) file and load its contents into the editor
export const handleOpenTxtClick = (
  setEditorContent: (content: string) => void
): void => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".txt,text/plain";
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const contents = e.target?.result;
        if (typeof contents === "string") {
          setEditorContent(contents);
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();
};

// Save to the currently open file (if using File System Access API)
export const saveToCurrentFile = async (editorContent: string): Promise<boolean> => {
  if (!currentFileHandle) {
    return false;
  }

  try {
    // Create a writable stream
    const writable = await currentFileHandle.createWritable();

    // Write the content
    await writable.write(editorContent);

    // Close the file
    await writable.close();

    console.log('[FileSystemAccess] File saved successfully');
    return true;
  } catch (error) {
    console.error('[FileSystemAccess] Failed to save file:', error);
    return false;
  }
};

// Save As with File System Access API (modern browsers)
export const saveAsFile = async (editorContent: string, defaultName: string = "easyeditor.md"): Promise<string | null> => {

  // Modern browsers: Try File System Access API
  if (hasFileSystemAccess()) {
    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: defaultName,
        types: [
          {
            description: 'Markdown Files',
            accept: {
              'text/markdown': ['.md', '.markdown']
            }
          }
        ]
      });

      // Store the new file handle
      currentFileHandle = fileHandle;

      // Write the content
      const writable = await fileHandle.createWritable();
      await writable.write(editorContent);
      await writable.close();

      console.log('[FileSystemAccess] File saved as:', fileHandle.name);
      return fileHandle.name;
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('[FileSystemAccess] Save As error:', error);
      }
      return null;
    }
  }

  // Fallback: use file-saver
  const blob = new Blob([editorContent], { type: "text/markdown;charset=utf-8" });
  saveAs(blob, defaultName);
  return null; // Cannot track path with file-saver
};

export const saveToFile = async (editorContent: string, setCurrentFilePath?: (path: string) => void): Promise<void> => {
  console.log('saveToFile called with content length:', editorContent.length);

  // Try File System Access API first (modern browsers)
  if (hasFileSystemAccess()) {
    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: 'easyeditor.md',
        types: [
          {
            description: 'Markdown Files',
            accept: {
              'text/markdown': ['.md', '.markdown']
            }
          }
        ]
      });

      const writable = await fileHandle.createWritable();
      await writable.write(editorContent);
      await writable.close();

      // Store the file handle for future saves
      currentFileHandle = fileHandle;

      // Set the current file path if callback provided
      if (setCurrentFilePath) {
        setCurrentFilePath(fileHandle.name);
      }

      console.log('File saved successfully via File System Access API');
      return;
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('File System Access API error:', error);
      }
      // Fall through to file-saver fallback
    }
  }

  // Fallback: use file-saver (downloads to default folder)
  try {
    const blob = new Blob([editorContent], { type: "text/markdown;charset=utf-8" });
    console.log('Blob created successfully');
    saveAs(blob, "easyeditor.md");
    console.log('saveAs called successfully');
  } catch (error) {
    console.error('Error in saveToFile:', error);
  }
};

export const saveToTxT = async (editorContent: string): Promise<void> => {
  const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

  if (isTauri) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');

      const filePath = await save({
        defaultPath: 'easyeditor.txt',
        filters: [{
          name: 'Text Document',
          extensions: ['txt']
        }]
      });

      if (filePath) {
        await writeTextFile(filePath, editorContent);
        console.log('TXT saved successfully to:', filePath);
      }
    } catch (tauriError) {
      console.error('Tauri save failed:', tauriError);
      // Fallback or alert
      const blob = new Blob([editorContent], { type: "text/plain;charset=utf-8" });
      saveAs(blob, "easyeditor.txt");
    }
  } else {
    const blob = new Blob([editorContent], { type: "text/plain;charset=utf-8" });
    saveAs(blob, "easyeditor.txt");
  }
};

export interface MainHandlerProps {
  textareaRef: RefObject<HTMLTextAreaElement>;
  documentHistory: HistoryState[];
  historyIndex: number;
  setHistoryIndex: (index: number) => void;
  setDocumentHistory: (history: HistoryState[]) => void;
  editorContent: string;
  setEditorContent: (content: string) => void;
  cursorPositionRef: MutableRefObject<number>; // Updated type
}

export const addToHistory = (
  content: string,
  cursorPos: number,
  documentHistory: HistoryState[],
  historyIndex: number,
  setDocumentHistory: (history: HistoryState[]) => void,
  setHistoryIndex: (index: number) => void
): void => {
  const newHistory = Array.isArray(documentHistory) ? documentHistory.slice(0, historyIndex + 1) : [];
  setDocumentHistory([...newHistory, { content, cursorPosition: cursorPos }]);
  setHistoryIndex(newHistory.length);
};

export const handleUndo = (
  historyIndex: number,
  documentHistory: HistoryState[],
  setHistoryIndex: (index: number) => void,
  setEditorContent: (content: string) => void,
  cursorPositionRef: MutableRefObject<number> // Updated type
): void => {
  if (historyIndex > 0) {
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    const { content, cursorPosition } = documentHistory[newIndex];
    setEditorContent(content);
    cursorPositionRef.current = cursorPosition;
  }
};

export const handleClear = (
  setEditorContent: (content: string) => void
): void => {
  setEditorContent("");
};

export const handleRedo = (
  historyIndex: number,
  documentHistory: HistoryState[],
  setHistoryIndex: (index: number) => void,
  setEditorContent: (content: string) => void,
  cursorPositionRef: MutableRefObject<number> // Updated type
): void => {
  if (historyIndex < documentHistory.length - 1) {
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    const { content, cursorPosition } = documentHistory[newIndex];
    setEditorContent(content);
    cursorPositionRef.current = cursorPosition;
  }
};
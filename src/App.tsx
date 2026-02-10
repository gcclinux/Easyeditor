import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  FaUndo,
  FaRedo,
  FaExchangeAlt,
  FaFileImport,
  FaTable,
  FaLink,
  FaImage,
  FaStickyNote,
  FaDownload,
  FaCodeBranch
} from 'react-icons/fa';
import { VscSymbolKeyword } from "react-icons/vsc";
import { GoTasklist } from "react-icons/go";
import { GrDocumentText } from "react-icons/gr";
import { AiOutlineLayout } from "react-icons/ai";
import { SiMermaid } from "react-icons/si";
import { CgFormatText, CgFormatHeading } from "react-icons/cg";
import { MdAutoAwesome, MdOutlineInsertChartOutlined } from "react-icons/md";

import mermaid from 'mermaid';
import debounce from 'lodash.debounce';
import './App.css';
import { saveAsPDF } from './saveAsPDF.tsx';
import { saveAsPNG } from './saveAsPNG.ts';
import {
  insertClassSyntax,
  insertGanttSyntax,
  insertGraphTDSyntax,
  insertFlowchartRLSyntax,
  insertJourneySyntax,
  inserterBlockSyntax,
  inserterGitSyntax,
  insertTimeLineSyntax,
  insertererDiagramSyntax
} from './insertMermaid.ts';
import {
  insertUMLClassDiagram,
  insertUMLSequenceDiagram,
  insertUMLUseCaseDiagram,
  insertUMLActivityDiagram,
  insertUMLComponentDiagram,
  insertUMLStateDiagram
} from './insertUML.ts';
import { insertUMLProcessOfEliminationDiagram } from './templates/processEliminationUML.ts';
import { insertUMLDatabaseReplicationDiagram } from './templates/databaseReplicationUML.ts';
import { insertUMLLLMTrainingDiagram } from './templates/llmTrainingUML.ts';
import { TableGenerator } from './autoGenerator/TableGenerator.tsx';
import { GanttGenerator } from './autoGenerator/GanttGenerator.tsx';
import { TimelineGenerator } from './autoGenerator/TimelineGenerator.tsx';
import ContextMenu from './autoGenerator/ContextMenu.tsx';
import {
  HistoryState,
  addToHistory,
  handleUndo,
  handleClear,
  handleRedo,
  handleOpenClick,
  handleOpenTxtClick,
  saveToFile,
  saveToTxT,
  saveAsFile,
  writeFileToDirectory
} from './insertSave.ts';
import {
  insertBoldSyntax,
  inserth1Syntax,
  inserth2Syntax,
  inserth3Syntax,
  inserth4Syntax,
  inserth5Syntax,
  inserth6Syntax,
  insertCodeSyntax,
  insertRulerSyntax,
  insertItalicSyntax,
  insertList1Syntax,
  insertList2Syntax,
  insertIndent1Syntax,
  insertIndent2Syntax,
  insertNewLineSyntax,
  insertBlockquoteSyntax,
  insertStrikethroughSyntax
} from './insertMarkdown.ts';
import TextareaComponent from './components/TextareaComponent.tsx';
import PreviewComponent from './components/PreviewComponent.tsx';
import HeadersModal from './components/HeadersModal';
import FormattingModal from './components/FormattingModal';
import MermaidModal from './components/MermaidModal';
import UMLModal from './components/UMLModal';
import InsertModal from './components/InsertModal';
import ImagesModal from './components/ImagesModal';
import LinksModal from './components/LinksModal';
import TablesModal from './components/TablesModal';
import FootnoteModal from './components/FootnoteModal';
import SymbolsModal from './components/SymbolsModal';
import IconsModal from './components/IconsModal';
import AutoModal from './components/AutoModal';
import GitModal from './components/GitModal';
import TemplatesModal from './components/TemplatesModal';
import AboutModal from './components/AboutModal';
import EasyNotesSidebar from './components/EasyNotesSidebar';
import FeaturesModal from './components/FeaturesModal';
import ThemeModal from './components/ThemeModal';
import ImportThemeModal from './components/ImportThemeModal';

import { encryptContent, decryptFile } from './cryptoHandler';
import PasswordModal from './components/PasswordModal';
import { loadTheme, getCurrentTheme } from './themeLoader';
import { saveCustomTheme } from './customThemeManager';
import CloneModal from './components/CloneModal';
import ImportMDModal from './components/ImportMDModal';
import FileBrowserModal from './components/FileBrowserModal';
import GitCredentialsModal from './components/GitCredentialsModal';
import MasterPasswordModal from './components/MasterPasswordModal';
import CommitModal from './components/CommitModal';
import FileModal from './components/FileModal';
import TaskModal from './components/TaskModal';
import ExportModal from './components/ExportModal';
import GitHistoryModal from './components/GitHistoryModal';
import GitStatusIndicator from './components/GitStatusIndicator';
import { getGitManager } from './gitManagerWrapper';
import { gitCredentialManager } from './gitCredentialManager';
import ToastContainer from './components/ToastContainer';
import { isFeatureEnabled } from './config/features';
import { useLanguage } from './i18n/LanguageContext';
import LanguageModal from './components/LanguageModal';
import LicenseManager from './premium/LicenseManager';
import UpdateModal from './components/UpdateModal';
import { getRunningVersion, getAvailableVersion, compareVersions } from './utils/version';

const App = () => {
  const { t, isLoading } = useLanguage();
  const [documentHistory, setDocumentHistory] = useState<HistoryState[]>([]);

  // Listen for license updates to enable premium features dynamically
  const [, setLicenseUpdate] = useState(0);
  useEffect(() => {
    return LicenseManager.subscribe(() => {
      setLicenseUpdate(prev => prev + 1);
    });
  }, []);

  // Update Modal state
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [runVersion, setRunVersion] = useState('');
  const [availVersion, setAvailVersion] = useState('');

  useEffect(() => {
    const checkUpdate = async () => {
      const current = await getRunningVersion();
      setRunVersion(current);

      const availableInfo = await getAvailableVersion();
      const available = availableInfo.version;
      setAvailVersion(available);

      if (current && available && current !== 'unknown' && available !== 'unknown') {
        if (compareVersions(current, available) < 0) {
          setUpdateModalOpen(true);
        }
      }
    };

    checkUpdate();
  }, []);
  const [editorContent, setEditorContent] = useState<string>('');
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isHorizontal, setIsHorizontal] = useState<boolean>(false);
  const previewRef = useRef<HTMLDivElement>(null!);
  const [gitManager, setGitManager] = useState<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null!);
  const cursorPositionRef = useRef<number>(0);
  // Ref to hold the latest file opening function to avoid stale closures
  const handleOpenFileRef = useRef<((path: string) => void) | null>(null);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [ganttModalOpen, setGanttModalOpen] = useState(false);
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [showHeaderModal, setShowHeaderModal] = useState(false);
  const [showFormattingModal, setShowFormattingModal] = useState(false);
  const [showMermaidModal, setShowMermaidModal] = useState(false);
  const [showUMLModal, setShowUMLModal] = useState(false);
  const [showSymbolsModal, setShowSymbolsModal] = useState(false);
  const [showIconsModal, setShowIconsModal] = useState(false);
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [showLinksModal, setShowLinksModal] = useState(false);
  const [showTablesModal, setShowTablesModal] = useState(false);
  const [showFootnoteModal, setShowFootnoteModal] = useState(false);
  const [showInsertModal, setShowInsertModal] = useState(false);
  const [showImagesModal, setShowImagesModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [importThemeOpen, setImportThemeOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(getCurrentTheme());

  const handleImportTheme = (name: string, description: string, css: string) => {
    const id = name.toLowerCase().replace(/\s+/g, '-');
    saveCustomTheme({ id, name, description, css });
    loadTheme(id, true);
    setCurrentTheme(id);
  };
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showGitModal, setShowGitModal] = useState(false);
  const [showEasyNotesSidebar, setShowEasyNotesSidebar] = useState(false);
  const easyNotesButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isEditFull, setIsEditFull] = useState<boolean>(false);
  const [isPreviewFull, setIsPreviewFull] = useState<boolean>(false);

  const [passwordModalConfig, setPasswordModalConfig] = useState<{
    open: boolean;
    title: string;
    promptText: string;
    onSubmit: (password: string) => void;
  }>({
    open: false,
    title: '',
    promptText: '',
    onSubmit: () => { },
  });
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [importMDModalOpen, setImportMDModalOpen] = useState(false);
  const [fileBrowserModalOpen, setFileBrowserModalOpen] = useState(false);
  const [repoFiles, setRepoFiles] = useState<string[]>([]);
  const [currentRepoPath, setCurrentRepoPath] = useState<string | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [pendingFileToOpen, setPendingFileToOpen] = useState<string | null>(null);
  const [isGitRepo, setIsGitRepo] = useState(false);

  // Cloud note state
  const [currentCloudNote, setCurrentCloudNote] = useState<{
    noteId: string;
    title: string;
    provider: string;
    providerDisplayName: string;
    providerIcon: string;
    lastSaved: Date;
    hasUnsavedChanges: boolean;
  } | null>(null);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [masterPasswordModalOpen, setMasterPasswordModalOpen] = useState(false);
  const [isMasterPasswordSetup, setIsMasterPasswordSetup] = useState(false);
  const [hasStoredCredentials, setHasStoredCredentials] = useState(gitCredentialManager.hasCredentials());
  const [pendingCredentialAction, setPendingCredentialAction] = useState<(() => void) | null>(null);
  const [prefillCredentials, setPrefillCredentials] = useState<{ username: string; token: string } | null>(null);
  const [currentDirHandle, setCurrentDirHandle] = useState<any>(null); // For web File System Access API
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    onConfirm: () => { },
  });

  // Phase 4: Enhanced Git features
  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [gitHistoryModalOpen, setGitHistoryModalOpen] = useState(false);
  const [gitStatus, setGitStatus] = useState<{ branch: string; modifiedCount: number; status: 'clean' | 'modified' | 'conflict' }>({
    branch: '',
    modifiedCount: 0,
    status: 'clean'
  });
  const [commitHistory, setCommitHistory] = useState<any[]>([]);
  const [modifiedFiles, setModifiedFiles] = useState<string[]>([]);

  // Toast notifications
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'info' | 'warning' }>>([]);
  const toastIdCounter = useRef(0);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = toastIdCounter.current++;
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Initialize git manager based on environment
  useEffect(() => {
    getGitManager().then(manager => {
      setGitManager(manager);
    });
  }, []);

  // Web-only mode - no Electron detection needed
  useEffect(() => {
    // Always web mode
  }, []);

  // Check for saved credentials on startup
  useEffect(() => {
    const checkCredentials = () => {
      const hasCredentials = gitCredentialManager.hasCredentials();
      const isUnlocked = gitCredentialManager.isUnlocked();

      if (hasCredentials && !isUnlocked) {
        console.log('[App] Saved credentials found but locked. User will be prompted when needed.');
      }
    };

    // Check for saved repository directory
    const checkRepo = () => {
      if (!gitManager) return;
      const savedRepoDir = gitManager.getRepoDir();
      if (savedRepoDir) {
        console.log('[App] Restored repository from session:', savedRepoDir);
        setIsGitRepo(true);
        setCurrentRepoPath(savedRepoDir);
      }
    };

    checkCredentials();
    checkRepo();
  }, [gitManager]);

  // Selection state fixing the issue with the Headers selection
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const cacheSelection = () => {
    if (textareaRef.current) {
      setSelectionStart(textareaRef.current.selectionStart);
      setSelectionEnd(textareaRef.current.selectionEnd);
    }
  };

  // Add these state declarations near your other states
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number }>({
    visible: false,
    x: 0,
    y: 0
  });

  // Add state for cached selection
  const [cachedSelection, setCachedSelection] = useState<{ start: number, end: number } | null>(null);

  // Add this handler function
  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    if (textareaRef.current) {
      setCachedSelection({
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd
      });
    }
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY
    });
    textareaRef.current?.focus(); // Ensure textarea remains focused
  };

  // Function to close all dropdowns
  const closeAllDropdowns = () => {
    // setShowHeaderModal(false); // Modals don't need to be closed by this fn usually, or if they do, use the new name.
    // However, existing modals like FileModal are NOT closed here. So I will just remove the line.


    // setShowMermaidDropdown(false); // Removed




    // setShowHelpDropdown(false); // Removed
    // setHelpPos(null); // Removed

    // Note: Git modal and EasyNotes sidebar are independent and don't close with other dropdowns
  };

  // Click-away listener to close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Check if click is outside dropdown containers and dropdown content
      const isDropdownButton = target.closest('.dropdown-container, .menu-item, .fixed-menubar-btn, .button-mermaid');
      const isDropdownContent = target.closest('.format-dropdown');

      // If clicking outside both the button and dropdown content, close all
      if (!isDropdownButton && !isDropdownContent) {
        closeAllDropdowns();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Add this effect to handle clicking outside
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
        setContextMenu({ visible: false, x: 0, y: 0 });
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleClosePasswordModal = () => {
    setPasswordModalConfig({ ...passwordModalConfig, open: false });
  };

  const showPasswordPrompt = (
    title: string,
    promptText: string,
    onSubmit: (password: string) => void
  ) => {
    setPasswordModalConfig({
      open: true,
      title,
      promptText,
      onSubmit: (password) => {
        onSubmit(password);
        handleClosePasswordModal();
      },
    });
  };



  // Initialize Mermaid diagrams
  const initializeMermaid = useCallback(
    debounce(() => {
      if (previewRef.current) {
        mermaid.initialize({
          startOnLoad: true,
          theme: 'default',
        });
        const mermaidElements = previewRef.current.querySelectorAll('.mermaid');
        mermaidElements.forEach((element) => {
          mermaid.init(undefined, element as HTMLElement);
        });
      }
    }, 300),
    []
  );

  // Add event listener for Mermaid diagram rendering
  useEffect(() => {
    initializeMermaid();
  }, [editorContent, initializeMermaid]);

  // Add keyboard event handler for Ctrl+S
  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      // Ctrl+S or Cmd+S
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        await handleUniversalSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isGitRepo, currentFilePath, editorContent, currentRepoPath, currentCloudNote]);

  // Update document title with current filename
  useEffect(() => {
    const updateTitle = () => {
      let title = 'EasyEditor';

      // Priority 1: Cloud note title
      if (currentCloudNote) {
        const unsavedIndicator = currentCloudNote.hasUnsavedChanges ? '• ' : '';
        title = `${unsavedIndicator}${currentCloudNote.title} - EasyEditor`;
      }
      // Priority 2: Local/Git file path
      else if (currentFilePath) {
        // Extract filename from path (works for both Windows and Unix paths)
        const filename = currentFilePath.split(/[/\\]/).pop() || currentFilePath;
        title = `${filename} - EasyEditor`;
      }

      // Update document title (works for both web and Tauri)
      document.title = title;

      // For Tauri, also update the window title
      if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
        (async () => {
          try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const appWindow = getCurrentWindow();
            await appWindow.setTitle(title);
          } catch (error) {
            console.error('Failed to set Tauri window title:', error);
          }
        })();
      }
    };

    updateTitle();
  }, [currentFilePath, currentCloudNote]);

  // Handle change function for the textarea
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    cursorPositionRef.current = e.target.selectionStart;
    setEditorContent(e.target.value);

    // Track changes for cloud notes
    if (currentCloudNote && !currentCloudNote.hasUnsavedChanges) {
      setCurrentCloudNote(prev => prev ? { ...prev, hasUnsavedChanges: true } : null);
    }
  };



  // Handle file opening from command line arguments (Tauri)
  useEffect(() => {
    const setupTauriEventListeners = async () => {
      try {
        // Check if running in Tauri
        const isTauri = typeof window !== 'undefined' &&
          ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__ ||
            typeof (window as any).__TAURI_INVOKE__ === 'function');

        if (isTauri) {
          console.log('Setting up Tauri event listeners...');

          // Import Tauri event listener
          const { listen } = await import('@tauri-apps/api/event');

          // Listen for file open events from command line
          const unlisten = await listen('open-file', (event) => {
            console.log('Received open-file event:', event.payload);
            const filePath = event.payload as string;

            // Open the file
            if (handleOpenFileRef.current) {
              handleOpenFileRef.current(filePath);
            }
          });

          // Check for command line arguments on startup
          const { invoke } = await import('@tauri-apps/api/core');
          try {
            const filePath = await invoke('open_file_from_args');
            if (filePath) {
              console.log('Opening file from command line args:', filePath);
              if (handleOpenFileRef.current) {
                handleOpenFileRef.current(filePath as string);
              }
            }
          } catch (error) {
            console.log('No file specified in command line args');
          }

          // Cleanup function
          return () => {
            unlisten();
          };
        } else {
          console.log('Running in web mode');
        }
      } catch (error) {
        console.error('Failed to setup Tauri event listeners:', error);
      }
    };

    setupTauriEventListeners();
  }, []);

  // Restore cursor position effect
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current);
      textareaRef.current.focus();
    }
  }, [editorContent]);

  // toggleView function - cycles through three view modes
  const toggleView = () => {
    if (!isEditFull && !isPreviewFull) {
      // Currently in split view -> go to full edit
      setIsEditFull(true);
      setIsPreviewFull(false);
    } else if (isEditFull && !isPreviewFull) {
      // Currently in full edit -> go to full preview
      setIsEditFull(false);
      setIsPreviewFull(true);
    } else if (!isEditFull && isPreviewFull) {
      // Currently in full preview -> go back to split view
      setIsEditFull(false);
      setIsPreviewFull(false);
      setIsHorizontal(false);
    }
  };

  // Get current view mode for button text
  const getCurrentViewMode = () => {
    if (isEditFull && !isPreviewFull) {
      return t('menu.view_edit');
    }
    if (!isEditFull && isPreviewFull) {
      return t('menu.view_preview');
    }
    return t('menu.view_split');
  };

  // insertSymbol function inserts a symbol into the textarea
  const insertSymbol = (symbol: string) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText =
        editorContent.substring(0, start) +
        symbol +
        editorContent.substring(end);

      setEditorContent(newText);
      cursorPositionRef.current = start + symbol.length; // Update cursor position ref

      setTimeout(() => {
        textarea.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current);
        textarea.focus();
      }, 0);
    }
  };

  // Templates moved to src/templates/*.ts


  // insertSymbol function inserts a symbol into the textarea

  // insertIcon inserts an emoji/icon into the editor
  const insertIcon = (icon: string) => insertSymbol(icon);

  //TODO
  // insertBoldSyntax function inserts a bold syntax for Markdown
  const handleBoldSyntax = () => {
    insertBoldSyntax(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  // insertNewLineSyntax function inserts a new line syntax for Markdown
  const handleNewLineSyntax = () => {
    insertNewLineSyntax(textareaRef, editorContent, setEditorContent);
  };

  // insertItalicSyntax function inserts an italic syntax for Markdown
  const handlerItalicSyntax = () => {
    insertItalicSyntax(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  // insertStrikethroughSyntax function inserts a strikethrough syntax for Markdown
  const handlerStrikethroughSyntax = () => {
    insertStrikethroughSyntax(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  //TODO
  // inserth1Syntax function inserts a h1 syntax for Markdown
  const handlerinserth1Syntax = () => {
    if (selectionStart !== null && selectionEnd !== null) {
      inserth1Syntax(textareaRef, editorContent, setEditorContent, cursorPositionRef, selectionStart, selectionEnd);
    }
  };

  // inserth2Syntax function inserts a h2 syntax for Markdown
  const handlerinserth2Syntax = () => {
    if (selectionStart !== null && selectionEnd !== null) {
      inserth2Syntax(textareaRef, editorContent, setEditorContent, cursorPositionRef, selectionStart, selectionEnd);
    }
  };

  // inserth3Syntax function inserts a h3 syntax for Markdown
  const handlerinserth3Syntax = () => {
    if (selectionStart !== null && selectionEnd !== null) {
      inserth3Syntax(textareaRef, editorContent, setEditorContent, cursorPositionRef, selectionStart, selectionEnd);
    }
  };

  // inserth4Syntax function inserts a h4 syntax for Markdown
  const handlerinserth4Syntax = () => {
    if (selectionStart !== null && selectionEnd !== null) {
      inserth4Syntax(textareaRef, editorContent, setEditorContent, cursorPositionRef, selectionStart, selectionEnd);
    }
  };

  // inserth5Syntax function inserts a h5 syntax for Markdown
  const handlerinserth5Syntax = () => {
    if (selectionStart !== null && selectionEnd !== null) {
      inserth5Syntax(textareaRef, editorContent, setEditorContent, cursorPositionRef, selectionStart, selectionEnd);
    }
  };

  // inserth6Syntax function inserts a h6 syntax for Markdown
  const handlerinserth6Syntax = () => {
    if (selectionStart !== null && selectionEnd !== null) {
      inserth6Syntax(textareaRef, editorContent, setEditorContent, cursorPositionRef, selectionStart, selectionEnd);
    }
  };

  // insertRulerSyntax function inserts a ruler syntax for Markdown
  const handlerinsertRulerSyntax = () => {
    insertRulerSyntax(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  // insertCodeSyntax function inserts a code syntax for Markdown
  const handlerinsertCodeSyntax = () => {
    insertCodeSyntax(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  // insertBlockquoteSyntax function inserts a blockquote syntax for Markdown
  const handlerinsertBlockCodeSyntax = () => {
    insertBlockquoteSyntax(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  // insertIndent1Syntax function inserts an indent1 syntax for Markdown
  const handlerinsertIndent1Syntax = () => {
    insertIndent1Syntax(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  // insertIndent2Syntax function inserts an indent2 syntax for Markdown
  const handlerinsertIndent2Syntax = () => {
    insertIndent2Syntax(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  // insertList1Syntax function inserts a list2 syntax for Markdown
  const handlerinsertList1Syntax = () => {
    insertList1Syntax(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  // insertList2Syntax function inserts a list2 syntax for Markdown
  const handlerinsertList2Syntax = () => {
    insertList2Syntax(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  // insertImageSyntax function inserts a default and extended image syntax for Markdown


  // Insert an arbitrary image/link markdown template into the editor
  const handleInsertImageTemplate = (markdownTemplate: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText =
      editorContent.substring(0, start) +
      markdownTemplate +
      editorContent.substring(end);

    setEditorContent(newText);
    cursorPositionRef.current = start + markdownTemplate.length; // Update cursor position ref

    setTimeout(() => {
      textarea.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current);
      textarea.focus();
    }, 0);
  };







  // insertFootSyntax function inserts a default and extended foot syntax for Markdown


  // Insert Mermaid classDiagram Syntax
  const handleInsertClass = () => {
    insertClassSyntax(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  // Insert Mermaid GanttDiagram Syntax
  const handleGanttInsert = () => {
    insertGanttSyntax(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  // Insert Mermaid GraphTD Syntax
  const handleGraphTDInsert = () => {
    insertGraphTDSyntax(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  // Insert Mermaid FlowchartRL Syntax example
  const handleFlowchartRLInsert = () => {
    insertFlowchartRLSyntax(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  // Insert Mermaid Journey Syntax
  const handleJourneyInsert = () => {
    insertJourneySyntax(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  // Insert Mermaid Block example Syntax
  const handleBlockInsert = () => {
    inserterBlockSyntax(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  // Insert Mermaid GitGraph Syntax
  const handleGitInsert = () => {
    inserterGitSyntax(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  // Insert Mermaid erDiagram Syntax
  const handleErDiagramInsert = () => {
    insertererDiagramSyntax(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  //
  const handleTimeLineSyntax = () => {
    insertTimeLineSyntax(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  }

  // UML Diagram Handlers
  const handleUMLClassDiagram = () => {
    insertUMLClassDiagram(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  const handleUMLSequenceDiagram = () => {
    insertUMLSequenceDiagram(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  const handleUMLUseCaseDiagram = () => {
    insertUMLUseCaseDiagram(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  const handleUMLActivityDiagram = () => {
    insertUMLActivityDiagram(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  const handleUMLComponentDiagram = () => {
    insertUMLComponentDiagram(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  const handleUMLStateDiagram = () => {
    insertUMLStateDiagram(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  // Credential management handlers
  const handleSetupCredentials = () => {
    if (!gitCredentialManager.hasMasterPassword()) {
      // Need to create master password first
      setIsMasterPasswordSetup(true);
      setMasterPasswordModalOpen(true);
    } else if (!gitCredentialManager.isUnlocked()) {
      // Need to unlock with master password
      setIsMasterPasswordSetup(false);
      setPendingCredentialAction(() => async () => {
        try {
          const creds = await gitCredentialManager.getCredentials();
          if (creds) {
            setPrefillCredentials({ username: creds.username, token: creds.token });
          }
        } catch (e) {
          console.error('Failed to load credentials for prefill:', e);
        }
        setCredentialsModalOpen(true);
      });
      setMasterPasswordModalOpen(true);
    } else {
      // Already unlocked, show credentials modal
      (async () => {
        try {
          const creds = await gitCredentialManager.getCredentials();
          if (creds) {
            setPrefillCredentials({ username: creds.username, token: creds.token });
          }
        } catch (e) {
          console.error('Failed to load credentials for prefill:', e);
        }
        setCredentialsModalOpen(true);
      })();
    }
  };

  const handleMasterPasswordSubmit = async (password: string) => {
    setMasterPasswordModalOpen(false);

    try {
      if (isMasterPasswordSetup) {
        // Creating new master password
        await gitCredentialManager.setMasterPassword(password);
        showToast('Master password created successfully!', 'success');
        setCredentialsModalOpen(true);
      } else {
        // Unlocking with existing master password
        const unlocked = await gitCredentialManager.unlock(password);
        if (unlocked) {
          showToast('Credentials unlocked! Stored credentials will work until you close the browser.', 'success');
          if (pendingCredentialAction) {
            pendingCredentialAction();
            setPendingCredentialAction(null);
          }
        } else {
          showToast('Invalid password. Please try again.', 'error');
        }
      }
    } catch (error) {
      showToast(`Error: ${(error as Error).message}`, 'error');
    }
  };

  const handleCredentialsSubmit = async (username: string, token: string, rememberMe: boolean) => {
    setCredentialsModalOpen(false);
    setPrefillCredentials(null);

    try {
      const credentials = { username, token };

      // Set credentials in gitManager for immediate use
      gitManager.setCredentials(credentials);

      if (rememberMe) {
        // Save encrypted credentials
        await gitCredentialManager.saveCredentials(credentials, true);
        setHasStoredCredentials(true);
        showToast('Credentials saved securely!', 'success');
      } else {
        showToast('Credentials set for this session only.', 'info');
      }
    } catch (error) {
      showToast(`Failed to save credentials: ${(error as Error).message}`, 'error');
    }
  };

  const handleClearCredentials = async () => {
    setConfirmModalConfig({
      open: true,
      title: 'Clear Saved Credentials',
      message: 'Are you sure you want to clear saved credentials? You will need to enter them again.',
      confirmLabel: 'Clear Credentials',
      cancelLabel: 'Cancel',
      onConfirm: async () => {
        try {
          await gitCredentialManager.clearCredentials();
          if (gitManager) {
            gitManager.clearCredentials();
          }
          setHasStoredCredentials(false);
          showToast('Credentials cleared successfully.', 'success');
        } catch (error) {
          showToast(`Failed to clear credentials: ${(error as Error).message}`, 'error');
        }
      },
    });
  };

  const ensureCredentials = async (action: () => Promise<void>) => {
    if (!gitManager) {
      showToast('Git manager not initialized yet. Please wait.', 'info');
      return false;
    }

    // Check if we have stored credentials
    if (!gitCredentialManager.hasCredentials()) {
      // No stored credentials, prompt user to set them up
      setPendingCredentialAction(() => action);
      handleSetupCredentials();
      return false;
    }

    // Check if credential manager is unlocked
    if (!gitCredentialManager.isUnlocked()) {
      // Credentials exist but need to unlock with master password via modal
      setPendingCredentialAction(() => action);
      setIsMasterPasswordSetup(false);
      setMasterPasswordModalOpen(true);
      return false;
    }

    // Try to load stored credentials
    const loaded = await gitManager.loadStoredCredentials();

    if (!loaded) {
      showToast('Failed to load credentials. Please set up credentials again.', 'error');
      setPendingCredentialAction(() => action);
      handleSetupCredentials();
      return false;
    }

    return true;
  };

  // Git operation handlers
  const handleGitClone = () => {
    setCloneModalOpen(true);
  };

  const handleImportMDSubmit = async (url: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      setEditorContent(text);
      setImportMDModalOpen(false);
      showToast(t('toasts.import_success') || 'Successfully imported Markdown', 'success');
    } catch (error) {
      console.error("Import error", error);
      showToast(`${t('toasts.import_error') || 'Failed to import'}: ${error}`, 'error');
    }
  };

  const handleCloneSubmit = async (url: string, targetDir: string, branch?: string) => {
    setCloneModalOpen(false);

    console.log('=== Clone Submit Handler ===');
    console.log('URL:', url);
    console.log('Target Dir:', targetDir);
    console.log('Branch:', branch);

    // Helper function to perform the actual clone
    const performClone = async () => {
      if (!gitManager) {
        showToast('Git manager not initialized yet. Please wait.', 'error');
        return;
      }

      try {
        // Show loading state
        showToast('Cloning repository... This may take a moment.', 'info');

        const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__;

        if (isTauri) {
          // Tauri mode: targetDir is the full path
          console.log('Using Tauri mode for clone');
        } else {
          // Web mode: Check if we're using web File System Access API
          const dirHandle = (window as any).selectedDirHandle;
          console.log('Dir handle available:', !!dirHandle);

          if (dirHandle) {
            setCurrentDirHandle(dirHandle);
            gitManager.setDirHandle(dirHandle);
            console.log('Dir handle set in gitManager');
          }
        }

        // Perform clone operation
        console.log('Calling gitManager.clone()...');
        await gitManager.clone(url, targetDir, {
          singleBranch: true,
          depth: 1,
          ref: branch,
        });
        console.log('gitManager.clone() returned successfully');

        const actualRepoDir = gitManager.getRepoDir();
        if (actualRepoDir) {
          setCurrentRepoPath(actualRepoDir);
          setIsGitRepo(true);
        } else {
          console.error('Failed to get repo dir after clone');
          // For Tauri, use the target directory directly
          const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__;
          setCurrentRepoPath(isTauri ? targetDir : targetDir);
          setIsGitRepo(true);
        }

        // Get list of markdown files
        console.log('Getting repo files...');
        const files = await gitManager.getRepoFiles();
        console.log('Found', files.length, 'markdown files:', files);
        setRepoFiles(files);

        // Open file browser
        setFileBrowserModalOpen(true);

        showToast('Repository cloned successfully!', 'success');
        console.log('=== Clone Completed Successfully ===');
      } catch (error) {
        console.error('=== Clone Failed in Handler ===');
        console.error('Error:', error);

        const errorMessage = (error as Error).message;

        // Check if it's an authentication error
        if (errorMessage.includes('401') || errorMessage.includes('authentication') || errorMessage.includes('Authentication failed')) {
          showToast('Authentication required. Please set up Git credentials first.', 'error');
          // Prompt user to set up credentials
          showToast('Opening credentials setup...', 'info');
          setTimeout(() => {
            handleSetupCredentials();
          }, 1000);
        } else {
          showToast(`Failed to clone repository: ${errorMessage}`, 'error');
        }
      }
    };

    // Check if credentials are available and unlocked
    if (!gitCredentialManager.hasCredentials()) {
      // No credentials stored - ask user if they want to set them up
      const needsAuth = await new Promise<boolean>((resolve) => {
        setConfirmModalConfig({
          open: true,
          title: 'Authentication Required?',
          message: 'This repository may require authentication. Would you like to set up Git credentials before cloning?',
          confirmLabel: 'Setup Credentials',
          cancelLabel: 'Try Without Auth',
          onConfirm: () => {
            setConfirmModalConfig({ ...confirmModalConfig, open: false });
            resolve(true);
          },
        });

        // Also handle cancel
        setTimeout(() => {
          const cancelBtn = document.querySelector('.confirm-modal button:last-child');
          if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
              setConfirmModalConfig({ ...confirmModalConfig, open: false });
              resolve(false);
            }, { once: true });
          }
        }, 100);
      });

      if (needsAuth) {
        // Setup credentials first, then clone
        setPendingCredentialAction(() => performClone);
        handleSetupCredentials();
        return;
      }
    } else if (!gitCredentialManager.isUnlocked()) {
      // Credentials exist but locked - unlock first
      showToast('Please unlock your credentials first', 'info');
      setPendingCredentialAction(() => performClone);
      setIsMasterPasswordSetup(false);
      setMasterPasswordModalOpen(true);
      return;
    }

    // Credentials are ready or user chose to try without auth
    await performClone();
  };

  // Open an existing repository
  const handleOpenRepositoryClick = async () => {
    // Check if running in Tauri
    const isTauri = typeof window !== 'undefined' &&
      ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__ ||
        typeof (window as any).__TAURI_INVOKE__ === 'function');
    console.log('[App] Tauri detection:', isTauri);
    console.log('[App] Window object:', typeof window);
    console.log('[App] __TAURI__ property:', (window as any).__TAURI__);

    if (isTauri) {
      // Tauri: Use Tauri file operations
      const { handleTauriOpenRepository } = await import('./tauriFileHandler');
      handleTauriOpenRepository(
        // onGitRepoDetected
        async (repoPath: string, dirPath: string) => {
          console.log('[App] Repository opened:', repoPath);
          setCurrentRepoPath(dirPath);
          setIsGitRepo(true);

          // Set the repository directory in gitManager
          gitManager.setRepoDir(dirPath);
          console.log('[App] Set repo dir in gitManager:', dirPath);

          showToast(`Git repository opened: ${repoPath}`, 'success');

          // Update Git status
          await updateGitStatus();
        },
        // onFileListReady
        async (files: string[], dirPath: string) => {
          console.log('[App] Files found:', files.length);
          setRepoFiles(files);
          setCurrentRepoPath(dirPath);

          // Set the repository directory in gitManager
          gitManager.setRepoDir(dirPath);
          console.log('[App] Set repo dir in gitManager for file list:', dirPath);

          // If files found, show file browser
          if (files.length > 0) {
            setFileBrowserModalOpen(true);
          } else {
            showToast('No markdown files found in this directory', 'warning');
          }
        }
      );
    } else {
      // Web: Use File System Access API
      const { handleOpenRepository } = await import('./insertSave');
      handleOpenRepository(
        setEditorContent,
        // onGitRepoDetected
        async (repoPath: string, dirHandle: any) => {
          console.log('[App] Repository opened:', repoPath);
          setCurrentDirHandle(dirHandle);
          setCurrentRepoPath(repoPath);
          setIsGitRepo(true);

          // Set repo directory in gitManager for web mode
          // Use LightningFS path format: /repoName
          const lightningFSPath = `/${repoPath}`;

          // Sync the repo contents to LightningFS
          console.log('[App] Syncing repo to LightningFS:', lightningFSPath);
          try {
            await gitManager.openRepoFromHandle(dirHandle, lightningFSPath);
            console.log('[App] Repo sync complete');
          } catch (e) {
            console.error('[App] Repo sync failed:', e);
            // Fallback to basic setup if sync fails
            gitManager.setRepoDir(lightningFSPath);
            gitManager.setDirHandle(dirHandle);
          }

          showToast(`Git repository opened: ${repoPath}`, 'success');

          // Update Git status
          await updateGitStatus();
        },
        // onFileListReady
        async (files: string[], dirHandle: any) => {
          console.log('[App] Files found:', files.length);
          setRepoFiles(files);
          setCurrentDirHandle(dirHandle);

          // If files found, show file browser
          if (files.length > 0) {
            setFileBrowserModalOpen(true);
          } else {
            showToast('No markdown files found in this directory', 'warning');
          }
        }
      );
    }
  };



  // Handle opening file from command line arguments
  const handleOpenFileFromCommandLine = async (filePath: string) => {
    // If translations are loading, wait
    if (isLoading) {
      console.log('Translations loading, queueing file open:', filePath);
      setPendingFileToOpen(filePath);
      return;
    }

    try {
      console.log('Opening file from command line:', filePath);
      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;
      let targetPath = filePath;

      const { readFileContent, resolvePath } = await import('./tauriFileHandler');
      // Resolve path first
      if (isTauri) {
        targetPath = await resolvePath(filePath);
      }

      // Check if it is an encrypted file
      if (targetPath.toLowerCase().endsWith('.sstp')) {
        const { decryptFileFromPath } = await import('./cryptoHandler');
        const showPrompt = (onSubmit: (password: string) => void) =>
          showPasswordPrompt(t('menu.decrypt_file_title'), t('menu.decrypt_file_prompt'), onSubmit);

        await decryptFileFromPath(targetPath, setEditorContent, showPrompt, showToast);
        setCurrentFilePath(targetPath);
        return;
      }

      const content = await readFileContent(targetPath);

      if (content !== null) {
        setEditorContent(content);
        setCurrentFilePath(targetPath);

        // Extract directory path to check if it's a Git repo
        const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
        const { checkGitRepo } = await import('./tauriFileHandler');
        const isGitRepo = await checkGitRepo(dirPath);

        if (isGitRepo) {
          setCurrentRepoPath(dirPath);
          setIsGitRepo(true);
          if (gitManager) {
            gitManager.setRepoDir(dirPath);
            await updateGitStatus();
          }
          showToast(`Opened file from Git repository: ${filePath.split('/').pop()}`, 'success');
        } else {
          showToast(`Opened file: ${filePath.split('/').pop()}`, 'success');
        }
      } else {
        showToast(`Failed to open file: ${filePath}`, 'error');
      }
    } catch (error) {
      console.error('Error opening file from command line:', error);
      showToast(`Failed to open file: ${(error as Error).message}`, 'error');
    }
  };

  // Update the ref whenever the function changes
  useEffect(() => {
    handleOpenFileRef.current = handleOpenFileFromCommandLine;
  }, [handleOpenFileFromCommandLine]);

  // Process pending file when loading completes
  useEffect(() => {
    if (!isLoading && pendingFileToOpen) {
      console.log('Processing queued file:', pendingFileToOpen);
      handleOpenFileFromCommandLine(pendingFileToOpen);
      setPendingFileToOpen(null);
    }
  }, [isLoading, pendingFileToOpen, handleOpenFileFromCommandLine]);

  const handleFileSelect = async (filePath: string) => {
    setFileBrowserModalOpen(false);

    if (!currentRepoPath) return;

    try {
      let content: string;
      let fullPath: string;

      console.log('[App] Opening file:', filePath);
      console.log('[App] Current repo path:', currentRepoPath);

      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__;

      if (isTauri) {
        // Tauri mode: read file directly from filesystem
        console.log('[App] Reading file via Tauri:', filePath);
        const { readTauriFile } = await import('./tauriFileHandler');
        const result = await readTauriFile(currentRepoPath, filePath);

        if (result) {
          content = result.content;
          fullPath = result.path;
          console.log('[App] File content loaded from Tauri, length:', content.length);

          // Set the repository directory in gitManager for Tauri
          if (currentRepoPath) {
            gitManager.setRepoDir(currentRepoPath);
            console.log('[App] Set repo dir in gitManager:', currentRepoPath);
          }

          // For Tauri, we need to store the relative path for Git operations
          // but the full path for file operations
          setCurrentFilePath(result.path); // Store full path
        } else {
          throw new Error('Failed to read file from Tauri filesystem');
        }
      } else {
        // Web mode with directory handle
        if (currentDirHandle) {
          console.log('[App] Reading file via directory handle:', filePath);

          // Try gitManager first (reads from LightningFS)
          try {
            content = await gitManager.readFile(filePath);
            fullPath = filePath;
            console.log('[App] File content loaded from gitManager, length:', content.length);
          } catch (gitError) {
            // Fallback: read directly from directory handle
            console.log('[App] gitManager failed, trying direct read from directory handle');
            const { readFileFromDirectory } = await import('./insertSave');
            const result = await readFileFromDirectory(currentDirHandle, filePath);

            if (result) {
              content = result.content;
              fullPath = filePath;
              console.log('[App] File content loaded from directory, length:', content.length);
            } else {
              throw new Error('Failed to read file from directory');
            }
          }
        } else {
          // Use Tauri file handler for direct file system access
          console.log('[App] Reading file via Tauri file handler:', filePath);
          const { readTauriFile } = await import('./tauriFileHandler');
          const result = await readTauriFile(currentRepoPath, filePath);

          if (result) {
            content = result.content;
            fullPath = result.path;
            console.log('[App] File content loaded from Tauri file handler, length:', content.length);
          } else {
            throw new Error('Failed to read file from Tauri file handler');
          }
        }
      }

      setEditorContent(content);
      setCurrentFilePath(fullPath);
      setCurrentCloudNote(null); // Clear cloud note state when opening git file

      showToast(`Opened: ${filePath}`, 'success');
    } catch (error) {
      showToast(`Failed to open file: ${(error as Error).message}`, 'error');
      console.error('File open error:', error);
    }
  };

  const handleGitPull = async () => {
    if (!gitManager) {
      showToast('Git manager not initialized yet. Please wait.', 'info');
      return;
    }

    if (!isGitRepo) {
      showToast('No active Git repository. Please clone a repository first.', 'info');
      return;
    }

    try {
      await gitManager.pull();
      showToast('Successfully pulled latest changes!', 'success');
    } catch (error) {
      showToast(`Failed to pull changes: ${(error as Error).message}`, 'error');
      console.error('Pull error:', error);
    }
  };

  const handleGitPush = async () => {
    if (!isGitRepo) {
      showToast('No active Git repository. Please clone a repository first.', 'info');
      return;
    }

    const hasCredentials = await ensureCredentials(async () => {
      try {
        await gitManager.push();
        showToast('Successfully pushed changes!', 'success');
        await updateGitStatus();
      } catch (error) {
        const msg = (error as Error).message;
        if (msg.includes('not a simple fast-forward') || msg.includes('Push rejected')) {
          showToast('Push rejected: Remote has changes you don\'t have. Please Pull first.', 'error');
        } else {
          showToast(`Failed to push changes: ${msg}`, 'error');
        }
        console.error('Push error:', error);
      }
    });

    if (hasCredentials) {
      try {
        await gitManager.push();
        showToast('Successfully pushed changes!', 'success');
        await updateGitStatus();
      } catch (error) {
        const msg = (error as Error).message;
        if (msg.includes('not a simple fast-forward') || msg.includes('Push rejected')) {
          showToast('Push rejected: Remote has changes you don\'t have. Please Pull first.', 'error');
        } else {
          showToast(`Failed to push changes: ${msg}`, 'error');
        }
        console.error('Push error:', error);
      }
    }
  };

  const handleGitFetch = async () => {
    if (!isGitRepo) {
      showToast('No active Git repository. Please clone a repository first.', 'info');
      return;
    }

    try {
      await gitManager.fetch();
      showToast('Successfully fetched updates!', 'success');
    } catch (error) {
      showToast(`Failed to fetch updates: ${(error as Error).message}`, 'error');
      console.error('Fetch error:', error);
    }
  };

  const handleGitCommit = async () => {
    if (!isGitRepo) {
      showToast('No active Git repository. Please clone a repository first.', 'info');
      return;
    }

    try {
      // Get modified files
      const status = await gitManager.status();
      const modified = [...status.modified, ...status.staged, ...status.untracked];
      setModifiedFiles(modified);
      setCommitModalOpen(true);
    } catch (error) {
      showToast(`Failed to get repository status: ${(error as Error).message}`, 'error');
      console.error('Status error:', error);
    }
  };

  const handleCommitSubmit = async (message: string, description?: string) => {
    try {
      const fullMessage = description ? `${message}\n\n${description}` : message;
      await gitManager.commit(fullMessage);
      showToast('Successfully committed changes!', 'success');
      setCommitModalOpen(false);
      // If credentials are configured, automatically push after a successful commit
      try {
        await handleGitPush();
      } catch (pushError) {
        // handleGitPush already shows toasts; just log here
        console.error('Auto-push after commit failed:', pushError);
      }
      await updateGitStatus(); // Refresh status after commit
    } catch (error) {
      showToast(`Failed to commit: ${(error as Error).message}`, 'error');
      console.error('Commit error:', error);
    }
  };

  const handleGitSave = async () => {
    if (!currentFilePath) {
      showToast('No file is currently open from a Git repository.', 'warning');
      return;
    }

    try {
      let relativePath: string;
      // Use gitManager's repo path as fallback if state hasn't updated yet
      const repoPath = currentRepoPath || gitManager.getRepoDir();

      if (!repoPath) {
        showToast('No active Git repository. Please clone a repository first.', 'info');
        return;
      }

      console.log('[App] Saving file:', currentFilePath);
      console.log('[App] Current repo path:', repoPath);
      console.log('[App] Is Electron:', !!(window as any).electronAPI);

      // Extract relative path from full path
      const normalizedFilePath = currentFilePath.replace(/\\/g, '/');
      const normalizedRepoPath = repoPath.replace(/\\/g, '/');

      relativePath = normalizedFilePath.startsWith(normalizedRepoPath)
        ? normalizedFilePath.substring(normalizedRepoPath.length).replace(/^\//, '')
        : normalizedFilePath;

      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

      if (isTauri) {
        // Ensure we have an absolute path for Tauri
        const { resolvePath, writeTauriFile } = await import('./tauriFileHandler');
        const absolutePath = await resolvePath(currentFilePath, repoPath);

        console.log('[App] Writing via Tauri:', absolutePath);
        const success = await writeTauriFile(absolutePath, editorContent);

        if (!success) {
          throw new Error('Failed to write file');
        }

        console.log('[App] File saved successfully via Tauri');

        console.log('[App] Staging file via Tauri:', relativePath);
        await gitManager.add(relativePath);
        console.log('[App] File staged successfully via Tauri');
      } else {
        // Web mode
        console.log('[App] Writing via gitManager:', relativePath);
        await gitManager.writeFile(relativePath, editorContent);
        console.log('[App] File saved successfully');

        console.log('[App] Staging file:', relativePath);
        await gitManager.add(relativePath);
        console.log('[App] File staged successfully');
      }

      showToast(`Saved and staged: ${relativePath}`, 'success');
      await updateGitStatus(); // Refresh status after save
    } catch (error) {
      showToast(`Failed to save and stage file: ${(error as Error).message}`, 'error');
      console.error('Save error:', error);
    }
  };

  const handleSaveStageCommitPush = async () => {
    const repoPath = currentRepoPath || gitManager.getRepoDir();

    if (!repoPath && !isGitRepo) {
      showToast('No active Git repository. Please clone a repository first.', 'info');
      return;
    }

    if (!currentFilePath) {
      showToast('No file is currently open from a Git repository.', 'warning');
      return;
    }

    try {
      // First save and stage the current file
      await handleGitSave();

      // Open the commit modal so the user can enter a message
      await handleGitCommit();

      // Note: the actual push will be triggered from the commit handler
      // once a commit is successfully created.
    } catch (error) {
      console.error('Save/Commit/Push error:', error);
      showToast(`Failed to save and prepare commit: ${(error as Error).message}`, 'error');
    }
  };

  // Phase 4: Git status update
  const updateGitStatus = useCallback(async () => {
    if (!isGitRepo || !currentRepoPath) {
      setGitStatus({ branch: '', modifiedCount: 0, status: 'clean' });
      return;
    }

    try {
      const branch = await gitManager.getCurrentBranch();
      const status = await gitManager.status();
      const modifiedCount = status.modified.length + status.staged.length + status.untracked.length;

      setGitStatus({
        branch: branch || 'main',
        modifiedCount,
        status: modifiedCount > 0 ? 'modified' : 'clean'
      });
    } catch (error) {
      console.error('Failed to update git status:', error);
      // Set default status on error
      setGitStatus({ branch: '', modifiedCount: 0, status: 'clean' });
    }
  }, [isGitRepo, currentRepoPath, gitManager]);

  // Auto-refresh Git status every 30 seconds
  useEffect(() => {
    if (!isGitRepo || !currentRepoPath || !gitManager) return;

    const intervalId = setInterval(async () => {
      // Skip if document is hidden to save resources
      if (document.hidden) return;

      try {
        await gitManager.fetch();
        await updateGitStatus();
      } catch (error) {
        // Silent failure in background
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [isGitRepo, currentRepoPath, gitManager, updateGitStatus]);

  // Phase 4: View commit history
  const handleViewHistory = async () => {
    if (!gitManager) {
      showToast('Git manager not initialized yet. Please wait.', 'info');
      return;
    }

    if (!isGitRepo) {
      showToast('No active Git repository. Please clone a repository first.', 'info');
      return;
    }

    try {
      const commits = await gitManager.log(20); // Get last 20 commits
      setCommitHistory(commits);
      setGitHistoryModalOpen(true);
    } catch (error) {
      showToast(`Failed to retrieve commit history: ${(error as Error).message}`, 'error');
      console.error('History error:', error);
    }
  };

  // Phase 4: Initialize new repository (Web-only)
  const handleInitRepo = async () => {
    showToast('Repository initialization is not available in web mode. Use "Clone Repository" instead.', 'info');
  };

  // File operations for File Modal
  const handleOpenMarkdown = async () => {
    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

    if (isTauri) {
      const { handleTauriOpenFile } = await import('./tauriFileHandler');
      await handleTauriOpenFile(async (content: string, filePath?: string | null) => {
        setEditorContent(content);
        if (filePath) {
          setCurrentFilePath(filePath);
          setCurrentCloudNote(null);
          console.log('[App] File path set:', filePath);

          if (!isGitRepo) {
            showToast('File opened!', 'info');
          }
        }
      });
    } else {
      handleOpenClick(
        async (content: string, filePath?: string | null) => {
          setEditorContent(content);

          if (filePath) {
            setCurrentFilePath(filePath);
            setCurrentCloudNote(null);
            console.log('[App] File path set:', filePath);

            if (!isGitRepo) {
              showToast('File opened! For Git features, use "File → Open Repository"', 'info');
            }
          }
        },
        async (repoPath: string, dirHandle: any) => {
          console.log('[App] Git repo detected via File System Access API:', repoPath);

          if (dirHandle) {
            setCurrentDirHandle(dirHandle);
            setCurrentRepoPath(repoPath);
            setIsGitRepo(true);

            const lightningFSPath = `/${repoPath}`;
            console.log('[App] Syncing repo to LightningFS:', lightningFSPath);
            try {
              await gitManager.openRepoFromHandle(dirHandle, lightningFSPath);
              console.log('[App] Repo sync complete');
            } catch (e) {
              console.error('[App] Repo sync failed:', e);
              gitManager.setRepoDir(lightningFSPath);
              gitManager.setDirHandle(dirHandle);
            }

            showToast('Git repository detected! Git features are now available.', 'success');
            await updateGitStatus();
          } else {
            showToast('Git repository detected! Use "Git → Open Repository" for full Git features', 'info');
          }
        }
      );
    }
  };

  const handleOpenEncrypted = () => {
    const showPrompt = (onSubmit: (password: string) => void) =>
      showPasswordPrompt(t('menu.decrypt_file_title'), t('menu.decrypt_file_prompt'), onSubmit);
    decryptFile(setEditorContent, showPrompt, showToast);
  };

  const handleOpenSupport = async () => {
    const url = 'https://github.com/gcclinux/EasyEditor/discussions';
    let opened = false;

    const isTauri = typeof window !== 'undefined' &&
      ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__ ||
        typeof (window as any).__TAURI_INVOKE__ === 'function');

    if (isTauri) {
      try {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(url);
        opened = true;
      } catch (e) {
        console.error('Tauri shell open failed:', e);
      }
    } else {
      try {
        const w = window.open(url, '_blank', 'noopener');
        if (w) opened = true;
      } catch (e) {
        console.warn('window.open threw:', e);
      }
    }

    if (!opened) {
      try {
        await navigator.clipboard.writeText(url);
        showToast('Unable to open link automatically. The URL has been copied to your clipboard.', 'warning');
      } catch (e) {
        showToast('Unable to open or copy link automatically. Please open the URL manually from the address bar.', 'error');
      }
    }
  };

  const handleBuyCoffee = async () => {
    const url = 'https://buymeacoffee.com/gcclinux';
    let opened = false;

    const isTauri = typeof window !== 'undefined' &&
      ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__ ||
        typeof (window as any).__TAURI_INVOKE__ === 'function');

    if (isTauri) {
      try {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(url);
        opened = true;
      } catch (e) {
        console.error('Tauri shell open failed:', e);
      }
    } else {
      try {
        const w = window.open(url, '_blank', 'noopener');
        if (w) opened = true;
      } catch (e) {
        console.warn('window.open threw:', e);
      }
    }

    if (!opened) {
      try {
        await navigator.clipboard.writeText(url);
        showToast('Unable to open link automatically. The URL has been copied to your clipboard.', 'warning');
      } catch (e) {
        showToast('Unable to open or copy link automatically. Please open the URL manually from the address bar.', 'error');
      }
    }
  };

  // Cloud note save handler
  const handleCloudNoteSave = async () => {
    if (!currentCloudNote) {
      showToast('No cloud note is currently open.', 'warning');
      return;
    }

    try {
      // Import cloudManager singleton to avoid circular dependencies
      const { cloudManager } = await import('./cloud/managers/CloudManager');

      if (!cloudManager) {
        throw new Error('Cloud features are disabled');
      }

      await cloudManager.saveNote(currentCloudNote.noteId, editorContent);

      // Update cloud note state
      setCurrentCloudNote(prev => prev ? {
        ...prev,
        lastSaved: new Date(),
        hasUnsavedChanges: false
      } : null);

      // Trigger sidebar refresh to update timestamps
      setSidebarRefreshTrigger(prev => {
        const newValue = prev + 1;
        console.log('[App] Triggering sidebar refresh, new trigger value:', newValue);
        return newValue;
      });

      showToast(`Saved "${currentCloudNote.title}" to ${currentCloudNote.providerDisplayName}`, 'success');
    } catch (error) {
      console.error('Failed to save cloud note:', error);
      showToast(`Failed to save cloud note: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  // Universal save handler - handles all file types (cloud, git, local)
  const handleUniversalSave = async () => {
    // Priority 1: Cloud note save
    if (currentCloudNote) {
      await handleCloudNoteSave();
      return;
    }

    // Priority 2: Git repo save (Electron or Web)
    if (isGitRepo && currentFilePath) {
      await handleGitSave();
      return;
    }

    // Priority 3: Git repo save via directory handle (when file was opened individually but repo was detected)
    if (currentDirHandle && currentFilePath) {
      try {
        // Try to save using directory handle
        const fileName = currentFilePath.split(/[/\\]/).pop() || currentFilePath;
        const success = await writeFileToDirectory(currentDirHandle, fileName, editorContent);
        if (success) {
          showToast('File saved successfully!', 'success');

          // If Git features are available, also stage the file
          if (isGitRepo && gitManager) {
            try {
              await gitManager.add(fileName);
              showToast(`File saved and staged: ${fileName}`, 'success');
              await updateGitStatus();
            } catch (gitError) {
              console.warn('Failed to stage file:', gitError);
              // File was saved, just couldn't stage it
            }
          }
          return;
        }
      } catch (error) {
        console.error('Failed to save via directory handle:', error);
        // Fall through to next option
      }
    }

    // Priority 4: File System Access API save (Web)
    const { saveToCurrentFile, getCurrentFileHandle } = await import('./insertSave');
    const fileHandle = getCurrentFileHandle();

    if (fileHandle) {
      const success = await saveToCurrentFile(editorContent);
      if (success) {
        showToast('File saved successfully!', 'success');
        return;
      } else {
        showToast('Failed to save file', 'error');
        return;
      }
    }

    // Fallback: Show save as dialog
    showToast('No file is currently open. Use "Save As" to save to a new file.', 'info');
  };

  /* Export Functions */
  const handleSaveAsPDF = () => {
    saveAsPDF(isPreviewFull ? 'preview-content' : (isEditFull ? 'editor-textarea' : 'preview-content'));
  };

  const handleSaveAsPNG = () => {
    saveAsPNG(isPreviewFull ? 'preview-content' : (isEditFull ? 'editor-textarea' : 'preview-content'));
  };



  // Save to Markdown wrapper
  const handleSaveToMarkdown = async () => {
    await saveToFile(editorContent, setCurrentFilePath);
  };

  // Save to TXT wrapper
  const handleSaveToTXT = () => {
    saveToTxT(editorContent);
  };

  // Handle New File creation
  const handleNewFile = async () => {
    // 1. Clear content and state
    handleClear(setEditorContent);
    setCurrentFilePath(null);
    setCurrentCloudNote(null); // Clear cloud note state
    setGitStatus({ branch: '', modifiedCount: 0, status: 'clean' });

    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

    // 2. Immediately prompt to save
    let savedPath: string | null = null;
    if (isTauri) {
      const { handleTauriSaveAs } = await import('./tauriFileHandler');
      savedPath = await handleTauriSaveAs('', 'new-file.md');
    } else {
      savedPath = await saveAsFile('');
    }

    // 3. If saved successfully, update state
    if (savedPath) {
      setCurrentFilePath(savedPath);

      // If we are in a git repo, update status to see if the new file is tracked/untracked
      if (isGitRepo) {
        await updateGitStatus();
      }

      showToast('New file created successfully', 'success');
    }
  };

  // Save Encrypted wrapper
  const handleSaveEncrypted = () => {
    encryptContent(editorContent, (onSubmit) => {
      showPasswordPrompt(
        'Encrypt Content',
        'Enter a password to encrypt the file (min 8 characters):',
        onSubmit
      );
    }, showToast);
  };

  // Update effect to include cursor position
  useEffect(() => {
    if (editorContent !== documentHistory[historyIndex]?.content) {
      addToHistory(
        editorContent,
        cursorPositionRef.current,
        documentHistory,
        historyIndex,
        setDocumentHistory,
        setHistoryIndex
      );
    }
  }, [editorContent]);

  // Update cursor position effect
  useEffect(() => {
    if (textareaRef.current) {
      const pos = cursorPositionRef.current;
      textareaRef.current.setSelectionRange(pos, pos);
      textareaRef.current.focus();
    }
  }, [editorContent, historyIndex]);

  // Phase 4: Update Git status when repo changes
  useEffect(() => {
    if (isGitRepo && currentRepoPath) {
      updateGitStatus();
    }
  }, [isGitRepo, currentRepoPath]);



  // Add this function near other utility functions
  const getEditorPreviewContainerClass = () => {
    if (isEditFull) {
      return "editor-preview-container-horizontal"; // Always use horizontal container in full mode
    }
    return isHorizontal
      ? "editor-preview-container-horizontal"
      : "editor-preview-container-parallel";
  };

  // Insert Process of Elimination Diagram Syntax
  const handleProcessEliminationInsert = () => {
    insertUMLProcessOfEliminationDiagram(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  // Insert Database Replication Diagram Syntax
  const handleDatabaseReplicationInsert = () => {
    insertUMLDatabaseReplicationDiagram(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  // Insert LLM Training Diagram Syntax
  const handleUMLLLMTrainingInsert = () => {
    insertUMLLLMTrainingDiagram(textareaRef, editorContent, setEditorContent, cursorPositionRef);
  };

  return (
    <div className="container">
      <div className="menubar">
        <div className="dropdown-container">
          <button
            className="help-menubar-btn"
            onClick={() => {
              closeAllDropdowns();
              setShowEasyNotesSidebar(false);
              setShowFileModal(true);
            }}
            title={t('menu.file')}
          >
            <FaFileImport /> &nbsp; {t('menu.file')}
          </button>
        </div>
        {/* EasyNotes Feature - Controlled by feature flag */}
        {isFeatureEnabled('EASY_NOTES') && (
          <div className="dropdown-container">
            <button
              className="help-menubar-btn"
              ref={el => { easyNotesButtonRef.current = el; }}
              onClick={(e) => {
                e.preventDefault();
                closeAllDropdowns();
                setShowEasyNotesSidebar(!showEasyNotesSidebar);
              }}
              title="EasyNotes"
              style={{ backgroundColor: showEasyNotesSidebar ? '#4a5568' : undefined }}
            >
              <FaStickyNote /> &nbsp; EasyNotes
            </button>
          </div>
        )}
        <div className="dropdown-container">
          <button
            className="help-menubar-btn"
            onClick={() => {
              closeAllDropdowns();
              setShowEasyNotesSidebar(false);
              setShowGitModal(true);
            }}
            title="Git Operations"
          >
            <FaCodeBranch /> &nbsp; Git
          </button>
        </div>
        {isGitRepo && (
          <GitStatusIndicator
            isActive={isGitRepo}
            branchName={gitStatus.branch}
            modifiedCount={gitStatus.modifiedCount}
            status={gitStatus.status}
          />
        )}
        {/* Cloud note display removed - note name now shown in title bar only */}
        {/* Regular file display removed - filename now shown in title bar only */}
        {/* If there was a display for currentFilePath here, it has been removed */}
        <button
          className="menu-item fixed-menubar-btn"
          onClick={toggleView}
          title={getCurrentViewMode()}
        >
          <FaExchangeAlt /> &nbsp; {getCurrentViewMode()}
        </button>
        <button
          className="menu-item fixed-menubar-btn"
          onClick={() => handleUndo(historyIndex, documentHistory, setHistoryIndex, setEditorContent, cursorPositionRef)}
          disabled={historyIndex <= 0}
          title={t('menu.undo')}
        >
          <FaUndo /> &nbsp; {t('menu.undo')}
        </button>
        <button
          className="menu-item fixed-menubar-btn"
          onClick={() => {
            setShowEasyNotesSidebar(false);
            handleNewFile();
          }}
          title={t('menu.new_file')}
        >
          <GrDocumentText /> &nbsp; {t('menu.new_file')}
        </button>
        <button
          className="menu-item fixed-menubar-btn"
          onClick={() => handleRedo(historyIndex, documentHistory, setHistoryIndex, setEditorContent, cursorPositionRef)}
          disabled={historyIndex >= documentHistory.length - 1}
          title={t('menu.redo')}
        >
          <FaRedo /> &nbsp; {t('menu.redo')}
        </button>
        <div className="dropdown-container">
          <button
            className="menu-item fixed-menubar-btn"
            onClick={() => {
              closeAllDropdowns();
              setShowEasyNotesSidebar(false);
              setShowTaskModal(true);
            }}
            title={t('menu.tasks')}
          >
            <GoTasklist /> &nbsp; {t('menu.tasks')}
          </button>
        </div>
        <div className="dropdown-container">
          <button
            className="menu-item fixed-menubar-btn"
            onClick={() => {
              cacheSelection();
              closeAllDropdowns();
              setShowEasyNotesSidebar(false);
              setShowExportModal(true);
            }}
            title={t('menu.exports')}
          >
            <FaDownload /> &nbsp; {t('menu.exports')}
          </button>
        </div>


        {/* Git Modal */}
        {
          showGitModal && (
            <GitModal
              onClone={handleGitClone}
              onOpenRepository={handleOpenRepositoryClick}
              onPull={handleGitPull}
              onPush={handleGitPush}
              onFetch={handleGitFetch}
              onCommit={handleGitCommit}
              onSave={handleGitSave}
              onSaveCommitPush={handleSaveStageCommitPush}
              onSetupCredentials={handleSetupCredentials}
              onClearCredentials={handleClearCredentials}
              onViewHistory={handleViewHistory}
              onInitRepo={handleInitRepo}
              hasCredentials={hasStoredCredentials}
              isAuthenticated={gitCredentialManager.isUnlocked()}
              onClose={() => setShowGitModal(false)}
            />
          )
        }

        {/* File Modal */}
        {
          showFileModal && (
            <FileModal
              onOpenMarkdown={handleOpenMarkdown}
              onOpenTxt={() => handleOpenTxtClick(setEditorContent)}
              onOpenEncrypted={handleOpenEncrypted}
              onSave={handleUniversalSave}
              onSaveAs={handleSaveToMarkdown}
              onFeatures={() => setFeaturesOpen(true)}
              onSupport={handleOpenSupport}
              onBuyCoffee={handleBuyCoffee}
              onSelectTheme={() => setThemeOpen(true)}
              onSelectLanguage={() => setLanguageOpen(true)}
              onAbout={() => setAboutOpen(true)}
              onClose={() => setShowFileModal(false)}
            />
          )
        }

        {/* Task Modal */}
        {
          showTaskModal && (
            <TaskModal
              onInsertTask={handleInsertImageTemplate}
              onClose={() => setShowTaskModal(false)}
            />
          )
        }

        {
          showExportModal && (
            <ExportModal
              onSaveAsPNG={handleSaveAsPNG}
              onSaveAsPDF={handleSaveAsPDF}
              onSaveToMarkdown={handleSaveToMarkdown}
              onSaveToTXT={handleSaveToTXT}
              onSaveEncrypted={handleSaveEncrypted}
              onSaveToCloud={handleCloudNoteSave}
              currentCloudNote={currentCloudNote}
              onClose={() => setShowExportModal(false)}
            />
          )
        }

        {/* About & Features Modals */}
        <UpdateModal
          open={updateModalOpen}
          onClose={() => setUpdateModalOpen(false)}
          runVersion={runVersion}
          availVersion={availVersion}
        />
        <AboutModal
          open={aboutOpen}
          onClose={() => setAboutOpen(false)}
        />

        <LanguageModal
          open={languageOpen}
          onClose={() => setLanguageOpen(false)}
        />

        <FeaturesModal open={featuresOpen} onClose={() => setFeaturesOpen(false)} />
        {
          showHeaderModal && (
            <HeadersModal
              onInsertH1={handlerinserth1Syntax}
              onInsertH2={handlerinserth2Syntax}
              onInsertH3={handlerinserth3Syntax}
              onInsertH4={handlerinserth4Syntax}
              onInsertH5={handlerinserth5Syntax}
              onInsertH6={handlerinserth6Syntax}
              onClose={() => setShowHeaderModal(false)}
            />
          )
        }
        {
          showFormattingModal && (
            <FormattingModal
              onBold={handleBoldSyntax}
              onItalic={handlerItalicSyntax}
              onStrike={handlerStrikethroughSyntax}
              onCodeLine={handlerinsertCodeSyntax}
              onCodeBlock={handlerinsertBlockCodeSyntax}
              onNewLine={handleNewLineSyntax}
              onClose={() => setShowFormattingModal(false)}
            />
          )
        }
        {
          showInsertModal && (
            <InsertModal
              onRuler={handlerinsertRulerSyntax}
              onIndent1={handlerinsertIndent1Syntax}
              onIndent2={handlerinsertIndent2Syntax}
              onList1={handlerinsertList1Syntax}
              onList2={handlerinsertList2Syntax}
              onInsertTemplate={handleInsertImageTemplate}
              onClose={() => setShowInsertModal(false)}
            />
          )
        }
        {
          showLinksModal && (
            <LinksModal
              onInsertTemplate={handleInsertImageTemplate}
              onClose={() => setShowLinksModal(false)}
            />
          )
        }
        {
          showImagesModal && (
            <ImagesModal
              onInsertTemplate={handleInsertImageTemplate}
              onClose={() => setShowImagesModal(false)}
            />
          )
        }
        {
          showTablesModal && (
            <TablesModal
              onInsertTemplate={handleInsertImageTemplate}
              onClose={() => setShowTablesModal(false)}
            />
          )
        }
        {
          showFootnoteModal && (
            <FootnoteModal
              onInsertTemplate={handleInsertImageTemplate}
              onClose={() => setShowFootnoteModal(false)}
            />
          )
        }
        {
          showAutoModal && (
            <AutoModal
              onAutoTable={() => setTableModalOpen(true)}
              onAutoGantt={() => setGanttModalOpen(true)}
              onAutoTimeline={() => setTimelineModalOpen(true)}
              onImportMD={() => setImportMDModalOpen(true)}
              onClose={() => setShowAutoModal(false)}
            />
          )
        }
        {
          showTemplatesModal && (
            <TemplatesModal
              onInsertTemplate={handleInsertImageTemplate}
              onClose={() => setShowTemplatesModal(false)}
            />
          )
        }
        {
          showMermaidModal && (
            <MermaidModal
              onJourney={handleJourneyInsert}
              onFlowchart={handleFlowchartRLInsert}
              onGantt={handleGanttInsert}
              onGraphTD={handleGraphTDInsert}
              onErDiag={handleErDiagramInsert}
              onTimeLine={handleTimeLineSyntax}
              onClassDiag={handleInsertClass}
              onGitGraph={handleGitInsert}
              onBlock={handleBlockInsert}
              onClose={() => setShowMermaidModal(false)}
            />
          )
        }
        {
          showUMLModal && (
            <UMLModal
              onClassDiagram={handleUMLClassDiagram}
              onSequenceDiagram={handleUMLSequenceDiagram}
              onUseCaseDiagram={handleUMLUseCaseDiagram}
              onActivityDiagram={handleUMLActivityDiagram}
              onComponentDiagram={handleUMLComponentDiagram}
              onStateDiagram={handleUMLStateDiagram}
              onProcessEliminationDiagram={handleProcessEliminationInsert}
              onDatabaseReplicationDiagram={handleDatabaseReplicationInsert}
              onLLMTrainingDiagram={handleUMLLLMTrainingInsert}
              onClose={() => setShowUMLModal(false)}
            />
          )
        }
        {
          showSymbolsModal && (
            <SymbolsModal
              onInsertSymbol={insertSymbol}
              onClose={() => setShowSymbolsModal(false)}
            />
          )
        }
        {
          showIconsModal && (
            <IconsModal
              onInsertIcon={insertIcon}
              onClose={() => setShowIconsModal(false)}
            />
          )
        }
        <ThemeModal
          open={themeOpen}
          onClose={() => setThemeOpen(false)}
          onSelectTheme={(theme, isCustom) => { loadTheme(theme, isCustom); setCurrentTheme(theme); }}
          currentTheme={currentTheme}
          onOpenImport={() => setImportThemeOpen(true)}
        />
        <ImportThemeModal
          open={importThemeOpen}
          onClose={() => setImportThemeOpen(false)}
          onImport={handleImportTheme}
        />
        <PasswordModal
          open={passwordModalConfig.open}
          onClose={handleClosePasswordModal}
          onSubmit={passwordModalConfig.onSubmit}
          title={passwordModalConfig.title}
          promptText={passwordModalConfig.promptText}
        />
        <CloneModal
          open={cloneModalOpen}
          onClose={() => setCloneModalOpen(false)}
          onSubmit={handleCloneSubmit}
          showToast={showToast}
        />
        <ImportMDModal
          open={importMDModalOpen}
          onClose={() => setImportMDModalOpen(false)}
          onSubmit={handleImportMDSubmit}
        />
        <FileBrowserModal
          open={fileBrowserModalOpen}
          onClose={() => setFileBrowserModalOpen(false)}
          onSelectFile={handleFileSelect}
          files={repoFiles}
          repoPath={currentRepoPath || ''}
        />
        <GitCredentialsModal
          open={credentialsModalOpen}
          onClose={() => setCredentialsModalOpen(false)}
          onSubmit={handleCredentialsSubmit}
          isSetup={!hasStoredCredentials}
          initialUsername={prefillCredentials?.username}
          initialToken={prefillCredentials?.token}
        />
        <MasterPasswordModal
          open={masterPasswordModalOpen}
          onClose={() => setMasterPasswordModalOpen(false)}
          onSubmit={handleMasterPasswordSubmit}
          isSetup={isMasterPasswordSetup}
          showToast={showToast}
        />
        <CommitModal
          open={commitModalOpen}
          onClose={() => setCommitModalOpen(false)}
          onSubmit={handleCommitSubmit}
          modifiedFiles={modifiedFiles}
        />
        <GitHistoryModal
          open={gitHistoryModalOpen}
          onClose={() => setGitHistoryModalOpen(false)}
          commits={commitHistory}
          repoPath={currentRepoPath || ''}
        />

        <div className="menubar-bottom">
          <div className="dropdown-container">
            <button className="button-mermaid" onMouseDown={() => { cacheSelection(); closeAllDropdowns(); setShowHeaderModal(true); }} title={t('toolbar.headers')}><CgFormatHeading />{t('toolbar.headers')}</button>
          </div>
          &#8741;
          <div className="dropdown-container">
            <button className="button-mermaid" onMouseDown={() => { cacheSelection(); closeAllDropdowns(); setShowFormattingModal(true); }} title={t('toolbar.formatting')}><CgFormatText />&nbsp;{t('toolbar.formatting')}</button>
          </div>
          &#8741;
          <div className="dropdown-container">
            <button className="button-mermaid" onMouseDown={() => { cacheSelection(); closeAllDropdowns(); setShowInsertModal(true); }} title={t('toolbar.insert')}><MdOutlineInsertChartOutlined />&nbsp;{t('toolbar.insert')}</button>
          </div>
          &#8741;
          <div className="dropdown-container">
            <button className="button-mermaid" onMouseDown={() => { cacheSelection(); closeAllDropdowns(); setShowLinksModal(true); }} title={t('toolbar.links')}><FaLink />&nbsp;{t('toolbar.links')}</button>
          </div>
          &#8741;
          <div className="dropdown-container">
            <button className="button-mermaid" onMouseDown={() => { cacheSelection(); closeAllDropdowns(); setShowImagesModal(true); }} title={t('toolbar.images')}><FaImage />&nbsp;{t('toolbar.images')}</button>
          </div>
          &#8741;
          <div className="dropdown-container">
            <button className="button-mermaid" onMouseDown={() => { cacheSelection(); closeAllDropdowns(); setShowTablesModal(true); }} title={t('toolbar.tables')}><FaTable />&nbsp;{t('toolbar.tables')}</button>
          </div>
          &#8741;
          <div className="dropdown-container">
            <button className="button-mermaid" onMouseDown={() => { cacheSelection(); closeAllDropdowns(); setShowFootnoteModal(true); }} title={t('toolbar.footnotes')}><FaStickyNote />&nbsp;{t('toolbar.footnotes')}</button>
          </div>
          &#8741;
          <div className="dropdown-container">
            <button
              className="button-mermaid"
              onMouseDown={(e) => {
                e.preventDefault();
                cacheSelection();
                closeAllDropdowns();
                setShowAutoModal(true);
              }}
              title={t('toolbar.auto')}
            >
              <MdAutoAwesome /> &nbsp; {t('toolbar.auto')}
            </button>
          </div>
          &#8741;
          <div className="dropdown-container">
            <button
              className="button-mermaid"
              onMouseDown={(e) => {
                e.preventDefault();
                cacheSelection();
                closeAllDropdowns();
                setShowTemplatesModal(true);
              }}
              title={t('menu.templates')}
            >
              <GrDocumentText /> &nbsp; {t('menu.templates')}
            </button>
          </div>
          &#8741;
          <div className="dropdown-container">
            <button
              className="button-mermaid"
              onMouseDown={(e) => {
                e.preventDefault();
                cacheSelection();
                closeAllDropdowns();
                setShowMermaidModal(true);
              }}
              title="Mermaid Options"
            >
              <SiMermaid /> &nbsp; Mermaid
            </button>
          </div>
          &#8741;
          <div className="dropdown-container">
            <button
              className="button-mermaid"
              onMouseDown={(e) => {
                e.preventDefault();
                cacheSelection();
                closeAllDropdowns();
                setShowUMLModal(true);
              }}
              title="UML Diagram Options"
            >
              <AiOutlineLayout /> &nbsp; UML
            </button>
          </div>
          &#8741;
          <div className="dropdown-container">
            <button
              className="button-mermaid"
              onMouseDown={(e) => {
                e.preventDefault();
                cacheSelection();
                closeAllDropdowns();
                setShowSymbolsModal(true);
              }}
              title="Symbol Options"
            >
              <VscSymbolKeyword /> &nbsp; Symbols
            </button>
          </div>
          &#8741;
          <div className="dropdown-container">
            <button
              className="button-mermaid"
              onMouseDown={(e) => {
                e.preventDefault();
                cacheSelection();
                closeAllDropdowns();
                setShowIconsModal(true);
              }}
              title="Icons"
            >
              <FaImage /> &nbsp; Icons
            </button>
          </div>
        </div>

        {/* Modal Generators */}
        <TableGenerator
          isOpen={tableModalOpen}
          onClose={() => setTableModalOpen(false)}
          onInsert={(tableText) => {
            setEditorContent(editorContent + tableText);
            setTableModalOpen(false);
          }}
        />
        <GanttGenerator
          isOpen={ganttModalOpen}
          onClose={() => setGanttModalOpen(false)}
          onInsert={(ganttText) => {
            setEditorContent(editorContent + ganttText);
            setGanttModalOpen(false);
          }}
        />
        <TimelineGenerator
          isOpen={timelineModalOpen}
          onClose={() => setTimelineModalOpen(false)}
          onInsert={(timelineText) => {
            setEditorContent(editorContent + timelineText);
            setTimelineModalOpen(false);
          }}
          showToast={showToast}
        />


        <p></p>

        {/* EasyNotes Sidebar - Feature flag controlled */}
        {
          isFeatureEnabled('EASY_NOTES') && (
            <EasyNotesSidebar
              showEasyNotesSidebar={showEasyNotesSidebar}
              setShowEasyNotesSidebar={setShowEasyNotesSidebar}
              showToast={showToast}
              currentCloudNote={currentCloudNote}
              refreshTrigger={sidebarRefreshTrigger}
              onNoteDelete={(noteId: string) => {
                // If the deleted note is currently open, clear the editor
                if (currentCloudNote?.noteId === noteId) {
                  setEditorContent('');
                  setCurrentCloudNote(null);
                  setCurrentFilePath(null);
                }
              }}
              onNoteSelect={async (noteId: string, content: string, noteMetadata?: any) => {
                setEditorContent(content);

                // Clear current file path since we're opening a cloud note
                setCurrentFilePath(null);

                // Set cloud note state if metadata is provided
                if (noteMetadata) {
                  // Import cloudManager singleton to get provider metadata
                  const { cloudManager } = await import('./cloud/managers/CloudManager');

                  if (!cloudManager) {
                    console.warn('Cloud features are disabled, cannot load provider metadata');
                    return;
                  }

                  const providerMetadata = await cloudManager.getProviderMetadata(noteMetadata.provider);

                  setCurrentCloudNote({
                    noteId,
                    title: noteMetadata.title,
                    provider: noteMetadata.provider,
                    providerDisplayName: providerMetadata?.displayName || noteMetadata.provider,
                    providerIcon: providerMetadata?.icon || '📄',
                    lastSaved: new Date(noteMetadata.lastSynced),
                    hasUnsavedChanges: false
                  });
                }

                // Add to history for undo/redo functionality
                addToHistory(content, cursorPositionRef.current, documentHistory, historyIndex, setDocumentHistory, setHistoryIndex);
              }}
              onUpgradeClick={() => {
                setShowEasyNotesSidebar(false);
                setAboutOpen(true);
              }}
            />
          )
        }

        <div
          className={getEditorPreviewContainerClass()}
        >
          {/* TextareaComponent is a memoized component that renders the textarea for Markdown editing */}
          {!isPreviewFull && (
            <TextareaComponent
              textareaRef={textareaRef}
              editorContent={editorContent}
              handleChange={handleChange}
              handleContextMenu={handleContextMenu}
              isEditFull={isEditFull}
              isHorizontal={isHorizontal}
              setEditorContent={setEditorContent}
              cursorPositionRef={cursorPositionRef}
            />
          )}

          {/* PreviewComponent is a memoized component that renders the preview for Markdown editing */}
          {!isEditFull && (
            <PreviewComponent
              previewRef={previewRef}
              editorContent={editorContent}
              isPreviewFull={isPreviewFull}
              isHorizontal={isHorizontal}
              initializeMermaid={initializeMermaid}
            />
          )}
        </div>

        {
          contextMenu.visible && (
            <ContextMenu
              contextMenu={contextMenu}
              textareaRef={textareaRef}
              editorContent={editorContent}
              setEditorContent={setEditorContent}
              cursorPositionRef={cursorPositionRef}
              setContextMenu={setContextMenu}
              setCachedSelection={setCachedSelection}
              setSelectionStart={setSelectionStart}
              setSelectionEnd={setSelectionEnd}
              cachedSelection={cachedSelection}
            />
          )
        }

        {confirmModalConfig.open && (
          <div className="modal-overlay">
            <div className="modal-dialog">
              <h2>{confirmModalConfig.title}</h2>
              <p style={{ whiteSpace: 'pre-wrap' }}>{confirmModalConfig.message}</p>
              <div className="modal-actions">
                {confirmModalConfig.cancelLabel !== null && (
                  <button
                    className="modal-button cancel"
                    onClick={() => setConfirmModalConfig(prev => ({ ...prev, open: false }))}
                  >
                    {confirmModalConfig.cancelLabel || 'Cancel'}
                  </button>
                )}
                <button
                  className="modal-button primary"
                  onClick={async () => {
                    const action = confirmModalConfig.onConfirm;
                    setConfirmModalConfig(prev => ({ ...prev, open: false }));
                    if (action) {
                      await action();
                    }
                  }}
                >
                  {confirmModalConfig.confirmLabel || 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

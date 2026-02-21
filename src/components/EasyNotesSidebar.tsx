import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaStickyNote, FaCloud, FaSync, FaPlus, FaTrash, FaKey } from 'react-icons/fa';
import ConfirmationModal from './ConfirmationModal';
import { cloudManager } from '../cloud/managers/CloudManager';
import { cloudToastService } from '../cloud/utils/CloudToastService';
import { offlineManager } from '../cloud/utils/OfflineManager';

import CloudSyncIndicator from './CloudSyncIndicator';
import type { NoteMetadata, ProviderMetadata } from '../cloud/interfaces';
import LicenseManager from '../premium/LicenseManager';
import { isTauriEnvironment } from '../utils/environment';
import { useLanguage } from '../i18n/LanguageContext';

interface EasyNotesSidebarProps {
  showEasyNotesSidebar: boolean;
  setShowEasyNotesSidebar: (show: boolean) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onNoteSelect?: (noteId: string, content: string | Uint8Array, noteMetadata?: NoteMetadata) => void;
  onNoteDelete?: (noteId: string) => void;
  currentCloudNote?: { noteId: string; title: string } | null;
  refreshTrigger?: number; // Add refresh trigger prop
  onUpgradeClick?: () => void;
}

const EasyNotesSidebar: React.FC<EasyNotesSidebarProps> = ({
  showEasyNotesSidebar,
  setShowEasyNotesSidebar,
  showToast,
  onNoteSelect,
  onNoteDelete,
  currentCloudNote,
  refreshTrigger,
  onUpgradeClick
}) => {
  const { t } = useLanguage();
  // Use singleton CloudManager instance
  const [notes, setNotes] = useState<NoteMetadata[]>([]);
  const [providers, setProviders] = useState<Record<string, ProviderMetadata>>({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showNewNoteDialog, setShowNewNoteDialog] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');

  const [selectedProvider, setSelectedProvider] = useState<string>('googledrive');
  const [hasLicense, setHasLicense] = useState(LicenseManager.hasActiveLicense());

  // Delete confirmation modal state
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    noteToDelete: NoteMetadata | null;
  }>({
    isOpen: false,
    noteToDelete: null
  });

  // Enhanced loading states for specific operations
  const [operationStates, setOperationStates] = useState<{
    connecting: Record<string, boolean>;
    disconnecting: Record<string, boolean>;
    creatingNote: boolean;
    openingNote: Record<string, boolean>;
    authenticating: Record<string, boolean>;
    deletingNote: Record<string, boolean>;
  }>({
    connecting: {},
    disconnecting: {},
    creatingNote: false,
    openingNote: {},
    authenticating: {},
    deletingNote: {}
  });

  // Initialize CloudToastService with the showToast callback

  useEffect(() => {
    cloudToastService.initialize((message, type) => {
      // Convert loading type to info for the main app's toast system
      const appType = type === 'loading' ? 'info' : type as 'success' | 'error' | 'info' | 'warning';
      showToast(message, appType);
    });

    // Listen for offline state changes (for future UI updates)
    const handleOfflineStateChange = (state: any) => {
      // Could be used to show offline indicator in UI
      console.log('Offline state changed:', state.isOnline);
    };

    offlineManager.addListener(handleOfflineStateChange);

    // Subscribe to license changes
    const unsubscribeLicense = LicenseManager.subscribe(() => {
      setHasLicense(LicenseManager.hasActiveLicense());
    });

    return () => {
      offlineManager.removeListener(handleOfflineStateChange);
      unsubscribeLicense();
    };
  }, [showToast]);

  // Load notes and provider status on component mount
  useEffect(() => {
    if (showEasyNotesSidebar) {
      console.log('[EasyNotesSidebar] Sidebar opened, checking for post-redirect authentication...');
      checkPostRedirectAuth();
      loadNotesAndProviders();
    }
  }, [showEasyNotesSidebar]);

  // Refresh notes when refreshTrigger changes (e.g., after a note is saved)
  useEffect(() => {
    if (showEasyNotesSidebar && refreshTrigger && refreshTrigger > 0) {
      console.log('[EasyNotesSidebar] Refreshing notes due to external change, trigger:', refreshTrigger);
      loadNotesAndProviders();
    }
  }, [refreshTrigger, showEasyNotesSidebar]);

  const checkPostRedirectAuth = async () => {
    if (!cloudManager) {
      console.warn('[EasyNotesSidebar] CloudManager not available - feature disabled');
      return;
    }

    try {
      console.log('[EasyNotesSidebar] Checking if user is authenticated after redirect...');

      // Check if we have OAuth tokens in the URL (from redirect)
      const urlHash = window.location.hash;
      const hasOAuthTokens = urlHash.includes('id_token=') || urlHash.includes('access_token=');

      if (hasOAuthTokens) {
        console.log('[EasyNotesSidebar] OAuth tokens found in URL, processing redirect...');

        // Clear the URL hash to clean up FIRST to prevent loops
        window.history.replaceState(null, '', window.location.pathname);

        // Wait a moment for the URL to be cleaned
        await new Promise(resolve => setTimeout(resolve, 100));

        // Don't try to connect again - the redirect flow should have handled the authentication
        // Just reload the provider metadata to check if we're now connected
        console.log('[EasyNotesSidebar] Reloading provider metadata after OAuth redirect...');
        await loadNotesAndProviders();
        return;
      }

      // Check if Google Drive provider is already authenticated
      const availableProviders = await cloudManager.getAvailableProviders();
      const googleProvider = availableProviders.find(p => p.name === 'googledrive');
      if (googleProvider) {
        const isAuth = await googleProvider.isAuthenticated();
        console.log('[EasyNotesSidebar] Google Drive authenticated:', isAuth);

        if (isAuth) {
          console.log('[EasyNotesSidebar] User is authenticated, checking connection status...');
          // If authenticated but not connected, complete the connection
          const isConnected = await cloudManager.isProviderConnected('googledrive');
          console.log('[EasyNotesSidebar] Google Drive connected:', isConnected);

          if (!isConnected) {
            console.log('[EasyNotesSidebar] Authenticated but not connected, completing setup...');
            try {
              await cloudManager.connectProvider('googledrive');
              console.log('[EasyNotesSidebar] Connection completed successfully');
              showToast('Connected to Google Drive', 'success');
            } catch (error) {
              console.error('[EasyNotesSidebar] Failed to complete connection:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('[EasyNotesSidebar] Error checking post-redirect auth:', error);
    }
  };

  const loadNotesAndProviders = async () => {
    if (!cloudManager) {
      console.warn('[EasyNotesSidebar] CloudManager not available - feature disabled');
      return;
    }

    setLoading(true);
    try {
      // Load notes
      const notesList = await cloudManager.listNotes();
      console.log('[EasyNotesSidebar] Loaded notes with timestamps:', notesList.map(n => ({ id: n.id, title: n.title, lastModified: n.lastModified })));
      setNotes(notesList);

      // Load provider metadata
      const availableProviders = await cloudManager.getAvailableProviders();
      const providerMetadata: Record<string, ProviderMetadata> = {};

      for (const provider of availableProviders) {
        const metadata = await cloudManager.getProviderMetadata(provider.name);
        console.log(`[EasyNotesSidebar] Provider ${provider.name} metadata:`, metadata);

        if (metadata) {
          providerMetadata[provider.name] = metadata;
        } else {
          // Default metadata for unconnected providers
          providerMetadata[provider.name] = {
            connected: false,
            displayName: provider.displayName,
            icon: provider.icon
          };
        }
      }

      console.log('[EasyNotesSidebar] Final provider metadata:', providerMetadata);
      setProviders(providerMetadata);
    } catch (error) {
      console.error('Failed to load notes and providers:', error);
      showToast('Failed to load notes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectProvider = async (providerName: string) => {
    if (!cloudManager) {
      console.warn('[EasyNotesSidebar] CloudManager not available - feature disabled');
      showToast('Cloud features are disabled', 'error');
      return;
    }

    console.log('[EasyNotesSidebar] Connect button clicked for provider:', providerName);

    // Set specific loading state for this provider
    setOperationStates(prev => ({
      ...prev,
      connecting: { ...prev.connecting, [providerName]: true },
      authenticating: { ...prev.authenticating, [providerName]: true }
    }));

    console.log('[EasyNotesSidebar] Starting connection process...');

    try {
      const success = await cloudManager.connectProvider(providerName);
      console.log('[EasyNotesSidebar] Connect result:', success);

      if (success) {
        showToast(`Connected to ${providers[providerName]?.displayName || providerName}`, 'success');
        console.log('[EasyNotesSidebar] Reloading notes and providers...');
        await loadNotesAndProviders();
        console.log('[EasyNotesSidebar] Reload complete, providers:', providers);
      } else {
        showToast(`Failed to connect to ${providers[providerName]?.displayName || providerName}`, 'error');
      }
    } catch (error) {
      console.error(`Failed to connect to ${providerName}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // Show user-friendly error message
      if (errorMessage.includes('not yet configured')) {
        showToast('Google Drive integration will be available in a future update', 'info');
      } else {
        showToast(`Error connecting to ${providers[providerName]?.displayName || providerName}: ${errorMessage}`, 'error');
      }
    } finally {
      // Clear specific loading states
      setOperationStates(prev => ({
        ...prev,
        connecting: { ...prev.connecting, [providerName]: false },
        authenticating: { ...prev.authenticating, [providerName]: false }
      }));
    }
  };

  const handleDisconnectProvider = async (providerName: string) => {
    if (!cloudManager) {
      console.warn('[EasyNotesSidebar] CloudManager not available - feature disabled');
      showToast('Cloud features are disabled', 'error');
      return;
    }

    // Set specific loading state for disconnection
    setOperationStates(prev => ({
      ...prev,
      disconnecting: { ...prev.disconnecting, [providerName]: true }
    }));

    try {
      await cloudManager.disconnectProvider(providerName);
      showToast(`Disconnected from ${providers[providerName]?.displayName || providerName}`, 'success');
      await loadNotesAndProviders();
    } catch (error) {
      console.error(`Failed to disconnect from ${providerName}:`, error);
      showToast(`Error disconnecting from ${providers[providerName]?.displayName || providerName}`, 'error');
    } finally {
      // Clear disconnection loading state
      setOperationStates(prev => ({
        ...prev,
        disconnecting: { ...prev.disconnecting, [providerName]: false }
      }));
    }
  };

  const handleCreateNote = async () => {
    if (!cloudManager) {
      console.warn('[EasyNotesSidebar] CloudManager not available - feature disabled');
      showToast('Cloud features are disabled', 'error');
      return;
    }

    if (!newNoteTitle.trim()) {
      showToast('Please enter a note title', 'warning');
      return;
    }

    if (!providers[selectedProvider]?.connected) {
      showToast('Please connect to a cloud provider first', 'warning');
      return;
    }

    // Set specific loading state for note creation
    setOperationStates(prev => ({
      ...prev,
      creatingNote: true
    }));

    try {
      const newNote = await cloudManager.createNote(selectedProvider, newNoteTitle.trim());
      showToast(`Created note "${newNote.title}"`, 'success');
      setNewNoteTitle('');
      setShowNewNoteDialog(false);
      await loadNotesAndProviders();
    } catch (error) {
      console.error('Failed to create note:', error);
      showToast('Failed to create note', 'error');
    } finally {
      // Clear note creation loading state
      setOperationStates(prev => ({
        ...prev,
        creatingNote: false
      }));
    }
  };

  const handleOpenNote = async (note: NoteMetadata) => {
    if (!cloudManager) {
      console.warn('[EasyNotesSidebar] CloudManager not available - feature disabled');
      showToast('Cloud features are disabled', 'error');
      return;
    }

    // Set specific loading state for this note
    setOperationStates(prev => ({
      ...prev,
      openingNote: { ...prev.openingNote, [note.id]: true }
    }));

    try {
      const content = await cloudManager.openNote(note.id);
      if (onNoteSelect) {
        onNoteSelect(note.id, content, note);
      }
      showToast(`Opened "${note.title}"`, 'success');
      // Close sidebar after successful load
      setShowEasyNotesSidebar(false);
    } catch (error) {
      console.error('Failed to open note:', error);
      showToast('Failed to open note', 'error');
    } finally {
      // Clear note opening loading state
      setOperationStates(prev => ({
        ...prev,
        openingNote: { ...prev.openingNote, [note.id]: false }
      }));
    }
  };

  const handleSyncNotes = async () => {
    if (!cloudManager) {
      console.warn('[EasyNotesSidebar] CloudManager not available - feature disabled');
      showToast('Cloud features are disabled', 'error');
      return;
    }

    setSyncing(true);
    try {
      const syncResult = await cloudManager.syncNotes();
      if (syncResult.success) {
        showToast(`Synced ${syncResult.filesProcessed} files`, 'success');
      } else {
        showToast(`Sync completed with ${syncResult.errors.length} errors`, 'warning');
      }
      await loadNotesAndProviders();
    } catch (error) {
      console.error('Failed to sync notes:', error);
      showToast('Failed to sync notes', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteNote = (note: NoteMetadata, event: React.MouseEvent) => {
    // Stop event propagation to prevent opening the note
    event.stopPropagation();

    // Show confirmation modal
    setDeleteConfirmModal({
      isOpen: true,
      noteToDelete: note
    });
  };

  const confirmDeleteNote = async () => {
    if (!cloudManager) {
      console.warn('[EasyNotesSidebar] CloudManager not available - feature disabled');
      showToast('Cloud features are disabled', 'error');
      return;
    }

    const note = deleteConfirmModal.noteToDelete;
    if (!note) return;

    // Close modal
    setDeleteConfirmModal({ isOpen: false, noteToDelete: null });

    // Set specific loading state for this note
    setOperationStates(prev => ({
      ...prev,
      deletingNote: { ...prev.deletingNote, [note.id]: true }
    }));

    try {
      await cloudManager.deleteNote(note.id);
      showToast(`Deleted "${note.title}"`, 'success');

      // Notify parent component if this was the currently open note
      if (onNoteDelete) {
        onNoteDelete(note.id);
      }

      await loadNotesAndProviders();
    } catch (error) {
      console.error('Failed to delete note:', error);
      showToast('Failed to delete note', 'error');
    } finally {
      // Clear note deletion loading state
      setOperationStates(prev => ({
        ...prev,
        deletingNote: { ...prev.deletingNote, [note.id]: false }
      }));
    }
  };

  const cancelDeleteNote = () => {
    setDeleteConfirmModal({ isOpen: false, noteToDelete: null });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getConnectedProviders = () => {
    return Object.entries(providers).filter(([_, metadata]) => metadata.connected);
  };

  const handleUpgradeClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (onUpgradeClick) {
      onUpgradeClick();
      return;
    }
    const url = 'https://easyeditor.co.uk/#pricing';

    if (isTauriEnvironment()) {
      try {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(url);
      } catch (err) {
        console.error('Failed to open URL', err);
        showToast('Failed to open browser', 'error');
      }
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };


  // Calculate notes per column for overflow columns (which only have a small heading)
  const getNotesPerColumn = () => {
    const overflowHeaderHeight = 75; // heading (~16px font + 15px margin) + padding (40px top+bottom) + border offset
    const noteItemHeight = 75;
    const availableHeight = window.innerHeight - 120 - overflowHeaderHeight;
    return Math.max(1, Math.floor(availableHeight / noteItemHeight));
  };

  const [columnCount, setColumnCount] = useState(1);
  const [firstColumnCapacity, setFirstColumnCapacity] = useState<number | null>(null);
  const firstColumnNotesRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close sidebar when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showEasyNotesSidebar &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setShowEasyNotesSidebar(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEasyNotesSidebar, setShowEasyNotesSidebar]);

  // Measure the actual available height in the first column's notes container
  const measureFirstColumnCapacity = useCallback(() => {
    if (firstColumnNotesRef.current && showEasyNotesSidebar) {
      const containerHeight = firstColumnNotesRef.current.clientHeight;
      // Subtract space used by the "Notes (N)" heading (~19px font + 15px margin = 34px)
      // and the container's paddingTop (20px)
      const headerAndPadding = 54;
      const usableHeight = containerHeight - headerAndPadding;
      const noteItemHeight = 75; // Height per note item including margin
      // Use floor so we only count notes that FULLY fit (no clipping)
      const capacity = Math.max(1, Math.floor(usableHeight / noteItemHeight));
      setFirstColumnCapacity(capacity);
      return capacity;
    }
    return null;
  }, [showEasyNotesSidebar]);

  // Update column count when notes change or window resizes
  useEffect(() => {
    const updateColumns = () => {
      if (showEasyNotesSidebar) {
        // Measure first column capacity from the actual DOM
        const measuredCapacity = measureFirstColumnCapacity();
        const col1Capacity = measuredCapacity ?? getNotesPerColumn();
        const otherColCapacity = getNotesPerColumn();

        // Calculate how many notes overflow from the first column
        const overflowNotes = Math.max(0, notes.length - col1Capacity);
        const extraColumnsNeeded = overflowNotes > 0 ? Math.ceil(overflowNotes / otherColCapacity) : 0;
        const totalColumns = 1 + extraColumnsNeeded;

        // Cap columns based on screen width
        const baseColumnWidth = 400;
        const screenWidth = window.innerWidth;
        const maxPossibleColumns = Math.max(1, Math.floor(screenWidth * 0.8 / baseColumnWidth));
        const newColumnCount = Math.min(totalColumns, maxPossibleColumns);

        setColumnCount(newColumnCount);
      }
    };

    // Small delay to allow the DOM to render before measuring
    const timeoutId = setTimeout(updateColumns, 50);
    window.addEventListener('resize', updateColumns);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateColumns);
    };
  }, [notes.length, showEasyNotesSidebar, measureFirstColumnCapacity]);

  // Split notes into columns, using measured first-column capacity
  const getNotesForColumn = (columnIndex: number) => {
    const col1Capacity = firstColumnCapacity ?? getNotesPerColumn();
    const otherColCapacity = getNotesPerColumn();

    if (columnIndex === 0) {
      return notes.slice(0, col1Capacity);
    }

    // For subsequent columns, offset by first column capacity then use standard capacity
    const startIndex = col1Capacity + (columnIndex - 1) * otherColCapacity;
    const endIndex = startIndex + otherColCapacity;
    return notes.slice(startIndex, endIndex);
  };

  const sidebarWidth = columnCount * 400;

  // Helper function to render a note item
  const renderNoteItem = (note: NoteMetadata) => {
    const providerMetadata = providers[note.provider];
    return (
      <div
        key={note.id}
        onClick={() => !operationStates.openingNote[note.id] && handleOpenNote(note)}
        style={{
          padding: '10px 12px',
          marginBottom: '8px',
          backgroundColor: operationStates.openingNote[note.id] ? 'var(--bg-primary-light)' : 'var(--bg-dropdown-hover)',
          border: '1px solid var(--border-secondary)',
          borderRadius: '6px',
          cursor: operationStates.openingNote[note.id] ? 'wait' : 'pointer',
          transition: 'background-color 0.2s',
          opacity: operationStates.openingNote[note.id] ? 0.8 : 1,
          boxSizing: 'border-box',
          width: '100%',
          overflow: 'hidden'
        }}
        onMouseEnter={(e) => {
          if (!operationStates.openingNote[note.id]) {
            e.currentTarget.style.backgroundColor = 'var(--bg-primary-light)';
          }
        }}
        onMouseLeave={(e) => {
          if (!operationStates.openingNote[note.id]) {
            e.currentTarget.style.backgroundColor = 'var(--bg-dropdown-hover)';
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontSize: '14px', flexShrink: 0 }}>{providerMetadata?.icon || '📄'}</span>
            {(note.fileName?.endsWith('.sstp') || note.title.endsWith('.sstp')) && (
              <FaKey style={{ fontSize: '12px', color: 'var(--color-text-light)', flexShrink: 0 }} title="Backups encrypted" />
            )}
            <span style={{ fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title}</span>
            {currentCloudNote?.noteId === note.id && (
              <span style={{ fontSize: '14px', flexShrink: 0 }} title="Currently open">🔥</span>
            )}
            {operationStates.openingNote[note.id] && (
              <FaSync className="fa-spin" style={{ fontSize: '12px', color: 'var(--color-text-light)', flexShrink: 0 }} />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-light)' }}>
              {formatDate(note.lastModified)}
            </span>
            <button
              onClick={(e) => handleDeleteNote(note, e)}
              disabled={operationStates.deletingNote[note.id] || operationStates.openingNote[note.id]}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--bg-error)',
                cursor: (operationStates.deletingNote[note.id] || operationStates.openingNote[note.id]) ? 'not-allowed' : 'pointer',
                padding: '2px 4px',
                borderRadius: '3px',
                fontSize: '12px',
                opacity: (operationStates.deletingNote[note.id] || operationStates.openingNote[note.id]) ? 0.6 : 0.7,
                transition: 'opacity 0.2s, background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '2px'
              }}
              title={operationStates.deletingNote[note.id] ? 'Deleting...' : 'Delete note'}
              onMouseEnter={(e) => {
                if (!operationStates.deletingNote[note.id] && !operationStates.openingNote[note.id]) {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.backgroundColor = 'var(--bg-error-light)';
                }
              }}
              onMouseLeave={(e) => {
                if (!operationStates.deletingNote[note.id] && !operationStates.openingNote[note.id]) {
                  e.currentTarget.style.opacity = '0.7';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {operationStates.deletingNote[note.id] ? (
                <FaSync className="fa-spin" style={{ fontSize: '10px' }} />
              ) : (
                <FaTrash style={{ fontSize: '10px' }} />
              )}
            </button>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-light)' }}>
          {providerMetadata?.displayName || note.provider} • {Math.round(note.size / 1024)}KB
        </div>
      </div>
    );
  };

  return (
    <div
      ref={sidebarRef}
      className={`easynotes-sidebar ${showEasyNotesSidebar ? 'easynotes-sidebar-open' : ''}`}
      style={{
        position: 'fixed',
        top: '120px', // Below the menu bars
        left: showEasyNotesSidebar ? '0' : `-${sidebarWidth + 35}px`,
        width: `${sidebarWidth}px`,
        height: 'calc(100vh - 120px)',
        backgroundColor: 'var(--bg-dropdown)',
        color: 'var(--color-text-dropdown)',
        zIndex: 1000000, // Higher than dropdowns (999999) but lower than modals (1000001)
        transition: 'left 0.3s ease-in-out, width 0.3s ease-in-out',
        borderRight: '2px solid var(--border-secondary)',
        boxShadow: showEasyNotesSidebar ? '2px 0 10px var(--shadow-md)' : 'none',
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden'
      }}
    >
      {/* First Column - Header, Providers, Actions, and first set of notes */}
      <div style={{
        width: '400px',
        minWidth: '400px',
        maxWidth: '400px',
        padding: '20px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
            <FaStickyNote style={{ marginRight: '10px' }} />
            EasyNotes
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CloudSyncIndicator showDetails={false} />
            <button
              onClick={() => setShowEasyNotesSidebar(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-dropdown)',
                fontSize: '1.5rem',
                cursor: 'pointer',
                padding: '5px'
              }}
              title="Close EasyNotes"
            >
              ×
            </button>
          </div>
        </div>

        {/* Cloud Providers Section */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '10px', color: 'var(--color-text-dropdown)' }}>
            <FaCloud style={{ marginRight: '8px' }} />
            Cloud Providers
          </h3>

          {!hasLicense ? (
            <div style={{
              padding: '15px',
              backgroundColor: 'var(--bg-dropdown-hover)',
              border: '1px solid var(--border-secondary)',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              <p style={{ marginBottom: '10px', fontSize: '14px', color: 'var(--color-text-dropdown)' }}>
                {t('easynotes.premium_sync_message')}
              </p>
              <button
                onClick={handleUpgradeClick}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  gap: '5px'
                }}
              >
                {t('easynotes.enable_premium')}
              </button>
            </div>
          ) : (
            Object.entries(providers).map(([providerName, metadata]) => (
              <div key={providerName} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                marginBottom: '8px',
                backgroundColor: metadata.connected ? 'var(--bg-success-light)' : 'var(--bg-dropdown-hover)',
                border: '1px solid var(--border-secondary)',
                borderRadius: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>{metadata.icon}</span>
                  <span style={{ fontSize: '14px' }}>{metadata.displayName}</span>
                  {metadata.connected && metadata.lastSync && (
                    <span style={{ fontSize: '12px', color: 'var(--color-text-light)' }}>
                      {formatDate(metadata.lastSync)}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => metadata.connected ? handleDisconnectProvider(providerName) : handleConnectProvider(providerName)}
                  disabled={operationStates.connecting[providerName] || operationStates.disconnecting[providerName] || operationStates.authenticating[providerName]}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    backgroundColor: metadata.connected ? 'var(--bg-error)' : 'var(--bg-success)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: (operationStates.connecting[providerName] || operationStates.disconnecting[providerName] || operationStates.authenticating[providerName]) ? 'not-allowed' : 'pointer',
                    opacity: (operationStates.connecting[providerName] || operationStates.disconnecting[providerName] || operationStates.authenticating[providerName]) ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {(operationStates.connecting[providerName] || operationStates.authenticating[providerName]) && (
                    <FaSync className="fa-spin" style={{ fontSize: '10px' }} />
                  )}
                  {operationStates.disconnecting[providerName] && (
                    <FaSync className="fa-spin" style={{ fontSize: '10px' }} />
                  )}
                  {operationStates.connecting[providerName] ? 'Connecting...' :
                    operationStates.authenticating[providerName] ? 'Authenticating...' :
                      operationStates.disconnecting[providerName] ? 'Disconnecting...' :
                        metadata.connected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Actions Section */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button
              onClick={() => {
                // Auto-select first connected provider when opening dialog
                const connected = getConnectedProviders();
                if (connected.length > 0 && !providers[selectedProvider]?.connected) {
                  setSelectedProvider(connected[0][0]);
                }
                setShowNewNoteDialog(true);
              }}
              disabled={loading || operationStates.creatingNote || getConnectedProviders().length === 0}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: 'var(--bg-success)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: (loading || operationStates.creatingNote || getConnectedProviders().length === 0) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                opacity: (loading || operationStates.creatingNote || getConnectedProviders().length === 0) ? 0.6 : 1
              }}
            >
              {operationStates.creatingNote ? (
                <>
                  <FaSync className="fa-spin" /> Creating...
                </>
              ) : (
                <>
                  <FaPlus /> New Note
                </>
              )}
            </button>

            <button
              onClick={handleSyncNotes}
              disabled={loading || syncing || getConnectedProviders().length === 0}
              style={{
                padding: '10px',
                backgroundColor: 'var(--bg-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: (loading || syncing || getConnectedProviders().length === 0) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: (loading || syncing || getConnectedProviders().length === 0) ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title={syncing ? 'Syncing notes...' : 'Sync notes'}
            >
              <FaSync className={syncing ? 'fa-spin' : ''} />
              {syncing && <span style={{ fontSize: '12px' }}>Syncing</span>}
            </button>
          </div>
        </div>

        {/* Notes List - First Column */}
        <div ref={firstColumnNotesRef} style={{ borderTop: '1px solid var(--border-secondary)', paddingTop: '20px', flex: 1, overflow: 'hidden' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', color: 'var(--color-text-dropdown)' }}>
            Notes ({notes.length})
          </h3>

          {loading && (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-light)' }}>
              <FaSync className="fa-spin" style={{ marginRight: '8px' }} />
              Loading...
            </div>
          )}

          {!loading && notes.length === 0 && (
            <p style={{ color: 'var(--color-text-light)', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
              {getConnectedProviders().length === 0
                ? t('easynotes.connect_cloud_provider')
                : 'No notes yet. Create your first note!'
              }
            </p>
          )}

          {!loading && notes.length > 0 && (
            <div>
              {getNotesForColumn(0).map((note) => renderNoteItem(note))}
            </div>
          )}
        </div>
      </div>

      {/* Additional Columns for overflow notes */}
      {columnCount > 1 && Array.from({ length: columnCount - 1 }, (_, i) => i + 1).map((colIndex) => {
        const columnNotes = getNotesForColumn(colIndex);
        if (columnNotes.length === 0) return null;

        return (
          <div
            key={`column-${colIndex}`}
            style={{
              width: '400px',
              minWidth: '400px',
              maxWidth: '400px',
              padding: '20px',
              borderLeft: '1px solid var(--border-secondary)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box'
            }}
          >
            <h3 style={{ fontSize: '1rem', marginBottom: '15px', color: 'var(--color-text-dropdown)' }}>
              EasyNotes ({t('easynotes.continued')})
            </h3>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {columnNotes.map((note) => renderNoteItem(note))}
            </div>
          </div>
        );
      })}

      {/* New Note Dialog */}
      {showNewNoteDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-dropdown)',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid var(--border-secondary)',
            minWidth: '300px',
            maxWidth: '400px'
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem' }}>Create New Note</h3>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                Note Title:
              </label>
              <input
                type="text"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                placeholder="Enter note title..."
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid var(--border-secondary)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--color-text)',
                  fontSize: '14px'
                }}
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateNote();
                  }
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                Cloud Provider:
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid var(--border-secondary)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--color-text)',
                  fontSize: '14px'
                }}
              >
                {getConnectedProviders().map(([providerName, metadata]) => (
                  <option key={providerName} value={providerName}>
                    {metadata.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowNewNoteDialog(false);
                  setNewNoteTitle('');
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--border-secondary)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNote}
                disabled={!newNoteTitle.trim() || operationStates.creatingNote}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--bg-success)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (!newNoteTitle.trim() || operationStates.creatingNote) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  opacity: (!newNoteTitle.trim() || operationStates.creatingNote) ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {operationStates.creatingNote && <FaSync className="fa-spin" style={{ fontSize: '12px' }} />}
                {operationStates.creatingNote ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmModal.isOpen}
        title="Delete Note"
        message={`Are you sure you want to delete "${deleteConfirmModal.noteToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonColor="var(--bg-error)"
        onConfirm={confirmDeleteNote}
        onCancel={cancelDeleteNote}
        icon={<FaTrash style={{ color: 'var(--bg-error)', fontSize: '20px' }} />}
      />
    </div>
  );
};

export default EasyNotesSidebar;
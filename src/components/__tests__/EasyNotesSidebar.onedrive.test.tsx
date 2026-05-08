/**
 * Unit tests for EasyNotes Sidebar OneDrive integration
 * Validates: Requirements 6.1, 6.3, 6.4, 6.7, 8.1, 8.2
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import EasyNotesSidebar from '../EasyNotesSidebar';

// Mock useLanguage hook
jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'easynotes.premium_sync_message': 'Upgrade to Premium to sync notes across devices',
        'easynotes.enable_premium': 'Enable Premium',
        'easynotes.connect_cloud_provider': 'Connect a cloud provider to get started',
        'easynotes.continued': 'continued',
      };
      return translations[key] ?? key;
    },
    language: 'en',
    setLanguage: jest.fn(),
    availableLanguages: [],
    importLanguage: jest.fn(),
    isLoading: false,
  }),
}));

// Mock environment utility
jest.mock('../../utils/environment', () => ({
  isTauriEnvironment: jest.fn().mockReturnValue(false),
}));

// Mock CloudSyncIndicator
jest.mock('../CloudSyncIndicator', () => {
  return function MockCloudSyncIndicator() {
    return <div data-testid="cloud-sync-indicator" />;
  };
});

// Mock ConfirmationModal
jest.mock('../ConfirmationModal', () => {
  return function MockConfirmationModal() {
    return null;
  };
});

// Mock offlineManager
jest.mock('../../cloud/utils/OfflineManager', () => ({
  offlineManager: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    isCurrentlyOnline: jest.fn().mockReturnValue(true),
  },
}));

// Mock cloudToastService
jest.mock('../../cloud/utils/CloudToastService', () => ({
  cloudToastService: {
    initialize: jest.fn(),
    showLoading: jest.fn(),
    updateProgress: jest.fn(),
    completeOperation: jest.fn(),
    showError: jest.fn(),
    showConnectionStatus: jest.fn(),
    showWarning: jest.fn(),
  },
}));

// Mock LicenseManager
const mockHasActiveLicense = jest.fn().mockReturnValue(true);
const mockSubscribe = jest.fn().mockReturnValue(jest.fn());
jest.mock('../../premium/LicenseManager', () => ({
  __esModule: true,
  default: {
    hasActiveLicense: () => mockHasActiveLicense(),
    subscribe: (listener: () => void) => mockSubscribe(listener),
    getStoredEmail: jest.fn().mockReturnValue(null),
  },
}));

// Mock cloudManager
const mockGetAvailableProviders = jest.fn();
const mockGetProviderMetadata = jest.fn();
const mockConnectProvider = jest.fn();
const mockDisconnectProvider = jest.fn();
const mockListNotes = jest.fn();

jest.mock('../../cloud/managers/CloudManager', () => ({
  cloudManager: {
    getAvailableProviders: () => mockGetAvailableProviders(),
    getProviderMetadata: (name: string) => mockGetProviderMetadata(name),
    connectProvider: (name: string) => mockConnectProvider(name),
    disconnectProvider: (name: string) => mockDisconnectProvider(name),
    listNotes: () => mockListNotes(),
    isProviderConnected: jest.fn().mockResolvedValue(false),
    syncNotes: jest.fn().mockResolvedValue({ success: true, filesProcessed: 0, errors: [] }),
  },
}));

describe('EasyNotesSidebar - OneDrive Integration', () => {
  const defaultProps = {
    showEasyNotesSidebar: true,
    setShowEasyNotesSidebar: jest.fn(),
    showToast: jest.fn(),
    onNoteSelect: jest.fn(),
    onNoteDelete: jest.fn(),
    currentCloudNote: null,
    refreshTrigger: 0,
    onUpgradeClick: jest.fn(),
  };

  const mockOneDriveProvider = {
    name: 'onedrive',
    displayName: 'OneDrive',
    icon: '☁️',
    authenticate: jest.fn(),
    isAuthenticated: jest.fn().mockResolvedValue(false),
    disconnect: jest.fn(),
    createApplicationFolder: jest.fn(),
    listFiles: jest.fn(),
    downloadFile: jest.fn(),
    uploadFile: jest.fn(),
    updateFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  const mockGoogleDriveProvider = {
    name: 'googledrive',
    displayName: 'Google Drive',
    icon: '📁',
    authenticate: jest.fn(),
    isAuthenticated: jest.fn().mockResolvedValue(false),
    disconnect: jest.fn(),
    createApplicationFolder: jest.fn(),
    listFiles: jest.fn(),
    downloadFile: jest.fn(),
    uploadFile: jest.fn(),
    updateFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  const mockDropboxProvider = {
    name: 'dropbox',
    displayName: 'Dropbox',
    icon: '💧',
    authenticate: jest.fn(),
    isAuthenticated: jest.fn().mockResolvedValue(false),
    disconnect: jest.fn(),
    createApplicationFolder: jest.fn(),
    listFiles: jest.fn(),
    downloadFile: jest.fn(),
    uploadFile: jest.fn(),
    updateFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  const mockBoxProvider = {
    name: 'box',
    displayName: 'Box',
    icon: '📦',
    authenticate: jest.fn(),
    isAuthenticated: jest.fn().mockResolvedValue(false),
    disconnect: jest.fn(),
    createApplicationFolder: jest.fn(),
    listFiles: jest.fn(),
    downloadFile: jest.fn(),
    uploadFile: jest.fn(),
    updateFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockHasActiveLicense.mockReturnValue(true);
    mockListNotes.mockResolvedValue([]);
    mockGetAvailableProviders.mockResolvedValue([
      mockGoogleDriveProvider,
      mockDropboxProvider,
      mockBoxProvider,
      mockOneDriveProvider,
    ]);
    mockGetProviderMetadata.mockImplementation((name: string) => {
      const metadata: Record<string, any> = {
        googledrive: { connected: false, displayName: 'Google Drive', icon: '📁' },
        dropbox: { connected: false, displayName: 'Dropbox', icon: '💧' },
        box: { connected: false, displayName: 'Box', icon: '📦' },
        onedrive: { connected: false, displayName: 'OneDrive', icon: '☁️' },
      };
      return Promise.resolve(metadata[name] || null);
    });
  });

  describe('OneDrive appears in provider list (Req 6.1)', () => {
    test('displays OneDrive with its displayName and icon alongside other providers', async () => {
      await act(async () => {
        render(<EasyNotesSidebar {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('OneDrive')).toBeInTheDocument();
        expect(screen.getByText('☁️')).toBeInTheDocument();
      });

      // Other providers should also be present
      expect(screen.getByText('Google Drive')).toBeInTheDocument();
      expect(screen.getByText('Dropbox')).toBeInTheDocument();
      expect(screen.getByText('Box')).toBeInTheDocument();
    });

    test('displays OneDrive icon distinct from other provider icons', async () => {
      await act(async () => {
        render(<EasyNotesSidebar {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('☁️')).toBeInTheDocument();
        expect(screen.getByText('📁')).toBeInTheDocument();
        expect(screen.getByText('💧')).toBeInTheDocument();
        expect(screen.getByText('📦')).toBeInTheDocument();
      });
    });
  });

  describe('Connect button triggers authentication (Req 6.3)', () => {
    test('clicking Connect on OneDrive triggers authentication flow', async () => {
      mockConnectProvider.mockResolvedValue(true);

      await act(async () => {
        render(<EasyNotesSidebar {...defaultProps} />);
      });

      // Wait for providers to load
      await waitFor(() => {
        expect(screen.getByText('OneDrive')).toBeInTheDocument();
      });

      // Find the Connect buttons - OneDrive should have one
      const connectButtons = screen.getAllByText('Connect');
      // Click the last Connect button (OneDrive is last in the list)
      const oneDriveConnectButton = connectButtons[connectButtons.length - 1];

      await act(async () => {
        fireEvent.click(oneDriveConnectButton);
      });

      expect(mockConnectProvider).toHaveBeenCalledWith('onedrive');
    });

    test('successful connection shows success toast and reloads providers', async () => {
      mockConnectProvider.mockResolvedValue(true);

      await act(async () => {
        render(<EasyNotesSidebar {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('OneDrive')).toBeInTheDocument();
      });

      const connectButtons = screen.getAllByText('Connect');
      const oneDriveConnectButton = connectButtons[connectButtons.length - 1];

      await act(async () => {
        fireEvent.click(oneDriveConnectButton);
      });

      await waitFor(() => {
        expect(defaultProps.showToast).toHaveBeenCalledWith(
          'Connected to OneDrive',
          'success'
        );
      });
    });
  });

  describe('Loading state during authentication (Req 6.3, 6.4)', () => {
    test('shows loading indicator on connect button during authentication', async () => {
      // Make connectProvider hang to simulate loading
      let resolveConnect: (value: boolean) => void;
      mockConnectProvider.mockImplementation(
        () => new Promise<boolean>((resolve) => { resolveConnect = resolve; })
      );

      await act(async () => {
        render(<EasyNotesSidebar {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('OneDrive')).toBeInTheDocument();
      });

      const connectButtons = screen.getAllByText('Connect');
      const oneDriveConnectButton = connectButtons[connectButtons.length - 1];

      await act(async () => {
        fireEvent.click(oneDriveConnectButton);
      });

      // Should show connecting/authenticating state
      await waitFor(() => {
        const connectingText = screen.queryByText('Connecting...') || screen.queryByText('Authenticating...');
        expect(connectingText).toBeInTheDocument();
      });

      // Resolve the connection
      await act(async () => {
        resolveConnect!(true);
      });
    });

    test('connect button is disabled during authentication', async () => {
      let resolveConnect: (value: boolean) => void;
      mockConnectProvider.mockImplementation(
        () => new Promise<boolean>((resolve) => { resolveConnect = resolve; })
      );

      await act(async () => {
        render(<EasyNotesSidebar {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('OneDrive')).toBeInTheDocument();
      });

      const connectButtons = screen.getAllByText('Connect');
      const oneDriveConnectButton = connectButtons[connectButtons.length - 1];

      await act(async () => {
        fireEvent.click(oneDriveConnectButton);
      });

      // The button should be disabled during authentication
      await waitFor(() => {
        const connectingBtn = screen.queryByText('Connecting...') || screen.queryByText('Authenticating...');
        if (connectingBtn) {
          expect(connectingBtn.closest('button')).toBeDisabled();
        }
      });

      // Resolve
      await act(async () => {
        resolveConnect!(true);
      });
    });
  });

  describe('Failed connection shows error (Req 6.7)', () => {
    test('displays error toast when connection fails', async () => {
      mockConnectProvider.mockResolvedValue(false);

      await act(async () => {
        render(<EasyNotesSidebar {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('OneDrive')).toBeInTheDocument();
      });

      const connectButtons = screen.getAllByText('Connect');
      const oneDriveConnectButton = connectButtons[connectButtons.length - 1];

      await act(async () => {
        fireEvent.click(oneDriveConnectButton);
      });

      await waitFor(() => {
        expect(defaultProps.showToast).toHaveBeenCalledWith(
          'Failed to connect to OneDrive',
          'error'
        );
      });
    });

    test('removes loading indicator after failed connection', async () => {
      mockConnectProvider.mockResolvedValue(false);

      await act(async () => {
        render(<EasyNotesSidebar {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('OneDrive')).toBeInTheDocument();
      });

      const connectButtons = screen.getAllByText('Connect');
      const oneDriveConnectButton = connectButtons[connectButtons.length - 1];

      await act(async () => {
        fireEvent.click(oneDriveConnectButton);
      });

      // After failure, loading state should be cleared
      await waitFor(() => {
        expect(screen.queryByText('Connecting...')).not.toBeInTheDocument();
        expect(screen.queryByText('Authenticating...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Disconnect removes notes and resets UI (Req 6.4, 11.3, 11.4)', () => {
    test('shows disconnect button when OneDrive is connected', async () => {
      mockGetProviderMetadata.mockImplementation((name: string) => {
        if (name === 'onedrive') {
          return Promise.resolve({
            connected: true,
            displayName: 'OneDrive',
            icon: '☁️',
            applicationFolderId: 'folder-123',
            lastSync: new Date(),
          });
        }
        return Promise.resolve({ connected: false, displayName: name, icon: '📁' });
      });

      await act(async () => {
        render(<EasyNotesSidebar {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Disconnect')).toBeInTheDocument();
      });
    });

    test('clicking disconnect calls disconnectProvider and reloads', async () => {
      mockGetProviderMetadata.mockImplementation((name: string) => {
        if (name === 'onedrive') {
          return Promise.resolve({
            connected: true,
            displayName: 'OneDrive',
            icon: '☁️',
            applicationFolderId: 'folder-123',
            lastSync: new Date(),
          });
        }
        return Promise.resolve({ connected: false, displayName: name, icon: '📁' });
      });
      mockDisconnectProvider.mockResolvedValue(undefined);

      await act(async () => {
        render(<EasyNotesSidebar {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Disconnect')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Disconnect'));
      });

      expect(mockDisconnectProvider).toHaveBeenCalledWith('onedrive');

      await waitFor(() => {
        expect(defaultProps.showToast).toHaveBeenCalledWith(
          'Disconnected from OneDrive',
          'success'
        );
      });
    });

    test('after disconnect, notes from OneDrive are removed from list', async () => {
      // First render with OneDrive connected and notes
      const oneDriveNotes = [
        {
          id: 'note-1',
          title: 'OneDrive Note',
          fileName: 'onedrive-note.md',
          provider: 'onedrive',
          cloudFileId: 'cloud-1',
          lastModified: new Date(),
          lastSynced: new Date(),
          size: 1024,
          checksum: 'abc',
        },
      ];

      mockListNotes.mockResolvedValueOnce(oneDriveNotes);
      mockGetProviderMetadata.mockImplementation((name: string) => {
        if (name === 'onedrive') {
          return Promise.resolve({
            connected: true,
            displayName: 'OneDrive',
            icon: '☁️',
            applicationFolderId: 'folder-123',
            lastSync: new Date(),
          });
        }
        return Promise.resolve({ connected: false, displayName: name, icon: '📁' });
      });

      await act(async () => {
        render(<EasyNotesSidebar {...defaultProps} />);
      });

      // Note should be visible initially
      await waitFor(() => {
        expect(screen.getByText('OneDrive Note')).toBeInTheDocument();
      });

      // Now simulate disconnect - after disconnect, notes list is empty
      mockDisconnectProvider.mockResolvedValue(undefined);
      mockListNotes.mockResolvedValueOnce([]);
      mockGetProviderMetadata.mockImplementation((name: string) => {
        return Promise.resolve({ connected: false, displayName: name === 'onedrive' ? 'OneDrive' : name, icon: name === 'onedrive' ? '☁️' : '📁' });
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Disconnect'));
      });

      await waitFor(() => {
        expect(screen.queryByText('OneDrive Note')).not.toBeInTheDocument();
      });
    });
  });

  describe('License gating hides OneDrive when no license (Req 8.1, 8.2)', () => {
    test('shows upgrade prompt instead of providers when no license', async () => {
      mockHasActiveLicense.mockReturnValue(false);

      await act(async () => {
        render(<EasyNotesSidebar {...defaultProps} />);
      });

      // Should show upgrade prompt
      await waitFor(() => {
        expect(screen.getByText('Upgrade to Premium to sync notes across devices')).toBeInTheDocument();
        expect(screen.getByText('Enable Premium')).toBeInTheDocument();
      });

      // Should NOT show OneDrive or other providers
      expect(screen.queryByText('OneDrive')).not.toBeInTheDocument();
      expect(screen.queryByText('Google Drive')).not.toBeInTheDocument();
    });

    test('shows providers including OneDrive when license is active', async () => {
      mockHasActiveLicense.mockReturnValue(true);

      await act(async () => {
        render(<EasyNotesSidebar {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('OneDrive')).toBeInTheDocument();
      });

      // Should NOT show upgrade prompt
      expect(screen.queryByText('Upgrade to Premium to sync notes across devices')).not.toBeInTheDocument();
    });

    test('upgrade button triggers onUpgradeClick callback', async () => {
      mockHasActiveLicense.mockReturnValue(false);

      await act(async () => {
        render(<EasyNotesSidebar {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Enable Premium')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Enable Premium'));
      });

      expect(defaultProps.onUpgradeClick).toHaveBeenCalled();
    });
  });
});

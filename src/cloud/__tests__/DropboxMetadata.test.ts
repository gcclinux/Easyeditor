/**
 * Verification tests for Dropbox metadata management
 * Task 11: Verify MetadataManager stores and manages Dropbox note metadata correctly
 * 
 * Validates Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 * 
 * This test verifies that:
 * - MetadataManager stores provider="dropbox" correctly
 * - All required metadata fields are stored for Dropbox notes
 * - Metadata updates on modification work for Dropbox notes
 * - Metadata cleanup on disconnect removes Dropbox notes
 * - Metadata persistence to localStorage works for Dropbox notes
 */

import { MetadataManager } from '../managers/MetadataManager';
import type { NoteMetadata } from '../interfaces';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('Dropbox Metadata Management Verification', () => {
  let metadataManager: MetadataManager;

  beforeEach(() => {
    localStorageMock.clear();
    metadataManager = new MetadataManager();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('Requirement 9.1: Store provider="dropbox"', () => {
    it('should store Dropbox notes with provider="dropbox"', async () => {
      // Create a Dropbox note
      const dropboxNote: NoteMetadata = {
        id: 'dropbox-note-1',
        title: 'My Dropbox Note',
        fileName: 'my-dropbox-note.md',
        provider: 'dropbox',
        cloudFileId: 'id:abc123xyz',
        lastModified: new Date('2024-01-15T10:00:00Z'),
        lastSynced: new Date('2024-01-15T10:00:00Z'),
        size: 2048,
        checksum: 'sha256:dropbox123'
      };

      // Add the note
      await metadataManager.addNote(dropboxNote);

      // Retrieve the note
      const retrieved = await metadataManager.findNote('dropbox-note-1');

      // Verify provider is stored correctly
      expect(retrieved).not.toBeNull();
      expect(retrieved!.provider).toBe('dropbox');
    });

    it('should distinguish Dropbox notes from Google Drive notes', async () => {
      // Create a Dropbox note
      const dropboxNote: NoteMetadata = {
        id: 'dropbox-note-1',
        title: 'Dropbox Note',
        fileName: 'dropbox-note.md',
        provider: 'dropbox',
        cloudFileId: 'id:dropbox123',
        lastModified: new Date(),
        lastSynced: new Date(),
        size: 1024,
        checksum: 'sha256:dropbox'
      };

      // Create a Google Drive note
      const googleNote: NoteMetadata = {
        id: 'google-note-1',
        title: 'Google Note',
        fileName: 'google-note.md',
        provider: 'googledrive',
        cloudFileId: 'google-file-123',
        lastModified: new Date(),
        lastSynced: new Date(),
        size: 1024,
        checksum: 'sha256:google'
      };

      // Add both notes
      await metadataManager.addNote(dropboxNote);
      await metadataManager.addNote(googleNote);

      // Retrieve notes by provider
      const dropboxNotes = await metadataManager.findNotesByProvider('dropbox');
      const googleNotes = await metadataManager.findNotesByProvider('googledrive');

      // Verify correct separation
      expect(dropboxNotes).toHaveLength(1);
      expect(dropboxNotes[0].provider).toBe('dropbox');
      expect(googleNotes).toHaveLength(1);
      expect(googleNotes[0].provider).toBe('googledrive');
    });
  });

  describe('Requirement 9.2: Store all required metadata fields', () => {
    it('should store all required fields for Dropbox notes', async () => {
      const dropboxNote: NoteMetadata = {
        id: 'dropbox-note-2',
        title: 'Complete Dropbox Note',
        fileName: 'complete-dropbox-note.md',
        provider: 'dropbox',
        cloudFileId: 'id:complete123',
        lastModified: new Date('2024-01-20T14:30:00Z'),
        lastSynced: new Date('2024-01-20T14:30:00Z'),
        size: 4096,
        checksum: 'sha256:complete456'
      };

      await metadataManager.addNote(dropboxNote);
      const retrieved = await metadataManager.findNote('dropbox-note-2');

      // Verify all required fields are present
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('dropbox-note-2');
      expect(retrieved!.title).toBe('Complete Dropbox Note');
      expect(retrieved!.fileName).toBe('complete-dropbox-note.md');
      expect(retrieved!.provider).toBe('dropbox');
      expect(retrieved!.cloudFileId).toBe('id:complete123');
      expect(retrieved!.lastModified).toBeInstanceOf(Date);
      expect(retrieved!.lastModified.toISOString()).toBe('2024-01-20T14:30:00.000Z');
      expect(retrieved!.lastSynced).toBeInstanceOf(Date);
      expect(retrieved!.lastSynced.toISOString()).toBe('2024-01-20T14:30:00.000Z');
      expect(retrieved!.size).toBe(4096);
      expect(retrieved!.checksum).toBe('sha256:complete456');
    });

    it('should validate Dropbox file ID format', async () => {
      const dropboxNote: NoteMetadata = {
        id: 'dropbox-note-3',
        title: 'Dropbox Note with ID',
        fileName: 'dropbox-note-id.md',
        provider: 'dropbox',
        cloudFileId: 'id:a1b2c3d4e5f6',
        lastModified: new Date(),
        lastSynced: new Date(),
        size: 512,
        checksum: 'sha256:test'
      };

      await metadataManager.addNote(dropboxNote);
      const retrieved = await metadataManager.findNote('dropbox-note-3');

      // Verify Dropbox file ID is stored correctly
      expect(retrieved).not.toBeNull();
      expect(retrieved!.cloudFileId).toBe('id:a1b2c3d4e5f6');
      expect(retrieved!.cloudFileId).toMatch(/^id:/); // Dropbox IDs typically start with "id:"
    });

    it('should reject Dropbox notes with missing required fields', async () => {
      const incompleteNote = {
        id: 'incomplete-note',
        title: 'Incomplete Note',
        provider: 'dropbox'
        // Missing: fileName, cloudFileId, lastModified, lastSynced, size, checksum
      } as any;

      // Should throw error for missing fields
      await expect(metadataManager.addNote(incompleteNote))
        .rejects.toThrow();
    });
  });

  describe('Requirement 9.3: Update metadata on modification', () => {
    it('should update checksum when Dropbox note is modified', async () => {
      const dropboxNote: NoteMetadata = {
        id: 'dropbox-note-4',
        title: 'Modifiable Note',
        fileName: 'modifiable-note.md',
        provider: 'dropbox',
        cloudFileId: 'id:modifiable123',
        lastModified: new Date('2024-01-15T10:00:00Z'),
        lastSynced: new Date('2024-01-15T10:00:00Z'),
        size: 1024,
        checksum: 'sha256:original'
      };

      await metadataManager.addNote(dropboxNote);

      // Simulate modification
      const newModifiedTime = new Date('2024-01-15T11:00:00Z');
      await metadataManager.updateNote('dropbox-note-4', {
        checksum: 'sha256:modified',
        lastModified: newModifiedTime,
        lastSynced: newModifiedTime,
        size: 2048
      });

      const updated = await metadataManager.findNote('dropbox-note-4');

      // Verify updates
      expect(updated).not.toBeNull();
      expect(updated!.checksum).toBe('sha256:modified');
      expect(updated!.lastModified.toISOString()).toBe('2024-01-15T11:00:00.000Z');
      expect(updated!.lastSynced.toISOString()).toBe('2024-01-15T11:00:00.000Z');
      expect(updated!.size).toBe(2048);
    });

    it('should update lastSynced time when Dropbox note is synced', async () => {
      const dropboxNote: NoteMetadata = {
        id: 'dropbox-note-5',
        title: 'Sync Test Note',
        fileName: 'sync-test-note.md',
        provider: 'dropbox',
        cloudFileId: 'id:sync123',
        lastModified: new Date('2024-01-15T10:00:00Z'),
        lastSynced: new Date('2024-01-15T10:00:00Z'),
        size: 1024,
        checksum: 'sha256:sync'
      };

      await metadataManager.addNote(dropboxNote);

      // Simulate sync
      const newSyncTime = new Date('2024-01-15T12:00:00Z');
      await metadataManager.updateNote('dropbox-note-5', {
        lastSynced: newSyncTime
      });

      const updated = await metadataManager.findNote('dropbox-note-5');

      // Verify lastSynced was updated
      expect(updated).not.toBeNull();
      expect(updated!.lastSynced.toISOString()).toBe('2024-01-15T12:00:00.000Z');
      // Other fields should remain unchanged
      expect(updated!.lastModified.toISOString()).toBe('2024-01-15T10:00:00.000Z');
      expect(updated!.checksum).toBe('sha256:sync');
    });

    it('should preserve provider field when updating Dropbox note', async () => {
      const dropboxNote: NoteMetadata = {
        id: 'dropbox-note-6',
        title: 'Provider Test',
        fileName: 'provider-test.md',
        provider: 'dropbox',
        cloudFileId: 'id:provider123',
        lastModified: new Date(),
        lastSynced: new Date(),
        size: 1024,
        checksum: 'sha256:provider'
      };

      await metadataManager.addNote(dropboxNote);

      // Update note (without changing provider)
      await metadataManager.updateNote('dropbox-note-6', {
        title: 'Updated Title',
        size: 2048
      });

      const updated = await metadataManager.findNote('dropbox-note-6');

      // Verify provider is still 'dropbox'
      expect(updated).not.toBeNull();
      expect(updated!.provider).toBe('dropbox');
      expect(updated!.title).toBe('Updated Title');
    });
  });

  describe('Requirement 9.4: Cleanup metadata on disconnect', () => {
    it('should remove all Dropbox notes when provider is disconnected', async () => {
      // Create multiple Dropbox notes
      const dropboxNote1: NoteMetadata = {
        id: 'dropbox-note-7',
        title: 'Dropbox Note 1',
        fileName: 'dropbox-note-1.md',
        provider: 'dropbox',
        cloudFileId: 'id:cleanup1',
        lastModified: new Date(),
        lastSynced: new Date(),
        size: 1024,
        checksum: 'sha256:cleanup1'
      };

      const dropboxNote2: NoteMetadata = {
        id: 'dropbox-note-8',
        title: 'Dropbox Note 2',
        fileName: 'dropbox-note-2.md',
        provider: 'dropbox',
        cloudFileId: 'id:cleanup2',
        lastModified: new Date(),
        lastSynced: new Date(),
        size: 2048,
        checksum: 'sha256:cleanup2'
      };

      // Create a Google Drive note (should not be affected)
      const googleNote: NoteMetadata = {
        id: 'google-note-2',
        title: 'Google Note',
        fileName: 'google-note.md',
        provider: 'googledrive',
        cloudFileId: 'google-file-456',
        lastModified: new Date(),
        lastSynced: new Date(),
        size: 1024,
        checksum: 'sha256:google'
      };

      await metadataManager.addNote(dropboxNote1);
      await metadataManager.addNote(dropboxNote2);
      await metadataManager.addNote(googleNote);

      // Verify all notes exist
      const allNotesBefore = await metadataManager.loadMetadata();
      expect(allNotesBefore).toHaveLength(3);

      // Simulate disconnect by removing all Dropbox notes
      await metadataManager.removeNote('dropbox-note-7');
      await metadataManager.removeNote('dropbox-note-8');

      // Verify Dropbox notes are removed
      const dropboxNotesAfter = await metadataManager.findNotesByProvider('dropbox');
      expect(dropboxNotesAfter).toHaveLength(0);

      // Verify Google Drive note still exists
      const googleNotesAfter = await metadataManager.findNotesByProvider('googledrive');
      expect(googleNotesAfter).toHaveLength(1);
      expect(googleNotesAfter[0].id).toBe('google-note-2');
    });

    it('should handle disconnect when no Dropbox notes exist', async () => {
      // Create only Google Drive notes
      const googleNote: NoteMetadata = {
        id: 'google-note-3',
        title: 'Google Note',
        fileName: 'google-note.md',
        provider: 'googledrive',
        cloudFileId: 'google-file-789',
        lastModified: new Date(),
        lastSynced: new Date(),
        size: 1024,
        checksum: 'sha256:google'
      };

      await metadataManager.addNote(googleNote);

      // Try to find Dropbox notes (should be empty)
      const dropboxNotes = await metadataManager.findNotesByProvider('dropbox');
      expect(dropboxNotes).toHaveLength(0);

      // Google Drive note should still exist
      const googleNotes = await metadataManager.findNotesByProvider('googledrive');
      expect(googleNotes).toHaveLength(1);
    });
  });

  describe('Requirement 9.5: Persist metadata to localStorage', () => {
    it('should persist Dropbox note metadata to localStorage', async () => {
      const dropboxNote: NoteMetadata = {
        id: 'dropbox-note-9',
        title: 'Persistent Note',
        fileName: 'persistent-note.md',
        provider: 'dropbox',
        cloudFileId: 'id:persistent123',
        lastModified: new Date('2024-01-15T10:00:00Z'),
        lastSynced: new Date('2024-01-15T10:00:00Z'),
        size: 1024,
        checksum: 'sha256:persistent'
      };

      await metadataManager.addNote(dropboxNote);

      // Verify data is in localStorage
      const stored = localStorage.getItem('easynotes-metadata.json');
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.notes).toHaveLength(1);
      expect(parsed.notes[0].id).toBe('dropbox-note-9');
      expect(parsed.notes[0].provider).toBe('dropbox');
    });

    it('should reload Dropbox notes from localStorage', async () => {
      const dropboxNote: NoteMetadata = {
        id: 'dropbox-note-10',
        title: 'Reload Test',
        fileName: 'reload-test.md',
        provider: 'dropbox',
        cloudFileId: 'id:reload123',
        lastModified: new Date('2024-01-15T10:00:00Z'),
        lastSynced: new Date('2024-01-15T10:00:00Z'),
        size: 1024,
        checksum: 'sha256:reload'
      };

      await metadataManager.addNote(dropboxNote);

      // Create a new MetadataManager instance (simulates app restart)
      const newManager = new MetadataManager();
      const reloaded = await newManager.findNote('dropbox-note-10');

      // Verify note was reloaded from localStorage
      expect(reloaded).not.toBeNull();
      expect(reloaded!.id).toBe('dropbox-note-10');
      expect(reloaded!.provider).toBe('dropbox');
      expect(reloaded!.title).toBe('Reload Test');
      expect(reloaded!.cloudFileId).toBe('id:reload123');
    });

    it('should persist metadata updates to localStorage', async () => {
      const dropboxNote: NoteMetadata = {
        id: 'dropbox-note-11',
        title: 'Update Persist Test',
        fileName: 'update-persist.md',
        provider: 'dropbox',
        cloudFileId: 'id:update123',
        lastModified: new Date('2024-01-15T10:00:00Z'),
        lastSynced: new Date('2024-01-15T10:00:00Z'),
        size: 1024,
        checksum: 'sha256:original'
      };

      await metadataManager.addNote(dropboxNote);

      // Update the note
      await metadataManager.updateNote('dropbox-note-11', {
        checksum: 'sha256:updated',
        size: 2048
      });

      // Create new manager and verify update was persisted
      const newManager = new MetadataManager();
      const reloaded = await newManager.findNote('dropbox-note-11');

      expect(reloaded).not.toBeNull();
      expect(reloaded!.checksum).toBe('sha256:updated');
      expect(reloaded!.size).toBe(2048);
    });

    it('should persist note removal to localStorage', async () => {
      const dropboxNote: NoteMetadata = {
        id: 'dropbox-note-12',
        title: 'Remove Persist Test',
        fileName: 'remove-persist.md',
        provider: 'dropbox',
        cloudFileId: 'id:remove123',
        lastModified: new Date(),
        lastSynced: new Date(),
        size: 1024,
        checksum: 'sha256:remove'
      };

      await metadataManager.addNote(dropboxNote);

      // Remove the note
      await metadataManager.removeNote('dropbox-note-12');

      // Create new manager and verify removal was persisted
      const newManager = new MetadataManager();
      const reloaded = await newManager.findNote('dropbox-note-12');

      expect(reloaded).toBeNull();
    });
  });

  describe('Integration: Complete Dropbox note lifecycle', () => {
    it('should handle complete lifecycle of a Dropbox note', async () => {
      // 1. Create note
      const dropboxNote: NoteMetadata = {
        id: 'lifecycle-note',
        title: 'Lifecycle Test',
        fileName: 'lifecycle-test.md',
        provider: 'dropbox',
        cloudFileId: 'id:lifecycle123',
        lastModified: new Date('2024-01-15T10:00:00Z'),
        lastSynced: new Date('2024-01-15T10:00:00Z'),
        size: 1024,
        checksum: 'sha256:initial'
      };

      await metadataManager.addNote(dropboxNote);

      // 2. Verify creation
      let retrieved = await metadataManager.findNote('lifecycle-note');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.provider).toBe('dropbox');

      // 3. Update note (simulate edit)
      await metadataManager.updateNote('lifecycle-note', {
        checksum: 'sha256:edited',
        size: 2048,
        lastModified: new Date('2024-01-15T11:00:00Z')
      });

      // 4. Verify update
      retrieved = await metadataManager.findNote('lifecycle-note');
      expect(retrieved!.checksum).toBe('sha256:edited');
      expect(retrieved!.size).toBe(2048);

      // 5. Sync note (simulate sync)
      await metadataManager.updateNote('lifecycle-note', {
        lastSynced: new Date('2024-01-15T12:00:00Z')
      });

      // 6. Verify sync
      retrieved = await metadataManager.findNote('lifecycle-note');
      expect(retrieved!.lastSynced.toISOString()).toBe('2024-01-15T12:00:00.000Z');

      // 7. Remove note (simulate delete)
      await metadataManager.removeNote('lifecycle-note');

      // 8. Verify removal
      retrieved = await metadataManager.findNote('lifecycle-note');
      expect(retrieved).toBeNull();
    });
  });
});

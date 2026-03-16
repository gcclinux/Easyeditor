/**
 * MetadataManager - Manages local note metadata for offline access and synchronization tracking
 */

import type { NoteMetadata, MetadataStore, ProviderMetadata } from '../interfaces';

export class MetadataManager {
  private metadataFile: string = 'easynotes-metadata.json';
  private metadata: MetadataStore | null = null;
  
  constructor() {
    // Initialize with empty metadata structure
    this.metadata = null;
  }
  
  /**
   * Load metadata from local storage, creating default structure if not found
   */
  async loadMetadata(): Promise<NoteMetadata[]> {
    try {
      if (this.metadata) {
        return this.metadata.notes;
      }

      // Try to load from localStorage first
      const stored = localStorage.getItem(this.metadataFile);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate and convert date strings back to Date objects
        this.metadata = this.validateAndNormalizeMetadata(parsed);
        return this.metadata.notes;
      }

      // Create default metadata structure if none exists
      this.metadata = this.createDefaultMetadata();
      await this.saveMetadata(this.metadata.notes);
      return this.metadata.notes;
    } catch (error) {
      console.warn('Failed to load metadata, creating new:', error);
      // If metadata is corrupted, create fresh metadata
      this.metadata = this.createDefaultMetadata();
      await this.saveMetadata(this.metadata.notes);
      return this.metadata.notes;
    }
  }
  
  /**
   * Save metadata to local storage
   */
  async saveMetadata(notes: NoteMetadata[]): Promise<void> {
    try {
      if (!this.metadata) {
        this.metadata = this.createDefaultMetadata();
      }
      
      this.metadata.notes = notes;
      this.metadata.lastUpdated = new Date();
      
      // Store in localStorage
      localStorage.setItem(this.metadataFile, JSON.stringify(this.metadata));
    } catch (error) {
      console.error('Failed to save metadata:', error);
      throw new Error(`Failed to save metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Add a new note to metadata
   */
  async addNote(note: NoteMetadata): Promise<void> {
    const notes = await this.loadMetadata();
    
    // Check if note already exists by id
    const existingIndex = notes.findIndex(n => n.id === note.id);
    if (existingIndex >= 0) {
      throw new Error(`Note with id ${note.id} already exists`);
    }

    // Check for duplicate cloudFileId (same cloud file already tracked)
    if (note.cloudFileId) {
      const duplicateCloudFile = notes.find(n => n.cloudFileId === note.cloudFileId);
      if (duplicateCloudFile) {
        console.log(`[MetadataManager] Note with cloudFileId ${note.cloudFileId} already exists (${duplicateCloudFile.title}), skipping`);
        return;
      }
    }
    
    // Validate note data
    this.validateNoteMetadata(note);
    
    notes.push(note);
    await this.saveMetadata(notes);
  }
  
  /**
   * Update an existing note's metadata
   */
  async updateNote(noteId: string, updates: Partial<NoteMetadata>): Promise<void> {
    const notes = await this.loadMetadata();
    const noteIndex = notes.findIndex(n => n.id === noteId);
    
    if (noteIndex === -1) {
      throw new Error(`Note with id ${noteId} not found`);
    }
    
    // Merge updates with existing note
    const updatedNote = { ...notes[noteIndex], ...updates };
    
    console.log('[MetadataManager] Updating note metadata:', {
      noteId,
      oldLastModified: notes[noteIndex].lastModified,
      newLastModified: updatedNote.lastModified,
      updates
    });
    
    // Validate updated note
    this.validateNoteMetadata(updatedNote);
    
    notes[noteIndex] = updatedNote;
    await this.saveMetadata(notes);
  }
  
  /**
   * Remove a note from metadata
   */
  async removeNote(noteId: string): Promise<void> {
    const notes = await this.loadMetadata();
    const filteredNotes = notes.filter(n => n.id !== noteId);
    
    if (filteredNotes.length === notes.length) {
      throw new Error(`Note with id ${noteId} not found`);
    }
    
    await this.saveMetadata(filteredNotes);
  }
  
  /**
   * Find a specific note by ID
   */
  async findNote(noteId: string): Promise<NoteMetadata | null> {
    const notes = await this.loadMetadata();
    return notes.find(n => n.id === noteId) || null;
  }
  
  /**
   * Find all notes for a specific provider
   */
  async findNotesByProvider(provider: string): Promise<NoteMetadata[]> {
    const notes = await this.loadMetadata();
    return notes.filter(n => n.provider === provider);
  }

  /**
   * Get provider metadata
   */
  async getProviderMetadata(provider: string): Promise<ProviderMetadata | null> {
    await this.loadMetadata(); // Ensure metadata is loaded
    return this.metadata?.providers[provider] || null;
  }

  /**
   * Update provider metadata
   */
  async updateProviderMetadata(provider: string, metadata: ProviderMetadata): Promise<void> {
    await this.loadMetadata(); // Ensure metadata is loaded
    if (!this.metadata) {
      this.metadata = this.createDefaultMetadata();
    }
    
    this.metadata.providers[provider] = metadata;
    await this.saveMetadata(this.metadata.notes);
  }

  /**
   * Rebuild metadata from cloud storage (corruption recovery)
   */
  async rebuildFromCloud(cloudNotes: NoteMetadata[]): Promise<void> {
    // Validate all cloud notes
    cloudNotes.forEach(note => this.validateNoteMetadata(note));
    
    // Create fresh metadata with cloud data
    this.metadata = this.createDefaultMetadata();
    await this.saveMetadata(cloudNotes);
  }

  /**
   * Create default metadata structure
   */
  private createDefaultMetadata(): MetadataStore {
    return {
      version: '1.0',
      lastUpdated: new Date(),
      notes: [],
      providers: {}
    };
  }

  /**
   * Validate and normalize metadata loaded from storage
   */
  private validateAndNormalizeMetadata(data: any): MetadataStore {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid metadata format');
    }

    // Ensure required fields exist
    const metadata: MetadataStore = {
      version: data.version || '1.0',
      lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : new Date(),
      notes: Array.isArray(data.notes) ? data.notes : [],
      providers: data.providers || {}
    };

    // Normalize note dates
    metadata.notes = metadata.notes.map(note => ({
      ...note,
      lastModified: new Date(note.lastModified),
      lastSynced: new Date(note.lastSynced)
    }));

    // Validate each note
    metadata.notes.forEach(note => this.validateNoteMetadata(note));

    return metadata;
  }

  /**
   * Validate note metadata structure
   */
  private validateNoteMetadata(note: NoteMetadata): void {
    const requiredFields = ['id', 'title', 'fileName', 'provider', 'cloudFileId', 'lastModified', 'lastSynced', 'size', 'checksum'];
    
    for (const field of requiredFields) {
      if (!(field in note) || note[field as keyof NoteMetadata] === undefined || note[field as keyof NoteMetadata] === null) {
        throw new Error(`Note metadata missing required field: ${field}`);
      }
    }

    // Validate data types
    if (typeof note.id !== 'string' || note.id.trim() === '') {
      throw new Error('Note id must be a non-empty string');
    }
    
    if (typeof note.title !== 'string' || note.title.trim() === '') {
      throw new Error('Note title must be a non-empty string');
    }
    
    if (typeof note.fileName !== 'string' || note.fileName.trim() === '') {
      throw new Error('Note fileName must be a non-empty string');
    }
    
    if (typeof note.provider !== 'string' || note.provider.trim() === '') {
      throw new Error('Note provider must be a non-empty string');
    }
    
    if (typeof note.cloudFileId !== 'string' || note.cloudFileId.trim() === '') {
      throw new Error('Note cloudFileId must be a non-empty string');
    }
    
    if (!(note.lastModified instanceof Date) || isNaN(note.lastModified.getTime())) {
      throw new Error('Note lastModified must be a valid Date');
    }
    
    if (!(note.lastSynced instanceof Date) || isNaN(note.lastSynced.getTime())) {
      throw new Error('Note lastSynced must be a valid Date');
    }
    
    if (typeof note.size !== 'number' || note.size < 0) {
      throw new Error('Note size must be a non-negative number');
    }
    
    if (typeof note.checksum !== 'string' || note.checksum.trim() === '') {
      throw new Error('Note checksum must be a non-empty string');
    }
  }
}
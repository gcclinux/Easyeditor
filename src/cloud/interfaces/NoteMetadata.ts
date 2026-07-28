/**
 * Note metadata interface for tracking cloud-stored notes locally
 */

export interface NoteMetadata {
  id: string;
  title: string;
  fileName: string;
  provider: string;
  cloudFileId: string;
  localPath?: string;
  lastModified: Date;
  lastSynced: Date;
  size: number;
  checksum: string;
  libraryId?: string;
  libraryName?: string;
}

export interface CloudCredentials {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope: string;
  userId?: string;
}

export interface MetadataStore {
  version: string;
  lastUpdated: Date;
  notes: NoteMetadata[];
  providers: Record<string, ProviderMetadata>;
}

export interface ProviderMetadata {
  connected: boolean;
  applicationFolderId?: string;
  lastSync?: Date;
  displayName: string;
  icon: string;
}
/**
 * Core interfaces for cloud provider integration
 * These interfaces define the contract for all cloud storage providers
 */

export interface CloudFile {
  id: string;
  name: string;
  modifiedTime: Date;
  size: number;
  mimeType: string;
  downloadUrl?: string;
}

export interface AuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
}

export interface CloudProvider {
  readonly name: string;
  readonly displayName: string;
  readonly icon: string;

  authenticate(): Promise<AuthResult>;
  isAuthenticated(): Promise<boolean>;
  disconnect(): Promise<void>;

  createApplicationFolder(): Promise<string>;
  listFiles(folderId: string): Promise<CloudFile[]>;
  downloadFile(fileId: string): Promise<string | Uint8Array>;
  uploadFile(folderId: string, fileName: string, content: string | Uint8Array): Promise<CloudFile>;
  updateFile(fileId: string, content: string | Uint8Array): Promise<CloudFile>;
  deleteFile(fileId: string): Promise<void>;
}

export interface SyncResult {
  success: boolean;
  filesProcessed: number;
  errors: string[];
  lastSyncTime: Date;
}
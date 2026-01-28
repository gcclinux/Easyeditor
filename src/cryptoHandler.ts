import { encryptTextToBytes, decryptBytesToText } from './stpFileCrypter';

export const encryptContent = async (
  content: string,
  showPasswordPrompt: (onSubmit: (password: string) => void) => void,
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
): Promise<void> => {
  showPasswordPrompt(async (password) => {
    if (!password || password.length < 8) {
      showToast('Password must be at least 8 characters long', 'warning');
      return;
    }

    try {
      const encrypted = encryptTextToBytes(content, password);
      // Ensure we pass an ArrayBuffer-backed ArrayBufferView to Blob to satisfy TypeScript
      const uint8 = encrypted instanceof Uint8Array ? encrypted : new Uint8Array(encrypted as any);

      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

      if (isTauri) {
        try {
          const { save } = await import('@tauri-apps/plugin-dialog');
          const { writeFile } = await import('@tauri-apps/plugin-fs');

          const filePath = await save({
            defaultPath: 'easyeditor.sstp',
            filters: [{
              name: 'Encrypted Document',
              extensions: ['sstp']
            }]
          });

          if (filePath) {
            await writeFile(filePath, uint8);
            showToast('File encrypted and saved successfully', 'success');
          }
        } catch (tauriError) {
          console.error('Tauri save failed:', tauriError);
          showToast('Failed to save via Tauri: ' + tauriError, 'error');
        }
      } else {
        // Web fallback
        const blob = new Blob([uint8.slice()], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'easyeditor.sstp';
        a.click();
        URL.revokeObjectURL(url);
        showToast('File encrypted and download started', 'success');
      }
    } catch (error) {
      showToast('Encryption failed: ' + (error as Error).message, 'error');
    }
  });
};

export const decryptFile = async (
  setEditorContent: (content: string) => void,
  showPasswordPrompt: (onSubmit: (password: string) => void) => void,
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
): Promise<void> => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.sstp';

  input.onchange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    showPasswordPrompt(async (password) => {
      if (!password) return;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const encrypted = new Uint8Array(arrayBuffer);
        const decrypted = decryptBytesToText(encrypted, password);
        setEditorContent(decrypted);
        showToast('File decrypted successfully', 'success');
      } catch (error) {
        showToast('Decryption failed: ' + (error as Error).message, 'error');
      }
    });
  };

  input.click();
};

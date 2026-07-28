import { LocalLibraryProvider } from '../providers/LocalLibraryProvider';

describe('LocalLibraryProvider', () => {
  let provider: LocalLibraryProvider;

  beforeEach(() => {
    localStorage.clear();
    provider = new LocalLibraryProvider();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize with correct name and icon', () => {
    expect(provider.name).toBe('locallibrary');
    expect(provider.displayName).toBe('Local Library');
    expect(provider.icon).toBe('📁');
  });

  it('should return false for isAuthenticated when not configured', async () => {
    const isAuth = await provider.isAuthenticated();
    expect(isAuth).toBe(false);
  });

  it('should return true for isAuthenticated when path is stored', async () => {
    localStorage.setItem('easynotes_locallibrary_path', '/path/to/notes');
    const isAuth = await provider.isAuthenticated();
    expect(isAuth).toBe(true);
    expect(provider.getStoredPath()).toBe('/path/to/notes');
  });

  it('should clear configuration on disconnect', async () => {
    localStorage.setItem('easynotes_locallibrary_path', '/path/to/notes');
    await provider.disconnect();
    expect(provider.getStoredPath()).toBeNull();
    const isAuth = await provider.isAuthenticated();
    expect(isAuth).toBe(false);
  });

  it('should return default folder name from createApplicationFolder', async () => {
    const folder = await provider.createApplicationFolder();
    expect(folder).toBe('locallibrary');

    localStorage.setItem('easynotes_locallibrary_path', '/my/custom/path');
    const folderCustom = await provider.createApplicationFolder();
    expect(folderCustom).toBe('/my/custom/path');
  });
});

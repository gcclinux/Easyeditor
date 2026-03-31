import { isTauriEnvironment } from '../utils/environment';

class LicenseManager {
  private static instance: LicenseManager;
  private activeLicense: boolean = false;
  private type: string = '';
  private checking: boolean = false;
  private STORAGE_KEY_CACHED_LICENSE = 'easyeditor-license-cached-valid';
  private API_ENDPOINT = 'https://easyeditor-premium.web.app/api/check-license';
  private STORAGE_KEY_EMAIL = 'easyeditor-user-email';
  private STORAGE_KEY_DATE = 'easyeditor-user-purchase-date';
  private STORAGE_KEY_TYPE = 'easyeditor-user-type';
  private STORAGE_KEY_LICENSE_KEY = 'easyeditor-user-license-key';

  private constructor() {
    // Immediately restore cached license state so components get the right
    // value on their very first render (before the async API check completes).
    this.restoreFromCache();
  }

  public static getInstance(): LicenseManager {
    if (!LicenseManager.instance) {
      LicenseManager.instance = new LicenseManager();
    }
    return LicenseManager.instance;
  }

  /**
   * Instantly restore last-known license state from localStorage.
   * This is synchronous and should be called before app render so the
   * UI can show the cached premium state without waiting for the network.
   */
  public restoreFromCache(): void {
    const email = this.getStoredEmail();
    const licenseKey = this.getStoredLicenseKey();
    const cachedValid = localStorage.getItem(this.STORAGE_KEY_CACHED_LICENSE);
    const storedType = this.getStoredType();

    const oldStatus = this.activeLicense;
    const oldType = this.type;

    if (email && licenseKey && cachedValid === 'true') {
      this.activeLicense = true;
      this.type = storedType || '';
      console.log('[LicenseManager] Restored from cache: active=true, type=', this.type);
    } else {
      this.activeLicense = false;
      this.type = '';
      console.log('[LicenseManager] No cached license found (email:', !!email, ', key:', !!licenseKey, ', cached:', cachedValid, ')');
    }

    // Notify listeners if state changed (so already-mounted components update)
    if (oldStatus !== this.activeLicense || oldType !== this.type) {
      this.notifyListeners();
    }
  }

  public async initialize(): Promise<void> {
    // Avoid multiple checks at the same time
    if (this.checking) {
      return;
    }
    this.checking = true;
    await this.checkLicenseStatus();
    this.checking = false;
  }

  public hasActiveLicense(): boolean {
    return this.activeLicense;
  }

  public getType(): string {
    return this.type;
  }

  public async setLicenseData(email: string, licenseKey: string): Promise<void> {
    localStorage.setItem(this.STORAGE_KEY_EMAIL, email);
    localStorage.setItem(this.STORAGE_KEY_LICENSE_KEY, licenseKey);
    // We don't set purchase date manually anymore, it comes from the server
    await this.checkLicenseStatus();
  }

  public getStoredEmail(): string | null {
    return localStorage.getItem(this.STORAGE_KEY_EMAIL);
  }

  public getStoredLicenseKey(): string | null {
    return localStorage.getItem(this.STORAGE_KEY_LICENSE_KEY);
  }

  public getStoredPurchaseDate(): string | null {
    return localStorage.getItem(this.STORAGE_KEY_DATE);
  }

  public getStoredType(): string | null {
    return localStorage.getItem(this.STORAGE_KEY_TYPE);
  }

  private listeners: (() => void)[] = [];

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private async checkLicenseStatus(): Promise<void> {
    const email = this.getStoredEmail();
    const licenseKey = this.getStoredLicenseKey();

    console.log('[LicenseManager] checkLicenseStatus: email=', !!email, ', key=', !!licenseKey);

    if (!email || !licenseKey) {
      const oldStatus = this.activeLicense;
      this.activeLicense = false;
      this.type = '';
      localStorage.removeItem(this.STORAGE_KEY_CACHED_LICENSE);
      console.log('[LicenseManager] No email/key stored, license cleared');
      if (oldStatus !== this.activeLicense) {
        this.notifyListeners();
      }
      return;
    }

    try {
      const fetchFn = isTauriEnvironment()
        ? (await import('@tauri-apps/plugin-http')).fetch
        : fetch;
      
      // Try to get API key from VITE_LICENSE_API, fallback to LICENSE_API if configured that way
      const apiKey = import.meta.env.VITE_LICENSE_API || import.meta.env.LICENSE_API || '';

      // Only send email as per new requirement
      const response = await fetchFn(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({ email }),
      });

      const oldStatus = this.activeLicense;
      const oldType = this.type;

      if (response.ok) {
        const data = await response.json();
        const isLicenseActive = data.hasActiveLicense === true || data.hasActiveLicense === 'True';
        
        console.log('[LicenseManager] API response: active=', isLicenseActive, ', email match=', data.email === email, ', key match=', data.linkedUserId === licenseKey);

        // Match user's email and licenseKey against the returned linkedUserId
        if (isLicenseActive && data.email === email && data.linkedUserId === licenseKey) {
          this.activeLicense = true;
          localStorage.setItem(this.STORAGE_KEY_CACHED_LICENSE, 'true');

          // Store type if available
          if (data.type) {
            this.type = data.type;
            localStorage.setItem(this.STORAGE_KEY_TYPE, this.type);
          } else {
            this.type = '';
            localStorage.removeItem(this.STORAGE_KEY_TYPE);
          }

          // Store purchaseDate if available (returned from server)
          if (data.purchaseDate) {
            localStorage.setItem(this.STORAGE_KEY_DATE, data.purchaseDate.toString());
          }
          console.log('[LicenseManager] License validated: type=', this.type);
        } else {
          this.activeLicense = false;
          this.type = '';
          localStorage.removeItem(this.STORAGE_KEY_CACHED_LICENSE);
          console.log('[LicenseManager] License validation failed');
        }
      } else {
        this.activeLicense = false;
        this.type = '';
        localStorage.removeItem(this.STORAGE_KEY_CACHED_LICENSE);
        console.error('[LicenseManager] API returned non-ok status:', response.status);
      }

      if (oldStatus !== this.activeLicense || oldType !== this.type) {
        this.notifyListeners();
      }
    } catch (error) {
      console.error('[LicenseManager] Error checking license status:', error);
      // On network failure, preserve the cached license state rather than
      // invalidating a genuine license just because the user is offline.
      const cachedValid = localStorage.getItem(this.STORAGE_KEY_CACHED_LICENSE);
      if (cachedValid === 'true') {
        console.log('[LicenseManager] Network error but cached license exists — keeping cached state');
        // Don't clear the license; keep the cached state so offline users
        // can still use premium features until the next successful check.
      } else {
        const oldStatus = this.activeLicense;
        this.activeLicense = false;
        this.type = '';
        if (oldStatus !== this.activeLicense) {
          this.notifyListeners();
        }
      }
    }
  }
}

export default LicenseManager.getInstance();

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { isTauriEnvironment } from '../utils/environment';

class LicenseManager {
  private static instance: LicenseManager;
  private activeLicense: boolean = false;
  private type: string = '';
  private checking: boolean = false;
  private API_ENDPOINT = 'https://easyeditor-premium.web.app/api/check-license';
  private STORAGE_KEY_EMAIL = 'easyeditor-user-email';
  private STORAGE_KEY_DATE = 'easyeditor-user-purchase-date';
  private STORAGE_KEY_TYPE = 'easyeditor-user-type';
  private STORAGE_KEY_LICENSE_KEY = 'easyeditor-user-license-key';

  private constructor() { }

  public static getInstance(): LicenseManager {
    if (!LicenseManager.instance) {
      LicenseManager.instance = new LicenseManager();
    }
    return LicenseManager.instance;
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

    if (!email || !licenseKey) {
      const oldStatus = this.activeLicense;
      this.activeLicense = false;
      this.type = '';
      if (oldStatus !== this.activeLicense) {
        this.notifyListeners();
      }
      return;
    }

    try {
      const fetchFn = isTauriEnvironment() ? tauriFetch : fetch;
      
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
        
        // Match user's email and licenseKey against the returned linkedUserId
        if (isLicenseActive && data.email === email && data.linkedUserId === licenseKey) {
          this.activeLicense = true;

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
        } else {
          this.activeLicense = false;
          this.type = '';
        }
      } else {
        this.activeLicense = false;
        this.type = '';
      }

      if (oldStatus !== this.activeLicense || oldType !== this.type) {
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error checking license status:', error);
      const oldStatus = this.activeLicense;
      this.activeLicense = false;
      // We keep the plan locally if we fail to check? Better to clear it to be safe or keep it cached?
      // For safety/validity, if check fails, we assume no license.
      // But maybe we should keep the cached values if network error?
      // Current implementation clears it. I'll stick to that.
      this.type = '';

      if (oldStatus !== this.activeLicense) {
        this.notifyListeners();
      }
    }
  }
}

export default LicenseManager.getInstance();

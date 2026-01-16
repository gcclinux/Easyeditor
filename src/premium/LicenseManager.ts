import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { isTauriEnvironment } from '../utils/environment';

class LicenseManager {
  private static instance: LicenseManager;
  private activeLicense: boolean = false;
  private plan: string = '';
  private checking: boolean = false;
  private API_ENDPOINT = 'https://easyeditor-premium.web.app/api/check-license';
  private STORAGE_KEY_EMAIL = 'easyeditor-user-email';
  private STORAGE_KEY_DATE = 'easyeditor-user-purchase-date';
  private STORAGE_KEY_PLAN = 'easyeditor-user-plan';

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

  public getPlan(): string {
    return this.plan;
  }

  public async setLicenseData(email: string): Promise<void> {
    localStorage.setItem(this.STORAGE_KEY_EMAIL, email);
    // We don't set purchase date manually anymore, it comes from the server
    await this.checkLicenseStatus();
  }

  public getStoredEmail(): string | null {
    return localStorage.getItem(this.STORAGE_KEY_EMAIL);
  }

  public getStoredPurchaseDate(): string | null {
    return localStorage.getItem(this.STORAGE_KEY_DATE);
  }

  public getStoredPlan(): string | null {
    return localStorage.getItem(this.STORAGE_KEY_PLAN);
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

    if (!email) {
      const oldStatus = this.activeLicense;
      this.activeLicense = false;
      this.plan = '';
      if (oldStatus !== this.activeLicense) {
        this.notifyListeners();
      }
      return;
    }

    try {
      const fetchFn = isTauriEnvironment() ? tauriFetch : fetch;

      // Only send email as per new requirement
      const response = await fetchFn(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const oldStatus = this.activeLicense;
      const oldPlan = this.plan;

      if (response.ok) {
        const data = await response.json();
        // Check for "True" string or true boolean
        this.activeLicense = data.hasActiveLicense === true || data.hasActiveLicense === 'True';

        // Store plan if available
        if (data.plan) {
          this.plan = data.plan;
          localStorage.setItem(this.STORAGE_KEY_PLAN, this.plan);
        } else {
          this.plan = '';
          localStorage.removeItem(this.STORAGE_KEY_PLAN);
        }

        // Store purchaseDate if available (returned from server)
        if (data.purchaseDate) {
          localStorage.setItem(this.STORAGE_KEY_DATE, data.purchaseDate.toString());
        }
      } else {
        this.activeLicense = false;
        this.plan = '';
      }

      if (oldStatus !== this.activeLicense || oldPlan !== this.plan) {
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
      this.plan = '';

      if (oldStatus !== this.activeLicense) {
        this.notifyListeners();
      }
    }
  }
}

export default LicenseManager.getInstance();

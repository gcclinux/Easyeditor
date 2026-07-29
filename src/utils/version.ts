
export interface VersionInfo {
    version: string;
    date?: string;
}

export const compareVersions = (v1: string, v2: string) => {
    // clean version strings (remove 'v' prefix if present)
    const cleanV1 = v1.replace(/^v/, '');
    const cleanV2 = v2.replace(/^v/, '');

    const parts1 = cleanV1.split('.').map(Number);
    const parts2 = cleanV2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
};

export const getRunningVersion = async (): Promise<string> => {
    // 1. Try build-time injected version (Vite define)
    try {
        if (typeof __APP_VERSION__ !== 'undefined') {
            return __APP_VERSION__;
        }
    } catch (e) { /* ignore */ }

    // 2. Try common sources for app version: injected env, fetch package.json, else unknown
    try {
        const envVersion = (window as any)?.process?.env?.npm_package_version;
        if (envVersion) {
            return envVersion;
        }
    } catch (e) {
        // ignore
    }

    try {
        const resp = await fetch('/package.json');
        if (resp.ok) {
            const pkg = await resp.json();
            return pkg.version || 'unknown';
        }
    } catch (e) {
        // ignore
    }
    return 'unknown';
};

export const getAvailableVersion = async (): Promise<VersionInfo> => {
    try {
        const ghResp = await fetch('https://raw.githubusercontent.com/gcclinux/Easyeditor/main/release/latest.json');
        if (ghResp.ok) {
            const ghData = await ghResp.json();
            return {
                version: ghData.version || 'unknown',
                date: ghData.date || ''
            };
        }
        return { version: 'unknown', date: '' };
    } catch (e) {
        return { version: 'unknown', date: '' };
    }
};

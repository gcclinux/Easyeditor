import React, { createContext, useContext, useState, useEffect } from 'react';

// Define available languages
export const LANGUAGES = [
    { code: 'en', name: 'English', label: 'English (EN)' },
    { code: 'pt-br', name: 'Portuguese (BR)', label: 'Portuguese (BR)' },
    { code: 'de', name: 'German', label: 'German (DE)' },
    { code: 'nl', name: 'Dutch', label: 'Dutch (NL)' },
    { code: 'pl', name: 'Polish', label: 'Polish (PL)' },
    { code: 'es', name: 'Spanish', label: 'Spanish (ES)' },
];

interface Language {
    code: string;
    name: string;
    label: string;
    isCustom?: boolean;
}

interface LanguageContextType {
    language: string;
    setLanguage: (lang: string) => void;
    t: (key: string, fallback?: string) => string;
    availableLanguages: Language[];
    importLanguage: (code: string, name: string, data: Record<string, any>) => void;
    isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Initialize with saved language immediately to avoid flash of English
    const [language, setLanguageState] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('easyeditor-language') || 'en';
        }
        return 'en';
    });
    const [translations, setTranslations] = useState<Record<string, any>>({});
    const [customLanguages, setCustomLanguages] = useState<Language[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load custom languages on startup
    useEffect(() => {
        // Load custom languages definition
        const savedCustomLangs = localStorage.getItem('easyeditor-custom-languages');
        if (savedCustomLangs) {
            try {
                setCustomLanguages(JSON.parse(savedCustomLangs) as Language[]);
            } catch (e) {
                console.error('Failed to parse custom languages', e);
            }
        }
    }, []);

    // Load translations when language changes
    useEffect(() => {
        const loadTranslations = async () => {
            setIsLoading(true);
            try {
                let data: any;

                // Check if it's a built-in language or custom
                const isBuiltIn = LANGUAGES.some(l => l.code === language);

                if (isBuiltIn) {
                    const locales = import.meta.glob('./locales/*.json', { eager: true });
                    const match: any = locales[`./locales/${language}.json`];
                    if (match) {
                        data = match.default || match;
                    } else {
                        console.warn(`Locale file for ${language} not found, falling back to English`);
                        if (language !== 'en') {
                            const enMatch: any = locales['./locales/en.json'];
                            if (enMatch) {
                                data = enMatch.default || enMatch;
                            }
                        }
                    }
                } else {
                    // Load custom language string from localStorage
                    const customData = localStorage.getItem(`easyeditor-lang-data-${language}`);
                    if (customData) {
                        data = JSON.parse(customData);
                    }
                }

                if (data) {
                    setTranslations(data);
                }
            } catch (error) {
                console.error(`Failed to load translations for ${language}`, error);
            } finally {
                setIsLoading(false);
            }
        };

        loadTranslations();
        localStorage.setItem('easyeditor-language', language);
    }, [language]);

    const locales = import.meta.glob('./locales/*.json', { eager: true });
    const enMatch: any = locales['./locales/en.json'];
    const enLocale = enMatch ? (enMatch.default || enMatch) : null;

    const setLanguage = (lang: string) => {
        setLanguageState(lang);
    };

    const t = (key: string, fallback?: string): string => {
        const keys = key.split('.');
        
        // Try current language translations first
        let value: any = translations;
        let found = true;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                found = false;
                break;
            }
        }

        if (found && typeof value === 'string') {
            return value;
        }

        // Try English fallback if not found in active locale
        if (enLocale) {
            let enValue: any = enLocale;
            let enFound = true;
            for (const k of keys) {
                if (enValue && typeof enValue === 'object' && k in enValue) {
                    enValue = enValue[k];
                } else {
                    enFound = false;
                    break;
                }
            }
            if (enFound && typeof enValue === 'string') {
                return enValue;
            }
        }

        return fallback || key;
    };

    const importLanguage = (code: string, name: string, data: Record<string, any>) => {
        // Save data
        localStorage.setItem(`easyeditor-lang-data-${code}`, JSON.stringify(data));

        // Update custom languages list
        const newLang: Language = { code, name, label: `${name} (${code.toUpperCase()})`, isCustom: true };
        const updated = [...customLanguages.filter(l => l.code !== code), newLang];
        setCustomLanguages(updated);
        localStorage.setItem('easyeditor-custom-languages', JSON.stringify(updated));

        // Switch to it
        setLanguage(code);
    };

    const availableLanguages = [...LANGUAGES, ...customLanguages];

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, availableLanguages, importLanguage, isLoading }}>
            {children}
        </LanguageContext.Provider>
    );
};

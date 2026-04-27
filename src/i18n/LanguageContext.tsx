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
    t: (key: string) => string;
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
                    // Dynamic import for built-in locales
                    // Note: In Vite, we might need to use a different approach if dynamic import with variables doesn't work out of the box
                    // But usually `import(./locales/${language}.json)` works if files exist.
                    // However, to be safe and explicit with Vite glob checks:
                    const locales = import.meta.glob('./locales/*.json');
                    const match = locales[`./locales/${language}.json`];
                    if (match) {
                        data = await match();
                        // handle default export if present, or existing object
                        data = data.default || data;
                    } else {
                        console.warn(`Locale file for ${language} not found, falling back to English`);
                        // Fallback to en if not found
                        if (language !== 'en') {
                            const enMatch = locales['./locales/en.json'];
                            if (enMatch) {
                                data = await enMatch();
                                data = data.default || data;
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

    const setLanguage = (lang: string) => {
        setLanguageState(lang);
    };

    const t = (key: string): string => {
        const keys = key.split('.');
        let value = translations;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return key; // Return key if translation needed
            }
        }

        return typeof value === 'string' ? value : key;
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

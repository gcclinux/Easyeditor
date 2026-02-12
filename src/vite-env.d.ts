/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_GOOGLE_API_KEY: string
  readonly VITE_GOOGLE_CLIENT_ID_PROD: string
  readonly VITE_GOOGLE_API_KEY_PROD: string
  readonly VITE_ENVIRONMENT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __APP_VERSION__: string;

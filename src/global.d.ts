// global.d.ts
interface Window {
  electron: {
    openFile: () => Promise<string>;
    onFileOpened: (callback: (content: string) => void) => void;
  };
  google?: {
    accounts: {
      oauth2: {
        initTokenClient: (config: any) => any;
        hasGrantedAllScopes: (tokenResponse: any, ...scopes: string[]) => boolean;
      };
    };
  };
}

declare module 'turndown-plugin-gfm' {
  import TurndownService from 'turndown';
  export function gfm(service: TurndownService): void;
  export function tables(service: TurndownService): void;
  export function strikethrough(service: TurndownService): void;
  export function taskListItems(service: TurndownService): void;
}
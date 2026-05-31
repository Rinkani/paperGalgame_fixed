/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEEPSEEK_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Vite ?url import syntax
declare module "*?url" {
  const src: string;
  export default src;
}

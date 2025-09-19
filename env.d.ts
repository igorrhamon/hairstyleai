/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_LLM_PROVIDERS?: string;
  readonly VITE_LLM_PROVIDER?: string;
  readonly VITE_LLM_MODEL?: string;
  readonly VITE_LLM_SUGGESTION_MODEL?: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}

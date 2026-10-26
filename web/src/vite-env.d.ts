/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API. Defaults to "/api" on the same origin. */
  readonly VITE_API_URL?: string;
  /** Optional public demo account shown on the sign-in screen (hosted demo only). */
  readonly VITE_DEMO_EMAIL?: string;
  readonly VITE_DEMO_PASSWORD?: string;
}

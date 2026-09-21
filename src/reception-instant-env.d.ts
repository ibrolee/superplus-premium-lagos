// Explicit Vite environment declaration for the preview-only registration release gate.
// Unset by default; do not enable until backend, scanner and role tests are complete.
interface ImportMetaEnv {
  readonly VITE_RECEPTION_INSTANT_ENABLED: string;
}

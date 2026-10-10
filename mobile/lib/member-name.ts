/** Saved gym profile is canonical; signup metadata is a display fallback only. */
export function memberDisplayName(profileName: unknown, metadata: Record<string, unknown> = {}) {
  const clean = (value: unknown) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  const saved = clean(profileName);
  const signup = clean(metadata.full_name) || clean(metadata.name);
  // Old demo placeholders should not hide a real name supplied on signup.
  if ((!saved || /^(test member|member)$/i.test(saved)) && signup && !/^(test member|member)$/i.test(signup)) return signup;
  return saved || signup || "Super Plus member";
}

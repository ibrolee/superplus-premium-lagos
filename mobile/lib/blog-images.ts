export function optimizedBlogImage(
  source: string,
  width: number,
  height?: number,
) {
  if (!source) return source;

  if (!source.includes("/storage/v1/object/public/")) {
    return source;
  }

  const transformed = source.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/",
  );
  const separator = transformed.includes("?") ? "&" : "?";
  const heightPart = height ? `&height=${height}` : "";

  return `${transformed}${separator}width=${width}${heightPart}&resize=cover&quality=76`;
}

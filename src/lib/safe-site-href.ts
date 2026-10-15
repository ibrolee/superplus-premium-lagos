/** Allow safe links in public, editable content, including the four public
 * portal entry screens. Authorization continues to be enforced by each route.
 */
const publicPortalEntries = new Set(["/portal", "/portal/staff", "/portal/reception", "/portal/admin"]);

export function safeCmsHref(href: string): string {
  if (publicPortalEntries.has(href)) return href;
  if (href === "/") return href;
  if (
    /^\/(?!\/)[a-zA-Z0-9/_#?&=.-]+$/.test(href) &&
    !/^\/(admin|staff|portal|management|reception)(\/|-|$)/i.test(href)
  ) return href;
  if (/^https:\/\/[a-zA-Z0-9.-]+(?:\/[^\s]*)?$/.test(href)) return href;
  return "/";
}

/** Legacy menu_item IDs from North Shore foundation → current sidebar / route IDs. */
const MENU_PERMISSION_ALIASES: Record<string, string[]> = {
  swim: ["swim-bracelets", "swim-progress"],
  "swim-bracelets": ["swim", "swim-progress"],
  "swim-progress": ["swim", "swim-bracelets"],
  "swim-lessons": ["swim", "swim-bracelets", "swim-progress"],
  nurse: ["health-center"],
  "health-center": ["nurse"],
  "tutoring-therapy": ["appointments"],
  appointments: ["tutoring-therapy"],
};

/**
 * Returns true when `perms[menuItem]` is true or any configured alias is granted.
 */
export function hasMenuPermissionWithAliases(
  perms: Record<string, boolean> | undefined,
  menuItem: string,
): boolean {
  if (!perms) return false;
  if (perms[menuItem] === true) return true;
  const aliases = MENU_PERMISSION_ALIASES[menuItem];
  if (!aliases) return false;
  return aliases.some((alias) => perms[alias] === true);
}

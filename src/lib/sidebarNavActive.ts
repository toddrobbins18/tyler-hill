/** Whether a sidebar item should appear selected for the current URL. */
export function isSidebarNavActive(pathname: string, url: string): boolean {
  if (url === "/") {
    return pathname === "/";
  }

  if (pathname === url) {
    return true;
  }

  if (url === "/roster" && pathname.startsWith("/child/")) {
    return true;
  }

  if (url === "/staff" && pathname.startsWith("/staff/")) {
    return true;
  }

  if (pathname.startsWith(`${url}/`)) {
    return true;
  }

  return false;
}

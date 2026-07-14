import { isAdminPath, PUBLIC_ADMIN_PATH, toInternalAdminPath } from "@/lib/admin-path";

export function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === href;
  }

  return isPathOrDescendant(pathname, href);
}

export function isAdminRoute(pathname: string, publicAdminPath = PUBLIC_ADMIN_PATH) {
  return isAdminPath(pathname, publicAdminPath) || isAdminPath(pathname, toInternalAdminPath());
}

export function isAdminNavigationItemActive(
  pathname: string,
  href: string,
  publicAdminPath = PUBLIC_ADMIN_PATH,
) {
  const suffix = getAdminSuffix(href, publicAdminPath);

  if (suffix === null) {
    return false;
  }

  const internalHref = toInternalAdminPath(suffix);

  if (suffix === "") {
    return pathname === href || pathname === internalHref;
  }

  return isPathOrDescendant(pathname, href) || isPathOrDescendant(pathname, internalHref);
}

function getAdminSuffix(href: string, publicAdminPath: string) {
  if (href === publicAdminPath) {
    return "";
  }

  if (href.startsWith(`${publicAdminPath}/`)) {
    return href.slice(publicAdminPath.length);
  }

  return null;
}

function isPathOrDescendant(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

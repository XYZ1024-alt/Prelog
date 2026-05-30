const INTERNAL_ADMIN_PATH = "/admin";

export const PUBLIC_ADMIN_PATH = normalizeAdminPath(process.env.ADMIN_PATH);

export function toAdminPath(path = "") {
  return `${PUBLIC_ADMIN_PATH}${normalizeSuffix(path)}`;
}

export function toInternalAdminPath(path = "") {
  return `${INTERNAL_ADMIN_PATH}${normalizeSuffix(path)}`;
}

export function isAdminPath(pathname: string, basePath = PUBLIC_ADMIN_PATH) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

export function usesCustomAdminPath() {
  return PUBLIC_ADMIN_PATH !== INTERNAL_ADMIN_PATH;
}

function normalizeAdminPath(value: string | undefined) {
  const trimmed = (value ?? INTERNAL_ADMIN_PATH).trim();
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.replace(/\/+/g, "/").replace(/\/$/, "");

  if (normalized === "" || normalized === "/") {
    return INTERNAL_ADMIN_PATH;
  }

  return normalized;
}

function normalizeSuffix(path: string) {
  if (!path) {
    return "";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

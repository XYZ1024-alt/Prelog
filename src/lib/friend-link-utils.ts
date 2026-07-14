export function splitFriendRequirements(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getFriendLinkHostname(value: string) {
  return new URL(value).hostname.replace(/^www\./i, "");
}

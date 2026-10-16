export function saveBrowserTimeZone() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.cookie = `ledger-timezone=${encodeURIComponent(zone)}; Path=/; SameSite=Lax; Max-Age=31536000${location.protocol === "https:" ? "; Secure" : ""}`;
}

const LOCAL_ORIGIN = "https://study-assistant.local";

export function safeNextPath(next: string | undefined) {
  if (!next?.startsWith("/") || next.includes("\\")) {
    return "/";
  }

  const url = new URL(next, LOCAL_ORIGIN);

  if (url.origin !== LOCAL_ORIGIN) {
    return "/";
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

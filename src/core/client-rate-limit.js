function normalizeCloudflareIp(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) return null;
  if (value.includes(":")) {
    try {
      const parsed = new URL("http://[" + value + "]/" );
      const hostname = parsed.hostname;
      return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1,-1).toLowerCase() : null;
    } catch { return null; }
  }
  const octets=value.split(".");
  if(octets.length!==4||octets.some(part=>!/^\\d{1,3}$/.test(part))) return null;
  const numbers=octets.map(Number);
  if(numbers.some((part,i)=>part>255||String(part)!==octets[i])) return null;
  return numbers.join(".");
}
/** Trust only Cloudflare's inbound source IP; never caller-supplied forwarded headers. */
export function getClientRateLimitKey(request) {
  const address=normalizeCloudflareIp(request?.headers?.get("cf-connecting-ip"));
  return address ? "ip:"+address : "ip:unavailable";
}
export const PRE_AUTH_WINDOW_MS=60_000;
export const PRE_AUTH_MAX_REQUESTS_PER_ISOLATE=300;

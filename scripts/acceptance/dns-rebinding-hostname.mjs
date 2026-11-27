const REBINDING_INTERVAL = "30s";

export function createDnsRebindingHostname(publicIp, privateIp, suffix, afterTimes = 2) {
  const safeSuffix = String(suffix)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  if (!safeSuffix || !/^[a-z0-9-]{8,48}$/.test(safeSuffix) ||
      !Number.isInteger(afterTimes) || afterTimes < 0 || afterTimes > 2) {
    throw new Error("A unique DNS rebinding hostname suffix and supported public-answer count are required.");
  }

  // 1u.ms requires rebindfor<interval>after<num>times; omitting either
  // part makes the hostname fall through to the static make-IP handler.
  return "make-" + publicIp + "-rebindfor" + REBINDING_INTERVAL +
    "after" + afterTimes + "times-" + privateIp + "-rr-" + safeSuffix + ".1u.ms";
}

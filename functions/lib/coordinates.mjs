export function safeEventPoint(value) {
  const latitude = value?.latitude;
  const longitude = value?.longitude;
  if (typeof latitude !== "number" || typeof longitude !== "number"
    || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180
    || (latitude === 0 && longitude === 0)) return null;
  return {
    latitude: Math.round(latitude * 1e4) / 1e4,
    longitude: Math.round(longitude * 1e4) / 1e4
  };
}

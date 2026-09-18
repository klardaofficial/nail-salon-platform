export function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function currentUtcOffset(timeZone: string) {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date())
    .find(({ type }) => type === "timeZoneName")?.value;

  if (!part || part === "GMT") return "+00:00";
  return part.replace("GMT", "");
}

export const timeZoneOptions = ["UTC", ...Intl.supportedValuesOf("timeZone")].map((timeZone) => ({
  value: timeZone,
  label: `(${currentUtcOffset(timeZone)}) ${timeZone}`,
}));

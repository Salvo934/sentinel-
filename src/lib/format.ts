const TIME_ZONE = "Europe/Rome";

export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeZone: TIME_ZONE }).format(
    new Date(value),
  );
}

export function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

/** "GMT+01:00" style offset of Europe/Rome at the given instant → "+01:00". */
function romeOffset(at: Date): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const match = name?.match(/GMT([+-]\d{2}:\d{2})/);
  return match?.[1] ?? "+00:00";
}

/**
 * Interprets a naive `<input type="datetime-local">` value ("2026-11-20T10:30")
 * as Europe/Rome wall-clock time, independent of the server's time zone.
 * Values that already carry a zone are parsed as-is.
 */
export function parseLocalDateTime(value: string): Date {
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return new Date(value);
  const naive = value.length === 16 ? `${value}:00` : value;
  const guess = new Date(`${naive}Z`);
  return new Date(`${naive}${romeOffset(guess)}`);
}

/** ISO instant → value for `<input type="datetime-local">` in Europe/Rome. */
export function toDateTimeLocal(value: string | Date | null | undefined): string {
  if (!value) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(value))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

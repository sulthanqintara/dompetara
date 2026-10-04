export function printedReceiptTimestamp(
  text: string,
): { date: string; time: string } | null {
  // Printed Indonesian receipts use day.month.year, often directly followed by time.
  // Restrict correction to one unique printed timestamp; order timelines need provider semantics.
  if (
    /waktu\s+(pemesanan|pembayaran|pengiriman)|paid\s+at|order\s+timeline/i.test(
      text,
    )
  )
    return null;
  const matches = [
    ...text.matchAll(
      /\b(\d{2})\.(\d{2})\.(\d{2}|\d{4})\s*[-–]\s*([01]\d|2[0-3]):([0-5]\d)\b/g,
    ),
  ];
  const values = matches
    .map((match) => {
      const [, day, month, rawYear, hour, minute] = match;
      const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
      const date = `${year}-${month}-${day}`;
      const parsed = new Date(`${date}T00:00:00Z`);
      return Number.isFinite(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === date
        ? { date, time: `${hour}:${minute}` }
        : null;
    })
    .filter((value) => value !== null);
  const unique = new Map(
    values.map((value) => [`${value.date}T${value.time}`, value]),
  );
  return unique.size === 1 ? [...unique.values()][0] : null;
}

const CALCOM_BASE = "https://api.cal.com/v1";

async function calFetch(apiKey: string, path: string) {
  const res = await fetch(`${CALCOM_BASE}${path}?apiKey=${apiKey}`);
  if (!res.ok) throw new Error(`Cal.com API error: ${res.statusText}`);
  return res.json();
}

export async function listBookings(apiKey: string) {
  const data = await calFetch(apiKey, "/bookings");
  const bookings = (data.bookings ?? []).slice(0, 10);
  return bookings.map((b: Record<string, unknown>) => ({
    id: b.id,
    title: b.title,
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
    attendees: (b.attendees as { email: string }[])?.map((a) => a.email) ?? [],
  }));
}

export async function getAvailability(apiKey: string, eventTypeId: number, dateFrom: string, dateTo: string) {
  const res = await fetch(
    `${CALCOM_BASE}/availability?apiKey=${apiKey}&eventTypeId=${eventTypeId}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
  );
  if (!res.ok) throw new Error(`Cal.com API error: ${res.statusText}`);
  const data = await res.json();
  return {
    busy: data.busy ?? [],
    timeZone: data.timeZone,
  };
}

export function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function weekRange(value: string) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const start = dateInput(date);
  date.setDate(date.getDate() + 6);
  return { start, end: dateInput(date) };
}

export function periodDates(start: string, end: string, today: string) {
  const dates: string[] = [];
  const date = new Date(`${start}T12:00:00`);
  while (dateInput(date) <= end && dateInput(date) <= today) {
    dates.push(dateInput(date));
    date.setDate(date.getDate() + 1);
  }
  return dates;
}

export function daySummary(rows: { location: string; deviceName: string; status: string; temperature: string }[]) {
  const devices = new Map<string, { measured: boolean; inactive: boolean; problem: boolean }>();
  for (const row of rows) {
    const key = `${row.location}|${row.deviceName.trim().toLowerCase()}`;
    const previous = devices.get(key);
    devices.set(key, {
      measured: Boolean(row.temperature.trim()) || Boolean(previous?.measured),
      inactive: row.status === "inactive" && (!previous || previous.inactive),
      problem: row.status === "attention" || row.status === "deviation" || Boolean(previous?.problem),
    });
  }
  const active = [...devices.values()].filter((item) => !item.inactive);
  const filled = active.filter((item) => item.measured).length;
  return { total: active.length, filled, missing: active.length - filled, problems: active.filter((item) => item.problem).length, inactive: devices.size - active.length };
}

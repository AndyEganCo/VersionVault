import { google } from "googleapis";

const SMARTSHEET_REPORT_ID = "7949422968131460";
const TIME_MIN = "2026-01-01T00:00:00Z";
const TIME_MAX = "2027-12-31T23:59:59Z";

const CALENDAR_IDS: Record<Mode, string> = {
  sprint:
    "c_71bc8d4c769a443aaa4d3406b129b4f3574bcdddf5fe559b2ff138f97313b100@group.calendar.google.com",
  travel:
    "c_ccc7a9944cec8fcfed17622b5a15c0974394f074f6a17fd93fc182cfd752d35e@group.calendar.google.com",
};

type Mode = "sprint" | "travel";

interface SyncRow {
  rowId: string;
  startDate: string;
  endDate: string;
  eventTitle: string;
  description: string;
}

function toDateOnly(isoStr: string): string {
  return isoStr.split("T")[0];
}

function addOneDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0];
}

function matchesTravelKeywords(str: string): boolean {
  const s = str.toLowerCase();
  return s.includes("punch list") || s.includes("commissioning");
}

function extractRowId(description?: string | null): string | null {
  if (!description) return null;
  const match = description.match(/Smartsheet Row ID: (\d+)/);
  return match ? match[1] : null;
}

async function fetchSmartsheetRows(
  token: string,
  mode: Mode
): Promise<SyncRow[]> {
  const url = `https://api.smartsheet.com/2.0/reports/${SMARTSHEET_REPORT_ID}?pageSize=500`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(
      `Smartsheet API error: ${res.status} ${await res.text()}`
    );
  }

  const report = (await res.json()) as {
    columns: { virtualId: string; title: string }[];
    rows: {
      id: number;
      cells: { virtualColumnId: string; value?: string; displayValue?: string }[];
    }[];
  };

  const colMap: Record<string, string> = {};
  for (const col of report.columns ?? []) {
    colMap[col.virtualId] = col.title;
  }

  const rows: SyncRow[] = [];

  for (const row of report.rows ?? []) {
    const obj: Record<string, string> = {};
    let startISO: string | null = null;
    let finishISO: string | null = null;

    for (const cell of row.cells ?? []) {
      const colName = colMap[cell.virtualColumnId];
      if (!colName) continue;
      obj[colName] = cell.displayValue ?? cell.value ?? "";
      if (colName === "Start" && cell.value) startISO = cell.value;
      if (colName === "Finish" && cell.value) finishISO = cell.value;
    }

    const primary = (obj["Primary"] ?? "").trim();
    if (!primary) continue;
    if (mode === "travel" && !matchesTravelKeywords(primary)) continue;
    if (!startISO || !finishISO) continue;

    const startDate = toDateOnly(startISO);
    const endDate = addOneDay(toDateOnly(finishISO));
    const status = obj["Status"] ? ` [${obj["Status"]}]` : "";
    const rowId = String(row.id);

    const description = [
      obj["Duration"] ? `Duration: ${obj["Duration"]}` : "",
      obj["Project Manager"] ? `PM: ${obj["Project Manager"]}` : "",
      obj["Project ID / Comments"]
        ? `Project: ${obj["Project ID / Comments"]}`
        : "",
      obj["Status"] ? `Status: ${obj["Status"]}` : "",
      `Smartsheet Row ID: ${rowId}`,
    ]
      .filter(Boolean)
      .join(" | ");

    rows.push({
      rowId,
      startDate,
      endDate,
      eventTitle: `${primary}${status}`,
      description,
    });
  }

  return rows;
}

async function fetchAllCalendarEvents(
  calendar: ReturnType<typeof google.calendar>,
  calendarId: string
): Promise<{ id: string; summary?: string; description?: string; start?: { date?: string }; end?: { date?: string } }[]> {
  const events: any[] = [];
  let pageToken: string | undefined;

  do {
    const res = await calendar.events.list({
      calendarId,
      timeMin: TIME_MIN,
      timeMax: TIME_MAX,
      singleEvents: true,
      maxResults: 2500,
      pageToken,
    });
    events.push(...(res.data.items ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return events;
}

async function sync(mode: Mode): Promise<void> {
  const smartsheetToken = process.env.SMARTSHEET_BEARER_TOKEN;
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!smartsheetToken) throw new Error("Missing SMARTSHEET_BEARER_TOKEN");
  if (!serviceAccountJson)
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON");

  const calendarId = CALENDAR_IDS[mode];
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(serviceAccountJson),
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  const calendar = google.calendar({ version: "v3", auth });

  const [ssRows, calEvents] = await Promise.all([
    fetchSmartsheetRows(smartsheetToken, mode),
    fetchAllCalendarEvents(calendar, calendarId),
  ]);

  console.log(
    `[${mode}] Smartsheet: ${ssRows.length} rows | Calendar: ${calEvents.length} events`
  );

  const calByRowId: Record<string, (typeof calEvents)[number]> = {};
  for (const event of calEvents) {
    const rowId = extractRowId(event.description);
    if (rowId) calByRowId[rowId] = event;
  }

  const ssRowIds = new Set(ssRows.map((r) => r.rowId));
  const calRowIds = new Set(Object.keys(calByRowId));

  const toCreate = ssRows.filter((r) => !calRowIds.has(r.rowId));
  const toDelete = calEvents.filter((e) => {
    const id = extractRowId(e.description);
    return id && !ssRowIds.has(id);
  });
  const toUpdate = ssRows.filter((r) => {
    if (!calRowIds.has(r.rowId)) return false;
    const ev = calByRowId[r.rowId];
    return (
      ev.start?.date !== r.startDate ||
      ev.end?.date !== r.endDate ||
      ev.summary !== r.eventTitle
    );
  });

  const deleteIds = [
    ...toDelete.map((e) => e.id),
    ...toUpdate.map((r) => calByRowId[r.rowId].id),
  ];
  const createRows = [...toCreate, ...toUpdate];

  console.log(
    `[${mode}] delete=${deleteIds.length} create=${createRows.length} unchanged=${ssRows.length - toUpdate.length - toCreate.length}`
  );

  for (const eventId of deleteIds) {
    await calendar.events.delete({ calendarId, eventId });
    console.log(`[${mode}] Deleted ${eventId}`);
  }

  for (const row of createRows) {
    await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: row.eventTitle,
        description: row.description,
        start: { date: row.startDate },
        end: { date: row.endDate },
      },
    });
    console.log(`[${mode}] Created: ${row.eventTitle}`);
  }

  console.log(`[${mode}] Sync complete.`);
}

const mode = process.argv[2] as Mode;
if (mode !== "sprint" && mode !== "travel") {
  console.error("Usage: tsx sync.ts sprint|travel");
  process.exit(1);
}

sync(mode).catch((err) => {
  console.error(err);
  process.exit(1);
});

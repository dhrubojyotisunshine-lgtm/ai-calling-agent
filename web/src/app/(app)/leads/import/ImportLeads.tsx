"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { IMPORT_MAX_ROWS } from "@/lib/leads";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { importLeads, type ImportResult } from "../actions";

const MAX_FILE_MB = 5;
type Sheet = { headers: string[]; text: string[][]; raw: unknown[][]; fileName: string };

const guess = (headers: string[], re: RegExp) => headers.findIndex((h) => re.test(h));
// "Loan Amount" → loan_amount, used as {loan_amount} in scripts.
const toKey = (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60) || "column";

export function ImportLeads() {
  const [sheet, setSheet] = useState<Sheet>();
  const [error, setError] = useState<string>();
  const [phoneCol, setPhoneCol] = useState(-1);
  const [nameCol, setNameCol] = useState(-1);
  const [cityCol, setCityCol] = useState(-1);
  const [result, setResult] = useState<ImportResult>();
  const [pending, start] = useTransition();

  async function onFile(file: File | undefined) {
    setError(undefined); setResult(undefined); setSheet(undefined);
    if (!file) return;
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) return setError("Choose a CSV, XLSX or XLS file.");
    if (file.size > MAX_FILE_MB * 1024 * 1024) return setError(`The file is larger than ${MAX_FILE_MB} MB. Split it into smaller files.`);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const text = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: "" });
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
      const headers = (text[0] ?? []).map((h, i) => String(h).trim() || `Column ${i + 1}`);
      const rows = text.slice(1).filter((r) => r.some((c) => String(c).trim()));
      if (!headers.length || !rows.length) return setError("The file has no rows. The first row must be column names.");
      if (rows.length > IMPORT_MAX_ROWS) return setError(`The file has ${rows.length.toLocaleString("en-IN")} rows. The limit is ${IMPORT_MAX_ROWS.toLocaleString("en-IN")} per file.`);
      const rawRows = raw.slice(1).filter((r) => r.some((c) => String(c).trim()));
      setSheet({ headers, text: rows, raw: rawRows, fileName: file.name });
      setPhoneCol(guess(headers, /phone|mobile|number|contact|whatsapp|cell/i));
      setNameCol(guess(headers, /name/i));
      setCityCol(guess(headers, /city|town|location/i));
    } catch {
      setError("We couldn't read that file. Save it again as CSV or XLSX and retry.");
    }
  }

  const summary = useMemo(() => {
    if (!sheet || phoneCol < 0) return null;
    const seen = new Set<string>();
    let valid = 0, invalid = 0, dupes = 0;
    for (const r of sheet.raw) {
      const p = normalizePhone(r[phoneCol]);
      if (!p) invalid++;
      else if (seen.has(p)) dupes++;
      else { seen.add(p); valid++; }
    }
    return { valid, invalid, dupes };
  }, [sheet, phoneCol]);

  const extraCols = sheet ? sheet.headers.map((h, i) => ({ h, i })).filter(({ i }) => i !== phoneCol && i !== nameCol && i !== cityCol) : [];

  function runImport() {
    if (!sheet || phoneCol < 0) return;
    const rows = sheet.text.map((r, idx) => ({
      phone: String(sheet.raw[idx]?.[phoneCol] ?? r[phoneCol] ?? "").slice(0, 40),
      name: nameCol >= 0 ? String(r[nameCol] ?? "").slice(0, 160) : undefined,
      city: cityCol >= 0 ? String(r[cityCol] ?? "").slice(0, 80) : undefined,
      fields: Object.fromEntries(extraCols.map(({ h, i }) => [toKey(h), String(r[i] ?? "").slice(0, 500)]).filter(([, v]) => v)),
    }));
    start(async () => {
      try {
        setResult(await importLeads(rows));
      } catch {
        setResult({ error: "The import failed. Try a smaller file, or check your connection." });
      }
    });
  }

  if (result && !result.error) {
    return (
      <div className="card space-y-3 p-6">
        <h2 className="text-lg font-extrabold text-ok">Import finished</h2>
        <ul className="space-y-1 text-sm">
          <li><b className="tabular-nums">{result.created}</b> new leads added</li>
          <li><b className="tabular-nums">{result.skippedExisting}</b> skipped because the number is already in your leads</li>
          <li><b className="tabular-nums">{result.skippedDuplicateInFile}</b> skipped because the number appears twice in the file</li>
          <li><b className="tabular-nums">{result.skippedInvalid}</b> skipped because the phone number isn&apos;t valid</li>
        </ul>
        <div className="flex gap-2">
          {!!result.created && result.since && (
            <Link href={`/campaigns/new?addedSince=${encodeURIComponent(result.since)}`} className="btn-primary">Call these leads in a campaign</Link>
          )}
          <Link href="/leads" className={result.created ? "btn" : "btn-primary"}>See leads</Link>
          <button type="button" className="btn" onClick={() => { setResult(undefined); setSheet(undefined); }}>Import another file</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="card space-y-3 p-6">
        <label htmlFor="file" className="label block">Lead file</label>
        <input id="file" type="file" accept=".csv,.xlsx,.xls" onChange={(e) => onFile(e.target.files?.[0])}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:font-semibold file:text-white" />
        <p className="text-xs text-muted">CSV, XLSX or XLS, up to {MAX_FILE_MB} MB and {IMPORT_MAX_ROWS.toLocaleString("en-IN")} rows. The first row must be column names. One lead per row.</p>
        {error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
        {result?.error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{result.error}</p>}
      </div>

      {sheet && (
        <div className="card space-y-5 p-6">
          <p className="text-sm"><b>{sheet.fileName}</b> · <span className="tabular-nums">{sheet.text.length.toLocaleString("en-IN")}</span> rows</p>
          <div className="grid gap-4 md:grid-cols-3">
            <ColumnPick id="phoneCol" label="Phone column (required)" value={phoneCol} onChange={setPhoneCol} headers={sheet.headers} required />
            <ColumnPick id="nameCol" label="Name column" value={nameCol} onChange={setNameCol} headers={sheet.headers} />
            <ColumnPick id="cityCol" label="City column" value={cityCol} onChange={setCityCol} headers={sheet.headers} />
          </div>

          {phoneCol < 0 ? (
            <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-[#7a4300]">We couldn&apos;t find a phone column. Pick it above.</p>
          ) : summary && (
            <div className="flex flex-wrap gap-2 text-sm" role="status">
              <span className="chip border-ok/30 bg-ok-soft text-ok">{summary.valid.toLocaleString("en-IN")} valid numbers</span>
              {summary.invalid > 0 && <span className="chip border-bad/20 bg-bad-soft text-bad">{summary.invalid.toLocaleString("en-IN")} invalid</span>}
              {summary.dupes > 0 && <span className="chip border-warn/30 bg-warn-soft text-warn">{summary.dupes.toLocaleString("en-IN")} repeated in file</span>}
            </div>
          )}

          {extraCols.length > 0 && (
            <p className="text-sm text-muted">
              Other columns are kept and can be used in agent scripts:{" "}
              {extraCols.map(({ h }) => <code key={h} className="mr-1 rounded bg-paper px-1.5 py-0.5 font-mono text-xs text-ink">{`{${toKey(h)}}`}</code>)}
            </p>
          )}

          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-paper text-left">{sheet.headers.map((h, i) => <th key={i} className="px-3 py-2 font-semibold">{h}</th>)}<th className="px-3 py-2 font-semibold">Saved as</th></tr></thead>
              <tbody>
                {sheet.text.slice(0, 5).map((r, ri) => {
                  const p = phoneCol >= 0 ? normalizePhone(sheet.raw[ri]?.[phoneCol]) : null;
                  return (
                    <tr key={ri} className="border-b border-line/60 last:border-0">
                      {sheet.headers.map((_, ci) => <td key={ci} className="px-3 py-2">{r[ci]}</td>)}
                      <td className={`px-3 py-2 tabular-nums ${p ? "text-ok" : "text-bad"}`}>{p ? formatPhone(p) : "Invalid number"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">Showing the first {Math.min(5, sheet.text.length)} rows. Numbers already in your leads are skipped, not changed.</p>

          <div className="flex justify-end gap-2">
            <Link href="/leads" className="btn">Cancel</Link>
            <button type="button" className="btn-primary" disabled={pending || phoneCol < 0 || !summary?.valid} onClick={runImport}>
              {pending ? "Importing…" : `Import ${summary?.valid.toLocaleString("en-IN") ?? 0} leads`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ColumnPick({ id, label, value, onChange, headers, required }: {
  id: string; label: string; value: number; onChange: (v: number) => void; headers: string[]; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="label block">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))} className="input">
        <option value={-1}>{required ? "Choose a column…" : "None"}</option>
        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
      </select>
    </div>
  );
}

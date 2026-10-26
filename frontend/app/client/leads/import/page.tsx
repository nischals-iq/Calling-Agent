'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import {
  Upload,
  ArrowLeft,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Check,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  FileText,
} from 'lucide-react';

interface PreviewResponse {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  preview: any[];
  errors: { row: number; error: string }[];
}

interface ImportSummary {
  total: number;
  importedCount: number;
  duplicateCount: number;
  skippedCount: number;
  errorCount: number;
  errors: { row: number; reason: string }[];
}

export default function LeadImportPage() {
  const router = useRouter();

  // Wizard Steps: 1: Upload, 2: Map Columns, 3: Preview & Validate, 4: Results
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // File & Raw Data State
  const [fileName, setFileName] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Preview & Config State
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateHandling, setDuplicateHandling] = useState<'FLAG' | 'SKIP'>('FLAG');

  // Final Summary State
  const [importLoading, setImportLoading] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  // Simple CSV Parser
  const parseCSV = (text: string) => {
    const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new Error('CSV must contain a header row and at least one data row.');
    }

    // Split line handling quotes
    const splitLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const headers = splitLine(lines[0]).map((h) => h.replace(/^["']|["']$/g, '').trim());
    const rows: Record<string, any>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = splitLine(lines[i]);
      const obj: Record<string, any> = {};
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = vals[j] !== undefined ? vals[j].replace(/^["']|["']$/g, '') : '';
      }
      rows.push(obj);
    }

    return { headers, rows };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        const { headers, rows } = parseCSV(content);

        setCsvHeaders(headers);
        setRawRows(rows);

        // Auto map smartly
        const initialMapping: Record<string, string> = {};
        headers.forEach((h) => {
          const lower = h.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (lower.includes('firstname') || lower === 'first' || lower === 'name') {
            initialMapping[h] = 'firstName';
          } else if (lower.includes('lastname') || lower === 'last' || lower === 'surname') {
            initialMapping[h] = 'lastName';
          } else if (lower.includes('email')) {
            initialMapping[h] = 'email';
          } else if (lower.includes('phone') || lower.includes('mobile') || lower.includes('contact')) {
            initialMapping[h] = 'phone';
          } else if (lower.includes('company') || lower.includes('org') || lower.includes('business')) {
            initialMapping[h] = 'company';
          } else if (lower.includes('campaign')) {
            initialMapping[h] = 'campaignName';
          } else if (lower.includes('note') || lower.includes('remark') || lower.includes('message')) {
            initialMapping[h] = 'notes';
          } else {
            initialMapping[h] = 'ignore';
          }
        });

        setColumnMapping(initialMapping);
        setStep(2);
      } catch (err: any) {
        setError(err.message || 'Failed to read CSV file');
      }
    };
    reader.readAsText(file);
  };

  const downloadSampleTemplate = () => {
    const csvContent =
      'First Name,Last Name,Email,Mobile,Company,Campaign,Notes\n' +
      'Amit,Kumar,amit.kumar@example.com,+919876543210,Kumar Industries,Summer Campaign 2026,Interested in high-volume calling\n' +
      'Sneha,Patel,sneha.patel@acme.com,+919811223344,Acme Technologies,Website Referral,Requires 15 agent seats';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crm_leads_import_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleProceedToPreview = async () => {
    setError(null);
    setPreviewLoading(true);

    // Verify firstName is mapped
    const hasFirstName = Object.values(columnMapping).includes('firstName');
    if (!hasFirstName) {
      setError('Please map at least one CSV column to the "First Name" field.');
      setPreviewLoading(false);
      return;
    }

    try {
      const res = await apiFetch<PreviewResponse>('/client/leads/import/preview', {
        method: 'POST',
        body: JSON.stringify({
          rawRows: rawRows.slice(0, 500), // send rows for validation and duplicate checking
          columnMapping,
        }),
      });

      setPreviewData(res);
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Failed to preview CSV rows');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    setError(null);
    setImportLoading(true);

    try {
      // Map all rows
      const fieldToHeader: Record<string, string> = {};
      Object.entries(columnMapping).forEach(([header, field]) => {
        if (field && field !== 'ignore') {
          fieldToHeader[field] = header;
        }
      });

      const mappedPayload = rawRows.map((row) => ({
        firstName: fieldToHeader['firstName'] ? row[fieldToHeader['firstName']] : 'Unnamed Lead',
        lastName: fieldToHeader['lastName'] ? row[fieldToHeader['lastName']] : undefined,
        email: fieldToHeader['email'] ? row[fieldToHeader['email']] : undefined,
        phone: fieldToHeader['phone'] ? row[fieldToHeader['phone']] : undefined,
        company: fieldToHeader['company'] ? row[fieldToHeader['company']] : undefined,
        campaignName: fieldToHeader['campaignName'] ? row[fieldToHeader['campaignName']] : undefined,
        notes: fieldToHeader['notes'] ? row[fieldToHeader['notes']] : undefined,
      }));

      const res = await apiFetch<ImportSummary>('/client/leads/import/confirm', {
        method: 'POST',
        body: JSON.stringify({
          rows: mappedPayload,
          defaultSource: 'CSV_IMPORT',
          duplicateHandling,
        }),
      });

      setSummary(res);
      setStep(4);
    } catch (err: any) {
      setError(err.message || 'Import execution failed');
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans pb-12">
      {/* Header */}
      <div>
        <Link
          href="/client/leads"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 mb-2 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Captured Leads
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Upload className="w-6 h-6 text-indigo-600" />
          CSV Lead Import Wizard
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Bulk import leads from CSV spreadsheets with intelligent column mapping, row validation, and duplicate detection.
        </p>
      </div>

      {/* Stepper Indicator */}
      <div className="flex items-center justify-between max-w-xl mx-auto p-2 bg-white border border-slate-200 rounded-2xl text-xs font-semibold">
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
            step === 1 ? 'bg-indigo-600 text-white font-bold' : 'text-slate-500'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
          Upload File
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300" />
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
            step === 2 ? 'bg-indigo-600 text-white font-bold' : 'text-slate-500'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
          Map Columns
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300" />
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
            step === 3 ? 'bg-indigo-600 text-white font-bold' : 'text-slate-500'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">3</span>
          Preview & Validate
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300" />
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
            step === 4 ? 'bg-indigo-600 text-white font-bold' : 'text-slate-500'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">4</span>
          Summary
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: UPLOAD CSV */}
      {step === 1 && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-8 shadow-xs text-center space-y-6">
          <div className="max-w-md mx-auto space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Upload your CSV spreadsheet</h2>
            <p className="text-xs text-slate-500">
              Select or drop a standard .csv file containing customer leads.
            </p>
          </div>

          <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-3xl p-8 max-w-lg mx-auto bg-slate-50/50 transition">
            <input
              type="file"
              id="csvFileInput"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="csvFileInput"
              className="flex flex-col items-center justify-center cursor-pointer space-y-2"
            >
              <Upload className="w-8 h-8 text-slate-400" />
              <span className="text-xs font-bold text-indigo-600 hover:underline">
                Choose a CSV file from computer
              </span>
              <span className="text-[11px] text-slate-400">Supports standard comma-separated files</span>
            </label>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={downloadSampleTemplate}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600"
            >
              <Download className="w-3.5 h-3.5" />
              Download Sample CSV Template
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: COLUMN MAPPING */}
      {step === 2 && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Map CSV Columns to CRM Fields</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                File: <span className="font-semibold text-slate-700">{fileName}</span> ({rawRows.length} rows detected)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs font-semibold text-slate-500 hover:underline"
            >
              Change File
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {csvHeaders.map((header) => (
              <div
                key={header}
                className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 text-xs"
              >
                <div className="overflow-hidden">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">CSV Column</span>
                  <span className="font-bold text-slate-900 truncate block">{header}</span>
                  <span className="text-[10px] text-slate-400 truncate block">
                    Sample: {rawRows[0]?.[header] || '—'}
                  </span>
                </div>

                <div className="w-48">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">
                    Maps To CRM Field
                  </span>
                  <select
                    value={columnMapping[header] || 'ignore'}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, [header]: e.target.value })
                    }
                    className="w-full p-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  >
                    <option value="ignore">Don't Import (Ignore)</option>
                    <option value="firstName">First Name (Required)</option>
                    <option value="lastName">Last Name</option>
                    <option value="email">Email Address</option>
                    <option value="phone">Mobile / Phone</option>
                    <option value="company">Company</option>
                    <option value="jobTitle">Job Title</option>
                    <option value="campaignName">Campaign Name</option>
                    <option value="notes">Notes / Message</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleProceedToPreview}
              disabled={previewLoading}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {previewLoading ? 'Analyzing Rows...' : 'Preview & Validate →'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PREVIEW & VALIDATION */}
      {step === 3 && previewData && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Pre-Import Validation & Duplicate Check</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify analyzed records, invalid rows, and pre-detected duplicates before saving.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold">Duplicate Policy:</span>
              <select
                value={duplicateHandling}
                onChange={(e) => setDuplicateHandling(e.target.value as any)}
                className="p-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              >
                <option value="FLAG">Flag duplicates & link (Recommended)</option>
                <option value="SKIP">Skip duplicate rows</option>
              </select>
            </div>
          </div>

          {/* Validation Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-slate-400 font-bold">Total Rows</span>
              <div className="text-xl font-bold text-slate-900 mt-1">{previewData.totalRows}</div>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <span className="text-emerald-600 font-bold">Valid Leads</span>
              <div className="text-xl font-bold text-emerald-800 mt-1">{previewData.validCount}</div>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl">
              <span className="text-amber-600 font-bold">Detected Duplicates</span>
              <div className="text-xl font-bold text-amber-800 mt-1">{previewData.duplicateCount}</div>
            </div>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl">
              <span className="text-rose-600 font-bold">Invalid / Missing</span>
              <div className="text-xl font-bold text-rose-800 mt-1">{previewData.invalidCount}</div>
            </div>
          </div>

          {/* Preview Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold sticky top-0">
                    <th className="py-2.5 px-3">Row</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Company</th>
                    <th className="py-2.5 px-3">Campaign</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewData.preview.map((row) => (
                    <tr
                      key={row._rowIndex}
                      className={`hover:bg-slate-50/80 transition ${
                        !row._isValid ? 'bg-rose-50/30' : row._isDuplicate ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-slate-400 font-mono">#{row._rowIndex}</td>
                      <td className="py-2.5 px-3">
                        {!row._isValid ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3" /> Invalid
                          </span>
                        ) : row._isDuplicate ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> Duplicate
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Valid
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {row.firstName} {row.lastName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{row.email || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600">{row.phone || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600">{row.company || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-500">{row.campaignName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              ← Edit Mapping
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={importLoading || previewData.validCount === 0}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
            >
              {importLoading ? 'Importing Leads...' : `Confirm & Import ${previewData.validCount} Leads`}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: FINAL SUMMARY */}
      {step === 4 && summary && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-8 shadow-xs text-center space-y-6">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">Import Batch Completed</h2>
            <p className="text-xs text-slate-500 mt-1">
              Your CSV records have been processed through the common lead ingestion engine.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-slate-400 font-bold">Total Processed</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">{summary.total}</div>
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <span className="text-emerald-700 font-bold">Successfully Saved</span>
              <div className="text-2xl font-bold text-emerald-700 mt-1">{summary.importedCount}</div>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
              <span className="text-amber-700 font-bold">Flagged Duplicates</span>
              <div className="text-2xl font-bold text-amber-700 mt-1">{summary.duplicateCount}</div>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-slate-400 font-bold">Failed / Skipped</span>
              <div className="text-2xl font-bold text-slate-600 mt-1">
                {summary.skippedCount + summary.errorCount}
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-center gap-3">
            <Link
              href="/client/leads"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition"
            >
              View Captured Leads
            </Link>
            <button
              type="button"
              onClick={() => {
                setFileName('');
                setRawRows([]);
                setCsvHeaders([]);
                setPreviewData(null);
                setSummary(null);
                setStep(1);
              }}
              className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
            >
              Import Another CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

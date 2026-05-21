import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { API_CONFIG, buildApiUrl } from '@/constants/api';
import { Loader2, Upload, RefreshCw } from 'lucide-react';

type Course = { id: string; course_name: string; course_code: string | null };

type RosterRow = {
  id: string;
  first_name: string;
  last_name: string;
  college_email: string;
  mobile: string | null;
  status: 'pending' | 'invited' | 'signed_up';
  invited_at: string | null;
  signed_up_at: string | null;
  course_id: string;
  college_courses?: { course_name: string; course_code: string | null } | null;
};

type CsvPreviewRow = {
  first_name: string;
  last_name: string;
  college_email: string;
  mobile?: string;
  valid: boolean;
};

// ── Column alias resolution (mirrors the Python side) ───────────────────────
const COLUMN_ALIASES: Record<string, string[]> = {
  first_name:    ['first_name','firstname','first name','fname','given_name','given name','name'],
  last_name:     ['last_name','lastname','last name','lname','surname','family_name','family name'],
  college_email: ['college_email','email','email_address','email address','college email',
                  'institutional_email','institutional email','institute_email',
                  'institute email','student_email','student email','mail'],
  mobile:        ['mobile','mobile_number','mobile number','mobile_no','mobile no',
                  'phone','phone_number','phone number','phone_no','phone no',
                  'contact','contact_number','contact number','cell','cell_number'],
};

function resolveHeader(raw: string): string | null {
  const norm = raw.trim().toLowerCase().replace(/[\s\-_]+/g, ' ');
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      if (norm === alias.toLowerCase().replace(/[\s\-_]+/g, ' ')) return canonical;
    }
  }
  return null;
}

/** Parse CSV or XLSX/XLS into preview rows using SheetJS + alias resolution. */
function parseFilePreview(file: File): Promise<CsvPreviewRow[]> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
        if (allRows.length < 2) { resolve([]); return; }

        const headerRow = (allRows[0] as unknown[]).map(h => String(h ?? '').trim());
        const colMap: Record<number, string> = {};
        headerRow.forEach((h, i) => {
          const canonical = resolveHeader(h);
          if (canonical) colMap[i] = canonical;
        });

        const preview: CsvPreviewRow[] = [];
        for (const rawRow of allRows.slice(1)) {
          const arr = rawRow as unknown[];
          if (arr.every(v => String(v ?? '').trim() === '')) continue;

          const mapped: Record<string, string> = {};
          Object.entries(colMap).forEach(([idx, canonical]) => {
            mapped[canonical] = String(arr[Number(idx)] ?? '').trim();
          });

          const first_name    = mapped.first_name ?? '';
          const last_name     = mapped.last_name ?? '';
          const college_email = (mapped.college_email ?? '').toLowerCase();
          const mobile        = mapped.mobile || undefined;
          const valid = Boolean(first_name && last_name && college_email.includes('@'));
          preview.push({ first_name, last_name, college_email, mobile, valid });
        }
        resolve(preview);
      } catch {
        resolve([]);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function statusLabel(status: string) {
  if (status === 'pending') return 'Pending';
  if (status === 'invited') return 'Invited';
  if (status === 'signed_up') return 'Signed up';
  return status;
}

export default function TpoBulkInvitePanel() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CsvPreviewRow[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [rosterPage, setRosterPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const PAGE_SIZE = 15;

  const getAuthHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const h: Record<string, string> = {};
    if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
    return h;
  };

  const loadCourses = useCallback(async () => {
    setLoadingCourses(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TPO_COLLEGE_COURSES), { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load courses');
      const list = (data.courses || []) as Course[];
      setCourses(list);
      if (list.length === 1) setCourseId(list[0].id);
    } catch (e) {
      toast({
        title: 'Could not load courses',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
    setLoadingCourses(false);
  }, [toast]);

  const loadRoster = useCallback(async () => {
    setLoadingRoster(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TPO_ROSTER_LIST), { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load roster');
      setRoster((data.roster || []) as RosterRow[]);
    } catch (e) {
      toast({
        title: 'Could not load roster',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
    setLoadingRoster(false);
  }, [toast]);

  useEffect(() => {
    void loadCourses();
    void loadRoster();
  }, [loadCourses, loadRoster]);

  useEffect(() => {
    setRosterPage(0);
  }, [statusFilter, searchQuery, courseId]);

  const counts = useMemo(() => {
    const pending = roster.filter((r) => r.status === 'pending').length;
    const invited = roster.filter((r) => r.status === 'invited').length;
    const signedUp = roster.filter((r) => r.status === 'signed_up').length;
    const total = roster.length || 1;
    return { pending, invited, signedUp, rate: Math.round((signedUp / total) * 100) };
  }, [roster]);

  const filteredRoster = useMemo(() => {
    return roster.filter((r) => {
      const matchCourse = !courseId || r.course_id === courseId;
      const matchStatus = !statusFilter || r.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchSearch = !q ||
        `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
        r.college_email.toLowerCase().includes(q);
      return matchCourse && matchStatus && matchSearch;
    });
  }, [roster, courseId, statusFilter, searchQuery]);

  const pagedRoster = useMemo(() => {
    const start = rosterPage * PAGE_SIZE;
    return filteredRoster.slice(start, start + PAGE_SIZE);
  }, [filteredRoster, rosterPage]);

  const totalPages = Math.ceil(filteredRoster.length / PAGE_SIZE) || 1;

  const handleFileChange = (file: File | null) => {
    setCsvFile(file);
    setCsvPreview([]);
    if (!file) return;
    void parseFilePreview(file).then(setCsvPreview);
  };

  const handleUploadAndSend = async () => {
    if (!courseId) {
      toast({ title: 'Select a course first', variant: 'destructive' });
      return;
    }
    if (!csvFile) {
      toast({ title: 'Choose a CSV file', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const headers = await getAuthHeaders();
      const form = new FormData();
      form.append('file', csvFile);
      form.append('course_id', courseId);
      const uploadRes = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TPO_ROSTER_UPLOAD), {
        method: 'POST',
        headers,
        body: form,
      });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

      const newIds: string[] = (uploadData.rows || [])
        .filter((r: { status: string; roster_id?: string }) => r.status === 'inserted' && r.roster_id)
        .map((r: { roster_id: string }) => r.roster_id);

      let sent = 0, failed = 0;
      if (newIds.length > 0) {
        const sendRes = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TPO_ROSTER_SEND_INVITES), {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ course_id: courseId, roster_ids: newIds }),
        });
        const sendData = await sendRes.json().catch(() => ({}));
        if (sendRes.ok) {
          sent = sendData.sent;
          failed = sendData.failed;
        }
      }

      toast({
        title: 'Done',
        description: `Imported ${uploadData.inserted}, skipped ${uploadData.skipped}, sent ${sent} emails${failed ? `, ${failed} failed` : ''}`,
      });
      setCsvFile(null);
      setCsvPreview([]);
      await loadRoster();
    } catch (e) {
      toast({
        title: 'Failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
    setUploading(false);
  };

  const sendInvites = async (rosterIds: string[]) => {
    if (!courseId) {
      toast({ title: 'Select a course', variant: 'destructive' });
      return;
    }
    if (rosterIds.length === 0) {
      toast({ title: 'No students selected', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TPO_ROSTER_SEND_INVITES), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: courseId, roster_ids: rosterIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Send failed');
      toast({
        title: 'Invites sent',
        description: `Sent ${data.sent}, failed ${data.failed}`,
      });
      await loadRoster();
    } catch (e) {
      toast({
        title: 'Send failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
    setSending(false);
  };

  const previewValid = csvPreview.filter((r) => r.valid).length;
  const previewInvalid = csvPreview.length - previewValid;

  return (
    <div className="space-y-4 w-full">

      {/* Page header — stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 whitespace-nowrap">Bulk student invite</h2>
        <Select value={courseId} onValueChange={setCourseId} disabled={loadingCourses}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder={loadingCourses ? 'Loading…' : 'Select course'} />
          </SelectTrigger>
          <SelectContent>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.course_name}{c.course_code ? ` (${c.course_code})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stat strip — 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: roster.length, color: 'text-gray-700' },
          { label: 'Pending', value: counts.pending, color: 'text-amber-700' },
          { label: 'Invited', value: counts.invited, color: 'text-sky-700' },
          { label: 'Signed up', value: counts.signedUp, color: 'text-emerald-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-2xl font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Upload card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Upload className="h-5 w-5 shrink-0" />
            Upload CSV / Excel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>CSV file</Label>
            <InputLikeFile accept=".csv,.xlsx,.xls" onFile={handleFileChange} />
          </div>

          {csvPreview.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Preview: {previewValid} valid, {previewInvalid} invalid (of {csvPreview.length})
              </p>
              <div className="overflow-x-auto border rounded-md max-h-48">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-2">First</th>
                      <th className="text-left p-2">Last</th>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{row.first_name}</td>
                        <td className="p-2">{row.last_name}</td>
                        <td className="p-2 break-all">{row.college_email}</td>
                        <td className="p-2">{row.valid ? 'OK' : 'Invalid'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Button
            onClick={handleUploadAndSend}
            disabled={uploading || !csvFile || !courseId}
            className="w-full sm:w-auto"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Upload &amp; send invites
          </Button>
        </CardContent>
      </Card>

      {/* Roster card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base sm:text-lg">
            Roster
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({filteredRoster.length} students)
            </span>
          </CardTitle>
          {/* Filters row — wraps on mobile */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <input
              type="search"
              placeholder="Search name or email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border rounded-md px-3 py-1.5 text-sm w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <div className="flex items-center gap-2">
              <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="flex-1 sm:w-36 h-9 text-sm">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="signed_up">Signed up</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => loadRoster()} disabled={loadingRoster}>
                <RefreshCw className={`h-4 w-4 ${loadingRoster ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loadingRoster ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
            </div>
          ) : filteredRoster.length === 0 ? (
            <p className="text-sm text-gray-500 p-6">
              {roster.length === 0
                ? 'No roster yet. Upload a CSV to get started.'
                : 'No students match your filter.'}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead className="bg-slate-50 border-y">
                    <tr>
                      <th className="text-left px-3 sm:px-4 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Name</th>
                      <th className="text-left px-3 sm:px-4 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Email</th>
                      <th className="text-left px-3 sm:px-4 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide hidden sm:table-cell">Course</th>
                      <th className="text-left px-3 sm:px-4 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                      <th className="text-left px-3 sm:px-4 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRoster.map((row) => {
                      const courseName =
                        row.college_courses?.course_name ||
                        courses.find((c) => c.id === row.course_id)?.course_name || '—';
                      return (
                        <tr key={row.id} className="border-t hover:bg-slate-50">
                          <td className="px-3 sm:px-4 py-2 whitespace-nowrap">{row.first_name} {row.last_name}</td>
                          <td className="px-3 sm:px-4 py-2 font-mono text-xs break-all">{row.college_email}</td>
                          <td className="px-3 sm:px-4 py-2 hidden sm:table-cell">{courseName}</td>
                          <td className="px-3 sm:px-4 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              row.status === 'signed_up' ? 'bg-emerald-100 text-emerald-800' :
                              row.status === 'invited'   ? 'bg-sky-100 text-sky-800' :
                                                           'bg-amber-100 text-amber-800'
                            }`}>
                              {statusLabel(row.status)}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-2">
                            {row.status !== 'signed_up' && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={sending}
                                onClick={() => { setCourseId(row.course_id); void sendInvites([row.id]); }}
                              >
                                Resend
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-t gap-2">
                <span className="text-xs text-gray-500">
                  {rosterPage * PAGE_SIZE + 1}–{Math.min((rosterPage + 1) * PAGE_SIZE, filteredRoster.length)} of {filteredRoster.length}
                </span>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Button variant="ghost" size="sm" disabled={rosterPage === 0} onClick={() => setRosterPage(p => p - 1)}>‹</Button>
                  <span className="text-xs text-gray-500">{rosterPage + 1} / {totalPages}</span>
                  <Button variant="ghost" size="sm" disabled={rosterPage >= totalPages - 1} onClick={() => setRosterPage(p => p + 1)}>›</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InputLikeFile({
  accept,
  onFile,
}: {
  accept: string;
  onFile: (f: File | null) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        accept={accept}
        className="text-sm w-full file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-sky-50 file:text-sky-700"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

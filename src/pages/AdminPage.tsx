import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Megaphone,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserX,
  Users,
  Volume2,
  X,
  XCircle,
} from 'lucide-react';
import { DepartmentLogo, SiteFooter } from '../components/Layout';
import { speakThaiQueueCall, unlockQueueAudio } from '../lib/api';
import {
  PRIMARY_ADMIN_EMAIL,
  auth,
  googleProvider,
} from '../lib/firebase';
import {
  type AdminDaySnapshot,
  type StaffAdminRecord,
  addStaffAdmin,
  adminCallNext,
  adminRecallQueue,
  adminUpdateBookingStatus,
  checkIsAdminEmail,
  listStaffAdmins,
  removeStaffAdmin,
  subscribeAdminDayBookings,
} from '../lib/queueService';
import {
  BookingRecord,
  BookingStatus,
  CHANNELS,
  ChannelId,
  OFFICE_INFO,
  SERVICES,
  STATUS_LABELS,
  addDaysDateStr,
  formatQueueNoDisplay,
  formatSlotTime,
  formatThaiDate,
  getBangkokDateString,
  getServiceById,
} from '../shared/bookingConfig';

const STATUS_BADGE_CLASSES: Record<BookingStatus, string> = {
  waiting: 'bg-amber-50 text-amber-700 ring-amber-200',
  called: 'bg-blue-50 text-blue-700 ring-blue-200',
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  no_show: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const FILTER_TABS: Array<{ id: 'all' | BookingStatus; label: string }> = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'waiting', label: 'รอรับบริการ' },
  { id: 'called', label: 'กำลังเรียกคิว' },
  { id: 'done', label: 'เสร็จสิ้น' },
  { id: 'no_show', label: 'ไม่มาตามนัด' },
  { id: 'cancelled', label: 'ยกเลิก' },
];

export function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<
    'checking' | 'signed_out' | 'unauthorized' | 'ready'
  >('checking');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        setAuthState('signed_out');
        return;
      }
      setUser(nextUser);
      if (!nextUser.emailVerified) {
        setAuthState('unauthorized');
        return;
      }
      const allowed = await checkIsAdminEmail(nextUser.email);
      setAuthState(allowed ? 'ready' : 'unauthorized');
    });
    return () => unsub();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
  }, []);

  if (authState === 'checking') {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (authState === 'signed_out' || authState === 'unauthorized') {
    return (
      <AdminAuthScreen
        unauthorizedUser={authState === 'unauthorized' ? user : null}
        onLogout={handleLogout}
      />
    );
  }

  return <AdminDashboard user={user!} onLogout={handleLogout} />;
}

function AdminAuthScreen({
  unauthorizedUser,
  onLogout,
}: {
  unauthorizedUser: User | null;
  onLogout: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'ไม่สามารถเข้าสู่ระบบด้วยบัญชี Google ได้',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-cream">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                ระบบเจ้าหน้าที่จัดการคิว
              </h1>
              <p className="text-xs text-slate-500">{OFFICE_INFO.name}</p>
            </div>
          </div>

          {unauthorizedUser ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
                <p className="font-semibold">บัญชีนี้ยังไม่มีสิทธิ์เข้าใช้งานส่วนเจ้าหน้าที่</p>
                <p className="mt-1 font-mono">{unauthorizedUser.email}</p>
                <p className="mt-2 text-amber-800">
                  กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลหลัก หรือให้ผู้ดูแลระบบเพิ่มอีเมลของคุณในเมนู &ldquo;สิทธิ์เจ้าหน้าที่&rdquo;
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-ink-2 disabled:opacity-50"
                >
                  เปลี่ยนบัญชี Google
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  ออกจากระบบ
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <p className="text-sm leading-relaxed text-slate-600">
                กรุณาเข้าสู่ระบบด้วยบัญชี Google ที่ได้รับอนุญาตเพื่อเข้าสู่แผงควบคุมการเรียกคิว (ข้อมูลถูกบันทึกถาวรในฐานข้อมูลระบบคิว)
              </p>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
                >
                  {error}
                </p>
              )}

              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-cream transition hover:bg-ink-2 disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                  />
                </svg>
                {loading
                  ? 'กำลังเชื่อมต่อบัญชี Google...'
                  : 'เข้าสู่ระบบด้วย Google'}
              </button>
            </div>
          )}

          <div className="mt-5 border-t border-slate-100 pt-4 text-center">
            <Link
              to="/"
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              ← กลับหน้าจองคิวสำหรับประชาชน
            </Link>
          </div>
        </div>
      </div>
      <SiteFooter tone="slate" />
    </div>
  );
}

function AdminDashboard({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  const [date, setDate] = useState(() => getBangkokDateString());
  const [data, setData] = useState<AdminDaySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [statusTab, setStatusTab] = useState<'all' | BookingStatus>('all');
  const [notice, setNotice] = useState('');
  const [callingChannel, setCallingChannel] = useState<ChannelId | null>(null);
  const [recallingId, setRecallingId] = useState<string | null>(null);
  const [testingVoice, setTestingVoice] = useState(false);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [selectedCounters, setSelectedCounters] = useState<
    Record<ChannelId, number>
  >({
    general: 1,
    foreign: 1,
  });

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeAdminDayBookings(
      date,
      (snapshot) => {
        setData(snapshot);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        setNotice(err.message);
      },
    );
    return () => unsub();
  }, [date, reloadTick]);

  const handleCallNext = async (channel: ChannelId) => {
    unlockQueueAudio();
    const counter = selectedCounters[channel] ?? 1;
    setCallingChannel(channel);
    setNotice('');
    try {
      const res = await adminCallNext(channel, date, counter);
      setNotice(res.message);
      if (res.called) {
        const ttsRes = await speakThaiQueueCall(res.called.queueNo, counter);
        if (!ttsRes.ok && ttsRes.error) {
          setNotice(`${res.message} · ${ttsRes.error}`);
        }
      }
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : 'ไม่สามารถเรียกคิวถัดไปได้',
      );
    } finally {
      setCallingChannel(null);
    }
  };

  const handleUpdateStatus = async (
    id: string,
    status: BookingStatus,
    channelHint?: ChannelId,
  ) => {
    if (status === 'called') {
      unlockQueueAudio();
    }
    setNotice('');
    const counter =
      status === 'called' && channelHint
        ? (selectedCounters[channelHint] ?? 1)
        : undefined;
    try {
      const updated = await adminUpdateBookingStatus(id, status, counter);
      if (status === 'called') {
        const ttsRes = await speakThaiQueueCall(
          updated.queueNo,
          updated.counter,
        );
        if (!ttsRes.ok && ttsRes.error) {
          setNotice(ttsRes.error);
        }
      }
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : 'ไม่สามารถอัปเดตสถานะได้',
      );
    }
  };

  const handleRecall = async (booking: BookingRecord, counterOverride?: number) => {
    unlockQueueAudio();
    const targetCounter = counterOverride ?? (booking.counter || 1);
    setRecallingId(booking.id);
    setNotice('');
    try {
      const [recallRes, ttsRes] = await Promise.all([
        adminRecallQueue(booking.id, targetCounter),
        speakThaiQueueCall(booking.queueNo, targetCounter),
      ]);
      if (!ttsRes.ok && ttsRes.error) {
        setNotice(`${recallRes.message} · ${ttsRes.error}`);
      } else {
        setNotice(recallRes.message);
      }
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : 'ไม่สามารถเรียกซ้ำคิวได้',
      );
    } finally {
      setRecallingId(null);
    }
  };

  const handleTestVoice = async () => {
    unlockQueueAudio();
    setTestingVoice(true);
    setNotice('');
    try {
      const ttsRes = await speakThaiQueueCall('A-001', 1);
      if (!ttsRes.ok && ttsRes.error) {
        setNotice(ttsRes.error);
      } else {
        setNotice(
          'ทดสอบเสียงประกาศ: ขอเชิญหมายเลข เอ ศูนย์ ศูนย์ หนึ่ง ที่ช่องบริการ หนึ่ง ค่ะ',
        );
      }
    } finally {
      setTestingVoice(false);
    }
  };

  const filteredBookings = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.bookings.filter((b) => {
      if (serviceFilter !== 'all' && b.serviceId !== serviceFilter) {
        return false;
      }
      if (statusTab !== 'all' && b.status !== statusTab) {
        return false;
      }
      if (!q) return true;
      return (
        b.fullName.toLowerCase().includes(q) ||
        b.queueNo.toLowerCase().includes(q) ||
        formatQueueNoDisplay(b.queueNo).toLowerCase().includes(q) ||
        b.bookingCode.toLowerCase().includes(q) ||
        b.phone.toLowerCase().includes(q) ||
        b.idNumber.toLowerCase().includes(q)
      );
    });
  }, [data, search, serviceFilter, statusTab]);

  const countByTab = useCallback(
    (tabId: 'all' | BookingStatus) => {
      if (!data) return 0;
      if (tabId === 'all') return data.bookings.length;
      return data.bookings.filter((b) => b.status === tabId).length;
    },
    [data],
  );

  const serviceBreakdown = useMemo(() => {
    const active =
      data?.bookings.filter((b) => b.status !== 'cancelled') ?? [];
    const total = active.length;
    const items = SERVICES.map((svc) => {
      const n = active.filter((b) => b.serviceId === svc.id).length;
      const pct = total > 0 ? Math.round((n / total) * 100) : 0;
      return { ...svc, n, pct };
    });
    return { total, items };
  }, [data]);

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f9fc] text-slate-900">
      {/* Staff Top Header */}
      <header className="sticky top-0 z-30 border-b border-[#0d204a] bg-[#132d63] text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <DepartmentLogo className="h-11 w-11" />
            <div className="min-w-0">
              <span className="block text-sm font-bold text-white sm:text-base">
                ระบบจัดการคิวเจ้าหน้าที่ · {OFFICE_INFO.short}
              </span>
              {user.email && (
                <span className="hidden sm:block text-[11px] text-white/70">
                  {user.email}
                </span>
              )}
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-5 text-sm font-medium text-white/75">
            <Link to="/" className="hover:text-white whitespace-nowrap">
              หน้าจองคิว
            </Link>
            <Link to="/check" className="hover:text-white whitespace-nowrap">
              ตรวจสอบนัดหมาย
            </Link>
            <Link to="/board" className="hover:text-white whitespace-nowrap">
              หน้าจอเรียกคิว
            </Link>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/kiosk"
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-bold text-[#132d63] shadow-xs transition hover:bg-amber-300 whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5" />
              เครื่องกดบัตรคิว
            </Link>
            <button
              type="button"
              onClick={() => setStaffModalOpen(true)}
              title="จัดการสิทธิ์เจ้าหน้าที่"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/25 whitespace-nowrap"
            >
              <Users className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">สิทธิ์เจ้าหน้าที่</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-[#132d63] transition hover:bg-blue-50 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        {/* Date & Refresh Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDate(addDaysDateStr(date, -1))}
              title="วันก่อนหน้า"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <ChevronLeft className="h-4 w-4" />
              วันก่อนหน้า
            </button>
            <span className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900">
              {formatThaiDate(date)}
            </span>
            <button
              type="button"
              onClick={() => setDate(addDaysDateStr(date, 1))}
              title="วันถัดไป"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              วันถัดไป
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {notice && (
              <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                {notice}
              </span>
            )}
            <button
              type="button"
              disabled={testingVoice}
              onClick={handleTestVoice}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
            >
              <Volume2 className="h-3.5 w-3.5" />
              {testingVoice ? 'กำลังเล่นเสียง...' : 'ทดสอบเสียง'}
            </button>
            <button
              type="button"
              onClick={() => setReloadTick((n) => n + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              รีเฟรช
            </button>
          </div>
        </div>

        {/* Channel Call Cards + Service Breakdown */}
        <div className="grid gap-4 lg:grid-cols-3">
          {data ? (
            <>
              {(['general', 'foreign'] as const).map((chKey) => {
                const ch = data.channels[chKey];
                const meta = CHANNELS[chKey];
                const isForeign = chKey === 'foreign';
                const activeCounter = selectedCounters[chKey] ?? 1;
                const activeCalled =
                  ch.calledByCounter?.[String(activeCounter)] ?? null;
                return (
                  <div
                    key={chKey}
                    className={`flex flex-col justify-between rounded-2xl border p-5 ${
                      isForeign
                        ? 'border-pink-200 bg-gradient-to-br from-pink-50/80 to-white'
                        : 'border-blue-200 bg-gradient-to-br from-blue-50/80 to-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p
                            className={`text-sm font-bold ${
                              isForeign ? 'text-pink-700' : 'text-blue-800'
                            }`}
                          >
                            {meta.label}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {meta.hint}
                          </p>
                        </div>
                        <span className="font-mono text-xs font-semibold tabular-nums text-slate-600 shrink-0">
                          รอรับบริการ {ch.waitingCount} คิว
                        </span>
                      </div>

                      {/* Counter Window Selector */}
                      <div className="mt-4">
                        <p className="mb-1.5 text-[11px] font-medium text-slate-500">
                          เลือกช่องบริการที่จะเรียก
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {meta.counters.map((cNum) => {
                            const selected = activeCounter === cNum;
                            const slotBooking =
                              ch.calledByCounter?.[String(cNum)] ?? null;
                            return (
                              <button
                                key={cNum}
                                type="button"
                                onClick={() =>
                                  setSelectedCounters((prev) => ({
                                    ...prev,
                                    [chKey]: cNum,
                                  }))
                                }
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                                  selected
                                    ? isForeign
                                      ? 'border-pink-600 bg-pink-600 text-white shadow-xs'
                                      : 'border-blue-600 bg-blue-600 text-white shadow-xs'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <span>ช่อง {cNum}</span>
                                {slotBooking && (
                                  <span
                                    className={`rounded px-1 py-0.5 font-mono text-[10px] leading-none tabular-nums ${
                                      selected
                                        ? 'bg-white/20 text-white'
                                        : isForeign
                                          ? 'bg-pink-50 text-pink-700'
                                          : 'bg-blue-50 text-blue-700'
                                    }`}
                                  >
                                    {formatQueueNoDisplay(slotBooking.queueNo)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-xs text-slate-500">
                          กำลังเรียกคิว · ช่องบริการ {activeCounter}
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <span
                            className={`font-mono text-5xl font-bold leading-none tabular-nums ${
                              isForeign ? 'text-pink-700' : 'text-blue-800'
                            }`}
                          >
                            {activeCalled
                              ? formatQueueNoDisplay(activeCalled.queueNo)
                              : '—'}
                          </span>
                          {activeCalled && (
                            <button
                              type="button"
                              disabled={recallingId === activeCalled.id}
                              onClick={() =>
                                handleRecall(activeCalled, activeCounter)
                              }
                              title="ประกาศเสียงเรียกซ้ำ"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                              {recallingId === activeCalled.id
                                ? 'กำลังเรียกซ้ำ...'
                                : 'เรียกซ้ำ'}
                            </button>
                          )}
                        </div>
                        {activeCalled && (
                          <p className="mt-2 truncate text-xs text-slate-600">
                            {activeCalled.fullName} · รอบ{' '}
                            <span className="font-mono tabular-nums">
                              {formatSlotTime(activeCalled.slotId)}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 border-t border-slate-200/70 pt-4">
                      <button
                        type="button"
                        disabled={callingChannel === chKey}
                        onClick={() => handleCallNext(chKey)}
                        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 ${
                          isForeign
                            ? 'bg-pink-600 hover:bg-pink-700'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        <Megaphone className="h-4 w-4" />
                        {ch.nextWaiting
                          ? `เรียกคิวถัดไป (${formatQueueNoDisplay(ch.nextWaiting.queueNo)}) → ช่อง ${activeCounter}`
                          : activeCalled
                            ? `ปิดคิวช่อง ${activeCounter} (ไม่มีคิวรอ)`
                            : 'ไม่มีคิวรอ'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <div className="h-[260px] animate-pulse rounded-2xl bg-slate-200/70" />
              <div className="h-[260px] animate-pulse rounded-2xl bg-slate-200/70" />
            </>
          )}

          {/* Service Proportion Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-slate-900">
                สัดส่วนผู้ใช้บริการแต่ละประเภท
              </h2>
              <span className="font-mono text-xs tabular-nums text-slate-500">
                รวม {serviceBreakdown.total} คน
              </span>
            </div>

            <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
              {serviceBreakdown.items.map(
                (item) =>
                  item.n > 0 && (
                    <div
                      key={item.id}
                      style={{
                        width: `${(item.n / serviceBreakdown.total) * 100}%`,
                        background: item.color,
                      }}
                    />
                  ),
              )}
            </div>

            <ul className="mt-4 space-y-3">
              {serviceBreakdown.items.map((item) => (
                <li key={item.id}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-slate-700">
                      {item.prefix}. {item.title}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-slate-500">
                      {item.n} ({item.pct}%)
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${item.pct}%`,
                        background: item.color,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Queue Management Table Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">จัดการคิว</h2>
            <div className="flex flex-wrap gap-2">
              <label className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหา ชื่อ / คิว / รหัส / เบอร์"
                  className="w-64 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400"
                />
              </label>

              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                <option value="all">ทุกบริการ</option>
                {SERVICES.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="mt-4 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 text-sm">
            {FILTER_TABS.map((tab) => {
              const active = statusTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusTab(tab.id)}
                  className={`whitespace-nowrap rounded-lg px-4 py-1.5 transition ${
                    active
                      ? 'bg-white font-semibold text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}{' '}
                  <span className="font-mono text-xs tabular-nums text-slate-400">
                    {countByTab(tab.id)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">คิว</th>
                  <th className="px-4 py-3 font-medium">รอบเวลา</th>
                  <th className="px-4 py-3 font-medium">ผู้จอง</th>
                  <th className="px-4 py-3 font-medium">บริการ</th>
                  <th className="px-4 py-3 font-medium">สถานะ</th>
                  <th className="px-4 py-3 text-right font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.map((b) => {
                  const svc = getServiceById(b.serviceId);
                  const ch = svc ? CHANNELS[svc.channel] : null;
                  const isActive =
                    b.status === 'waiting' || b.status === 'called';

                  return (
                    <tr
                      key={b.id}
                      className={b.status === 'called' ? 'bg-blue-50/40' : ''}
                    >
                      <td className="px-4 py-3">
                        <p
                          className={`font-mono text-base font-bold tabular-nums ${
                            svc?.channel === 'foreign'
                              ? 'text-pink-600'
                              : 'text-blue-700'
                          }`}
                        >
                          {formatQueueNoDisplay(b.queueNo)}
                        </p>
                        <p className="font-mono text-[11px] tabular-nums text-slate-400">
                          {b.bookingCode}
                        </p>
                      </td>

                      <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-700">
                        {formatSlotTime(b.slotId)}
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {b.fullName}
                        </p>
                        <p className="font-mono text-[11px] tabular-nums text-slate-500">
                          {b.phone} · {b.idNumber}
                        </p>
                        {b.note && (
                          <p
                            className="mt-0.5 max-w-xs truncate text-[11px] text-slate-400"
                            title={b.note}
                          >
                            {b.note}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <p
                          className="text-xs font-medium"
                          style={{ color: svc?.color }}
                        >
                          {svc?.title ?? b.serviceTitle}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {ch?.label ?? ''}
                          {b.status === 'called' || b.status === 'done'
                            ? ` · ช่องบริการ ${b.counter}`
                            : ' · รอเรียกช่องบริการ'}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-md px-2.5 py-1 text-[11px] font-medium ring-1 whitespace-nowrap ${STATUS_BADGE_CLASSES[b.status]}`}
                        >
                          {STATUS_LABELS[b.status]}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {isActive ? (
                            <>
                              {b.status === 'waiting' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateStatus(b.id, 'called', b.channel)
                                  }
                                  className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 whitespace-nowrap"
                                >
                                  <Megaphone className="h-3.5 w-3.5" />
                                  เรียก (ช่อง {selectedCounters[b.channel]})
                                </button>
                              )}
                              {b.status === 'called' && (
                                <button
                                  type="button"
                                  disabled={recallingId === b.id}
                                  onClick={() => handleRecall(b)}
                                  className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 whitespace-nowrap"
                                >
                                  <Volume2 className="h-3.5 w-3.5" />
                                  {recallingId === b.id
                                    ? 'กำลังเรียก...'
                                    : 'เรียกซ้ำ'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(b.id, 'done')}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 whitespace-nowrap"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                เสร็จสิ้น
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateStatus(b.id, 'no_show')
                                }
                                className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 whitespace-nowrap"
                              >
                                <UserX className="h-3.5 w-3.5" />
                                ไม่มา
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateStatus(b.id, 'cancelled')
                                }
                                className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 whitespace-nowrap"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                ยกเลิก
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateStatus(b.id, 'waiting')
                              }
                              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 whitespace-nowrap"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              คืนสถานะรอ
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredBookings.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-sm text-slate-400"
                    >
                      {loading ? (
                        <RefreshCw className="mx-auto h-5 w-5 animate-spin" />
                      ) : (
                        'ไม่มีรายการคิวในเงื่อนไขที่เลือก'
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {staffModalOpen && (
        <StaffAllowlistModal
          currentEmail={user.email ?? PRIMARY_ADMIN_EMAIL}
          onClose={() => setStaffModalOpen(false)}
        />
      )}

      <SiteFooter tone="slate" />
    </div>
  );
}

function StaffAllowlistModal({
  currentEmail,
  onClose,
}: {
  currentEmail: string;
  onClose: () => void;
}) {
  const [staffList, setStaffList] = useState<StaffAdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const items = await listStaffAdmins();
      setStaffList(items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'ไม่สามารถโหลดรายชื่อเจ้าหน้าที่ได้',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await addStaffAdmin(emailInput, nameInput, currentEmail);
      setEmailInput('');
      setNameInput('');
      await loadList();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'ไม่สามารถเพิ่มเจ้าหน้าที่ได้',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (email: string) => {
    setError('');
    try {
      await removeStaffAdmin(email);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถลบสิทธิ์ได้');
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              จัดการสิทธิ์เจ้าหน้าที่ (Google Account)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              ผู้ดูแลหลัก: {PRIMARY_ADMIN_EMAIL}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleAdd} className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="อีเมล Google เจ้าหน้าที่"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="ชื่อเจ้าหน้าที่ (ไม่บังคับ)"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-cream transition hover:bg-ink-2 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {saving ? 'กำลังบันทึก...' : 'เพิ่มบัญชีเจ้าหน้าที่'}
          </button>
        </form>

        <div className="mt-5 max-h-60 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2.5 text-xs">
            <div>
              <p className="font-mono font-semibold text-slate-900">
                {PRIMARY_ADMIN_EMAIL}
              </p>
              <p className="text-[11px] text-slate-500">ผู้ดูแลระบบหลัก (ถาวร)</p>
            </div>
            <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              Admin หลัก
            </span>
          </div>

          {loading ? (
            <div className="py-6 text-center text-xs text-slate-400">
              กำลังโหลดรายชื่อ...
            </div>
          ) : staffList.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              ยังไม่มีบัญชีเจ้าหน้าที่เพิ่มเติม
            </div>
          ) : (
            staffList.map((s) => (
              <div
                key={s.email}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono font-medium text-slate-900">
                    {s.email}
                  </p>
                  {s.displayName && (
                    <p className="truncate text-[11px] text-slate-500">
                      {s.displayName}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(s.email)}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
                >
                  <Trash2 className="h-3 w-3" />
                  ลบสิทธิ์
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

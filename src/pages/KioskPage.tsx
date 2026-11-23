import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  Printer,
  RotateCcw,
} from 'lucide-react';
import { DepartmentLogo } from '../components/Layout';
import { ServiceIcon } from '../components/ServiceIcon';
import { issueKioskTicket } from '../lib/queueService';
import {
  BookingRecord,
  CHANNELS,
  OFFICE_INFO,
  SERVICES,
  ServiceId,
  formatQueueNoDisplay,
  formatSlotTime,
  formatThaiDate,
  getBangkokDateString,
} from '../shared/bookingConfig';

function formatLiveBangkokClock(now: Date): string {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
}

export function KioskPage() {
  const [now, setNow] = useState(() => new Date());
  const [issuingId, setIssuingId] = useState<ServiceId | null>(null);
  const [issuedBooking, setIssuedBooking] = useState<BookingRecord | null>(
    null,
  );
  const [error, setError] = useState('');
  const [autoResetSeconds, setAutoResetSeconds] = useState<number | null>(null);
  const printedTicketIdRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-print immediately once the issued ticket card has rendered, then start reset countdown
  useEffect(() => {
    if (!issuedBooking) {
      setAutoResetSeconds(null);
      return;
    }

    if (printedTicketIdRef.current !== issuedBooking.id) {
      printedTicketIdRef.current = issuedBooking.id;
      const printTimer = window.setTimeout(() => {
        try {
          window.print();
        } catch {
          // Ignore if browser blocks automatic print dialog
        }
        setAutoResetSeconds(8);
      }, 150);
      return () => window.clearTimeout(printTimer);
    }
  }, [issuedBooking]);

  useEffect(() => {
    if (autoResetSeconds === null) return;
    if (autoResetSeconds <= 0) {
      setIssuedBooking(null);
      setAutoResetSeconds(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setAutoResetSeconds((s) => (s !== null ? s - 1 : null));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [autoResetSeconds]);

  const handleSelectService = async (serviceId: ServiceId) => {
    if (issuingId) return;
    setError('');
    setIssuingId(serviceId);
    try {
      const booking = await issueKioskTicket(serviceId);
      setIssuedBooking(booking);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'ไม่สามารถออกบัตรคิวได้ กรุณาลองใหม่อีกครั้ง',
      );
    } finally {
      setIssuingId(null);
    }
  };

  const handleReset = () => {
    setIssuedBooking(null);
    setAutoResetSeconds(null);
    setError('');
  };

  const todayStr = getBangkokDateString(now);

  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      {/* Kiosk Top Bar */}
      <header className="no-print sticky top-0 z-30 border-b border-[#0d204a] bg-[#132d63] text-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <DepartmentLogo className="h-11 w-11" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white sm:text-base">
                {OFFICE_INFO.name}
              </p>
              <p className="text-[11px] text-white/75">
                เครื่องกดบัตรคิวอัตโนมัติ (หน้าเคาน์เตอร์)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white">
              <Clock className="h-3.5 w-3.5 text-amber-300" />
              <span className="font-mono tabular-nums">
                {formatLiveBangkokClock(now)} น.
              </span>
            </div>

            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-[#132d63] transition hover:bg-blue-50 whitespace-nowrap"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              กลับหน้าเจ้าหน้าที่
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-8 sm:px-6">
        {issuedBooking ? (
          <div className="flex flex-col items-center">
            <div className="no-print mb-5 flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>ออกบัตรคิวและบันทึกเข้าสู่ระบบเรียบร้อยแล้ว</span>
            </div>

            {/* Printable Ticket Receipt */}
            <div className="print-area w-full max-w-[380px] overflow-hidden rounded-3xl border border-sand bg-white shadow-xl shadow-ink/10">
              <div className="bg-ink px-6 py-5 text-center text-cream">
                <div className="mx-auto mb-2 flex justify-center">
                  <DepartmentLogo className="h-12 w-12" />
                </div>
                <p className="text-xs font-semibold text-cream/85">
                  {OFFICE_INFO.name}
                </p>
                <p className="mt-0.5 text-[11px] text-cream/65">
                  บัตรคิวรับบริการ (เครื่องกดบัตรคิว)
                </p>
              </div>

              <div className="px-6 py-6 text-center">
                <p className="text-xs font-medium text-ink/60">หมายเลขคิว</p>
                <p className="mt-1 font-mono text-6xl font-bold tracking-wider tabular-nums text-ink">
                  {formatQueueNoDisplay(issuedBooking.queueNo)}
                </p>

                <div className="mt-5 rounded-2xl border border-sand/80 bg-cream px-4 py-3.5 text-left">
                  <p className="text-[11px] text-ink/55">ประเภทบริการ</p>
                  <p className="mt-0.5 text-sm font-bold leading-snug text-ink">
                    {issuedBooking.serviceTitle}
                  </p>
                  <p className="mt-1 text-xs font-medium text-ink-2">
                    {CHANNELS[issuedBooking.channel]?.label ?? ''}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-dashed border-sand pt-4 text-left text-xs">
                  <div>
                    <p className="text-[11px] text-ink/55">วันที่รับบริการ</p>
                    <p className="mt-0.5 font-medium text-ink">
                      {formatThaiDate(issuedBooking.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-ink/55">เวลาที่กดบัตรคิว</p>
                    <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-ink">
                      {issuedBooking.issuedTime
                        ? `${issuedBooking.issuedTime} น.`
                        : formatSlotTime(issuedBooking.slotId)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 border-t border-sand/70 pt-3 text-center text-[11px] text-ink/60 space-y-1">
                  <p className="font-mono">
                    รหัสอ้างอิง: {issuedBooking.bookingCode}
                  </p>
                  <p>กรุณารอเรียกหมายเลขคิวของท่านที่หน้าจอแสดงผล</p>
                </div>
              </div>
            </div>

            <div className="no-print mt-6 grid w-full max-w-[380px] grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setAutoResetSeconds(null);
                  window.print();
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-sand bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-slate-50 whitespace-nowrap"
              >
                <Printer className="h-4 w-4" />
                พิมพ์ซ้ำ
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-cream transition hover:bg-ink-2 whitespace-nowrap"
              >
                <RotateCcw className="h-4 w-4" />
                {autoResetSeconds !== null
                  ? `เสร็จสิ้น (${autoResetSeconds})`
                  : 'รับบัตรคิวใหม่'}
              </button>
            </div>
          </div>
        ) : (
          <div className="no-print">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  เลือกบริการที่ต้องการ
                </h1>
                <p className="mt-1 text-sm text-ink/65">
                  แตะเลือกประเภทบริการเพื่อรับรหัสคิวและพิมพ์บัตรคิวทันที
                </p>
              </div>
              <p className="text-xs font-medium text-ink/65">
                {formatThaiDate(todayStr)} ·{' '}
                <span className="font-mono font-semibold tabular-nums text-ink">
                  {formatLiveBangkokClock(now)} น.
                </span>
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <ul className="mt-5 divide-y divide-sand/80 overflow-hidden rounded-2xl border border-sand bg-white shadow-sm">
              {SERVICES.map((svc) => {
                const channel = CHANNELS[svc.channel];
                const isIssuing = issuingId === svc.id;
                return (
                  <li key={svc.id}>
                    <button
                      type="button"
                      disabled={Boolean(issuingId)}
                      onClick={() => handleSelectService(svc.id)}
                      className="group flex w-full items-start gap-4 px-5 py-5 text-left transition hover:bg-blue-50/50 active:bg-blue-50 disabled:opacity-60"
                    >
                      <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sand/65 text-ink/75 transition group-hover:bg-ink group-hover:text-cream">
                        <ServiceIcon serviceId={svc.id} className="h-5 w-5" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-[18px] font-semibold text-ink">
                          {svc.title}
                        </span>
                        <span className="mt-1 block text-sm leading-relaxed text-ink/70">
                          {svc.description}
                        </span>
                        <span className="mt-2 block text-xs text-ink/55">
                          {channel.label} · หมวดคิว {svc.prefix} ·{' '}
                          {svc.durationHint}
                        </span>
                      </span>

                      {isIssuing ? (
                        <Loader2 className="mt-3 h-5 w-5 shrink-0 animate-spin text-ink" />
                      ) : (
                        <ChevronRight className="mt-3 h-5 w-5 shrink-0 text-ink/35 transition group-hover:translate-x-0.5 group-hover:text-ink/75" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  CalendarClock,
  CheckCircle2,
  Loader2,
  Printer,
  Search,
  XCircle,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DateSlotPicker } from '../components/DateSlotPicker';
import { ETicketCard } from '../components/ETicketCard';
import {
  cancelCitizenBooking,
  lookupCitizenBooking,
  rescheduleCitizenBooking,
} from '../lib/queueService';
import {
  BookingRecord,
  CHANNELS,
  formatQueueNoDisplay,
  formatSlotTime,
  formatThaiDate,
  normalizeIdNumber,
} from '../shared/bookingConfig';

interface LookupState {
  bookingCode?: string;
  idNumber?: string;
  fullName?: string;
}

export function CheckPage() {
  const location = useLocation();
  const initialState = (location.state as LookupState | null) ?? {};

  const [bookingCode, setBookingCode] = useState(
    initialState.bookingCode ?? '',
  );
  const [idNumber, setIdNumber] = useState(initialState.idNumber ?? '');
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [nowServing, setNowServing] = useState<BookingRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [mode, setMode] = useState<'view' | 'reschedule'>('view');
  const [newDate, setNewDate] = useState('');
  const [newSlotId, setNewSlotId] = useState('');
  const [mutating, setMutating] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const credentials = () => ({
    bookingCode: bookingCode.trim().toUpperCase(),
    idNumber: normalizeIdNumber(idNumber),
  });

  const performLookup = useCallback(
    async (codeArg?: string, idArg?: string, nameHint?: string) => {
      const code = (codeArg ?? bookingCode).trim().toUpperCase();
      const id = normalizeIdNumber(idArg ?? idNumber);

      setError('');
      setSuccessMsg('');
      setMode('view');

      if (!code || !id) {
        setError('กรุณากรอกรหัสการจองและเลขบัตร');
        return;
      }

      setLoading(true);
      try {
        const res = await lookupCitizenBooking(code, id);
        const resolved =
          nameHint && res.booking.bookingCode === code
            ? { ...res.booking, fullName: nameHint }
            : res.booking;
        setBooking(resolved);
        setNowServing(res.nowServing);
        setNewDate(resolved.date);
        setNewSlotId(resolved.slotId);
      } catch (err) {
        setBooking(null);
        setNowServing(null);
        setError(
          err instanceof Error
            ? err.message
            : 'ไม่พบข้อมูลนัดหมาย โปรดตรวจสอบอีกครั้ง',
        );
      } finally {
        setLoading(false);
      }
    },
    [bookingCode, idNumber],
  );

  useEffect(() => {
    if (initialState.bookingCode && initialState.idNumber) {
      void performLookup(
        initialState.bookingCode,
        initialState.idNumber,
        initialState.fullName,
      );
    }
  }, []);

  const handleSubmitLookup = (e: FormEvent) => {
    e.preventDefault();
    void performLookup();
  };

  const handleReschedule = async () => {
    if (!newDate || !newSlotId) return;
    setMutating(true);
    setError('');
    setSuccessMsg('');
    try {
      const updated = await rescheduleCitizenBooking({
        ...credentials(),
        date: newDate,
        slotId: newSlotId,
      });
      setBooking((prev) =>
        prev && initialState.fullName && prev.bookingCode === updated.bookingCode
          ? { ...updated, fullName: initialState.fullName }
          : updated,
      );
      setMode('view');
      setSuccessMsg(
        `เลื่อนนัดเรียบร้อยแล้ว เป็น${formatThaiDate(updated.date)} เวลา ${formatSlotTime(updated.slotId)}`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'ไม่สามารถเลื่อนนัดหมายได้',
      );
    } finally {
      setMutating(false);
    }
  };

  const handleConfirmCancel = async () => {
    setMutating(true);
    setError('');
    setSuccessMsg('');
    try {
      const updated = await cancelCitizenBooking(credentials());
      setBooking((prev) =>
        prev && initialState.fullName && prev.bookingCode === updated.bookingCode
          ? { ...updated, fullName: initialState.fullName }
          : updated,
      );
      setCancelOpen(false);
      setMode('view');
      setSuccessMsg('ยกเลิกนัดหมายเรียบร้อยแล้ว');
    } catch (err) {
      setCancelOpen(false);
      setError(
        err instanceof Error ? err.message : 'ไม่สามารถยกเลิกนัดหมายได้',
      );
    } finally {
      setMutating(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="no-print mb-8 border-b border-sand/80 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          ตรวจสอบ / เลื่อนนัด / ยกเลิกคิว
        </h1>
        <p className="mt-1 text-sm text-ink/65">
          ระบุรหัสการจองและเลขบัตรประจำตัวประชาชน (หรือเลขหนังสือเดินทาง) เพื่อดูบัตรคิวและจัดการนัดหมาย
        </p>

        <form
          onSubmit={handleSubmitLookup}
          className="mt-6 grid gap-3 rounded-2xl border border-sand bg-cream-2 p-4 sm:grid-cols-[1fr_1fr_auto]"
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink/70">
              รหัสการจอง
            </span>
            <input
              type="text"
              value={bookingCode}
              onChange={(e) => setBookingCode(e.target.value)}
              placeholder="เช่น PN-104218"
              className="w-full rounded-xl border border-sand bg-white px-3.5 py-2.5 font-mono text-sm uppercase text-ink outline-none focus:border-ink"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink/70">
              เลขบัตรประชาชน / หนังสือเดินทาง
            </span>
            <input
              type="text"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder="เลข 13 หลัก หรือเลขหนังสือเดินทาง"
              className="w-full rounded-xl border border-sand bg-white px-3.5 py-2.5 font-mono text-sm text-ink outline-none focus:border-ink"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-cream transition hover:bg-ink-2 disabled:opacity-50 sm:w-auto whitespace-nowrap"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              ค้นหานัดหมาย
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div
          role="alert"
          className="no-print mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="no-print mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {booking ? (
        <div className="grid items-start gap-8 lg:grid-cols-[410px_1fr]">
          <div className="flex flex-col items-center lg:items-start">
            <ETicketCard booking={booking} />
          </div>

          <div className="no-print space-y-6">
            {/* Now Serving status for this channel */}
            <div className="rounded-2xl border border-sand bg-cream-2 p-5">
              <p className="text-xs font-medium text-ink/60">
                สถานะคิวหน้าเคาน์เตอร์ ({formatThaiDate(booking.date)})
              </p>
              <div className="mt-2 flex items-baseline justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {CHANNELS[booking.channel]?.label ?? ''}
                    {nowServing
                      ? ` · ช่องบริการ ${nowServing.counter}`
                      : ` (ช่องบริการ 1–${CHANNELS[booking.channel]?.counters.length ?? 3})`}
                  </p>
                  <p className="mt-0.5 text-xs text-ink/65">
                    {nowServing
                      ? `กำลังให้บริการ: ${nowServing.serviceTitle}`
                      : 'ยังไม่มีการเรียกคิวในวันนัดหมายนี้'}
                  </p>
                </div>
                <span className="font-mono text-2xl font-bold tabular-nums text-ink">
                  {nowServing ? formatQueueNoDisplay(nowServing.queueNo) : '—'}
                </span>
              </div>
            </div>

            {/* Self-service Actions */}
            <div className="rounded-2xl border border-sand bg-white/75 p-5">
              <h2 className="text-base font-semibold text-ink">
                จัดการนัดหมาย
              </h2>
              <p className="mt-1 text-xs text-ink/60">
                สามารถพิมพ์บัตรคิว เลื่อนนัดหมาย หรือยกเลิกคิวได้หากยังอยู่ในสถานะรอรับบริการ
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 rounded-xl border border-sand bg-cream-2 px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-white whitespace-nowrap"
                >
                  <Printer className="h-4 w-4" />
                  พิมพ์บัตรคิว
                </button>

                {booking.status === 'waiting' && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setMode(mode === 'reschedule' ? 'view' : 'reschedule')
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-ink-2 whitespace-nowrap"
                    >
                      <CalendarClock className="h-4 w-4" />
                      {mode === 'reschedule'
                        ? 'ปิดการเลื่อนนัด'
                        : 'เลื่อนนัดหมาย'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setCancelOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 whitespace-nowrap"
                    >
                      <XCircle className="h-4 w-4" />
                      ยกเลิกคิว
                    </button>
                  </>
                )}
              </div>

              {mode === 'reschedule' && booking.status === 'waiting' && (
                <div className="mt-6 border-t border-sand pt-6">
                  <h3 className="mb-4 text-sm font-semibold text-ink">
                    เลือกวันและรอบเวลาใหม่
                  </h3>
                  <DateSlotPicker
                    serviceId={booking.serviceId}
                    date={newDate}
                    slotId={newSlotId}
                    onDate={setNewDate}
                    onSlot={setNewSlotId}
                  />
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setMode('view')}
                      className="rounded-xl px-4 py-2 text-sm font-medium text-ink/70 hover:bg-sand/50"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      disabled={
                        mutating ||
                        !newDate ||
                        !newSlotId ||
                        (newDate === booking.date && newSlotId === booking.slotId)
                      }
                      onClick={handleReschedule}
                      className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-2 text-sm font-semibold text-cream transition hover:bg-ink-2 disabled:opacity-40 whitespace-nowrap"
                    >
                      {mutating && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      ยืนยันเลื่อนนัด
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        !loading && (
          <div className="rounded-2xl border border-dashed border-sand bg-cream-2/70 px-6 py-12 text-center">
            <p className="text-sm font-medium text-ink/75">
              กรอกรหัสการจองและเลขบัตรด้านบนเพื่อแสดงบัตรคิวอิเล็กทรอนิกส์ของคุณ
            </p>
          </div>
        )
      )}

      <ConfirmDialog
        open={cancelOpen}
        title="ยืนยันการยกเลิกคิวนี้?"
        description="เมื่อยกเลิกแล้ว หมายเลขคิวและรอบเวลานี้จะถูกปล่อยคืนให้ผู้รับบริการท่านอื่น และไม่สามารถกู้คืนได้"
        confirmLabel="ยืนยันยกเลิกคิว"
        cancelLabel="เก็บคิวไว้"
        danger
        loading={mutating}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  );
}

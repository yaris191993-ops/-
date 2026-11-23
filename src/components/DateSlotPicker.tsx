import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, RefreshCw } from 'lucide-react';
import {
  type SlotAvailability,
  subscribeSlotsForDate,
} from '../lib/queueService';
import {
  ServiceId,
  formatThaiDate,
  formatThaiDayMonth,
  formatThaiMonthYear,
  getBangkokDateString,
  getBookableWorkdays,
  getMonthHolidays,
  getPublicHolidayName,
  isWeekendDate,
  parseDateUTC,
} from '../shared/bookingConfig';

export type { SlotAvailability };

interface DateSlotPickerProps {
  serviceId: ServiceId;
  date: string;
  slotId: string;
  onDate: (d: string) => void;
  onSlot: (s: string) => void;
}

const WEEKDAY_HEADERS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

function monthOffsetFrom(baseYear: number, baseMonth0: number, delta: number) {
  const dt = new Date(Date.UTC(baseYear, baseMonth0 + delta, 1));
  return { year: dt.getUTCFullYear(), month0: dt.getUTCMonth() };
}

export function DateSlotPicker({
  serviceId,
  date,
  slotId,
  onDate,
  onSlot,
}: DateSlotPickerProps) {
  const todayBangkok = useMemo(() => getBangkokDateString(), []);
  const bookableSet = useMemo(
    () => new Set(getBookableWorkdays(todayBangkok)),
    [todayBangkok],
  );
  const firstBookable = useMemo(
    () => getBookableWorkdays(todayBangkok)[0] ?? '',
    [todayBangkok],
  );

  const todayDateObj = useMemo(() => parseDateUTC(todayBangkok), [todayBangkok]);
  const minYear = todayDateObj.getUTCFullYear();
  const minMonth0 = todayDateObj.getUTCMonth();

  const [viewYear, setViewYear] = useState<number>(() => {
    const ref = date ? parseDateUTC(date) : todayDateObj;
    return ref.getUTCFullYear();
  });
  const [viewMonth0, setViewMonth0] = useState<number>(() => {
    const ref = date ? parseDateUTC(date) : todayDateObj;
    return ref.getUTCMonth();
  });

  const [slots, setSlots] = useState<SlotAvailability[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if ((!date || !bookableSet.has(date)) && firstBookable) {
      onDate(firstBookable);
      const dt = parseDateUTC(firstBookable);
      setViewYear(dt.getUTCFullYear());
      setViewMonth0(dt.getUTCMonth());
    }
  }, [date, bookableSet, firstBookable, onDate]);

  useEffect(() => {
    if (!serviceId || !date || !bookableSet.has(date)) return;
    setLoading(true);
    setError('');

    const unsubscribe = subscribeSlotsForDate(
      serviceId,
      date,
      (nextSlots) => {
        setSlots(nextSlots);
        setLoading(false);
        if (slotId && !nextSlots.some((s) => s.id === slotId && s.available)) {
          onSlot('');
        }
      },
      (err) => {
        setLoading(false);
        setError(
          err instanceof Error ? err.message : 'ไม่สามารถโหลดรอบเวลาได้',
        );
      },
    );

    return () => {
      unsubscribe();
    };
  }, [serviceId, date, bookableSet, reloadTick]);

  const monthDiffFromToday =
    (viewYear - minYear) * 12 + (viewMonth0 - minMonth0);
  const canGoPrev = monthDiffFromToday > 0;
  const canGoNext = monthDiffFromToday < 12;

  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(Date.UTC(viewYear, viewMonth0, 1));
    const leadingBlanks = firstDayOfMonth.getUTCDay(); // 0=Sun..6=Sat
    const daysInMonth = new Date(
      Date.UTC(viewYear, viewMonth0 + 1, 0),
    ).getUTCDate();

    const cells: Array<{
      dateStr: string;
      dayNum: number;
      holidayName: string | null;
      isWeekend: boolean;
      isToday: boolean;
      isBookable: boolean;
    } | null> = [];

    for (let i = 0; i < leadingBlanks; i++) {
      cells.push(null);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const holidayName = getPublicHolidayName(dateStr);
      const isWeekend = isWeekendDate(dateStr);
      const isToday = dateStr === todayBangkok;
      const isBookable = bookableSet.has(dateStr);

      cells.push({
        dateStr,
        dayNum: d,
        holidayName,
        isWeekend,
        isToday,
        isBookable,
      });
    }

    return cells;
  }, [viewYear, viewMonth0, todayBangkok, bookableSet]);

  const monthHolidays = useMemo(
    () => getMonthHolidays(viewYear, viewMonth0),
    [viewYear, viewMonth0],
  );

  const stepMonth = (delta: number) => {
    const next = monthOffsetFrom(viewYear, viewMonth0, delta);
    setViewYear(next.year);
    setViewMonth0(next.month0);
  };

  return (
    <div className="space-y-6">
      {/* Monthly Calendar Picker */}
      <div>
        <p className="mb-2.5 text-sm font-semibold text-ink">
          วันที่ต้องการเข้ารับบริการ <span className="text-red-600">*</span>
        </p>

        <div className="rounded-2xl border border-sand bg-white/85 p-5 shadow-xs">
          {/* Month Header */}
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              disabled={!canGoPrev}
              onClick={() => stepMonth(-1)}
              aria-label="เดือนก่อนหน้า"
              className="grid h-10 w-10 place-items-center rounded-xl border border-sand/90 bg-white text-ink/70 transition hover:bg-cream-2 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <h3 className="text-base font-bold text-ink">
              {formatThaiMonthYear(viewYear, viewMonth0)}
            </h3>

            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => stepMonth(1)}
              aria-label="เดือนถัดไป"
              className="grid h-10 w-10 place-items-center rounded-xl border border-sand/90 bg-white text-ink/70 transition hover:bg-cream-2 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="mt-5 grid grid-cols-7 text-center text-xs font-medium text-ink/55">
            {WEEKDAY_HEADERS.map((w) => (
              <div key={w} className="py-2">
                {w}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="mt-1 grid grid-cols-7 gap-y-1.5 text-center">
            {calendarCells.map((cell, idx) => {
              if (!cell) {
                return <div key={`blank-${idx}`} className="h-10" />;
              }

              const selected = cell.dateStr === date;
              const isHoliday = Boolean(cell.holidayName);

              let cellClasses = '';
              if (isHoliday) {
                cellClasses =
                  'bg-rose-100/85 text-rose-700 font-semibold cursor-not-allowed';
              } else if (selected) {
                cellClasses =
                  'bg-ink text-cream font-bold shadow-sm cursor-pointer';
              } else if (cell.isBookable) {
                cellClasses =
                  'text-ink font-medium hover:bg-sand/45 cursor-pointer';
              } else {
                cellClasses = 'text-ink/25 cursor-not-allowed';
              }

              const todayRing =
                cell.isToday && !selected
                  ? 'ring-1 ring-moss/70'
                  : '';

              return (
                <div key={cell.dateStr} className="flex justify-center">
                  <button
                    type="button"
                    disabled={!cell.isBookable}
                    onClick={() => {
                      onDate(cell.dateStr);
                      onSlot('');
                    }}
                    title={
                      cell.holidayName
                        ? cell.holidayName
                        : cell.isWeekend
                          ? 'วันหยุดสุดสัปดาห์'
                          : formatThaiDate(cell.dateStr)
                    }
                    aria-label={
                      cell.holidayName
                        ? `${formatThaiDate(cell.dateStr)} (${cell.holidayName})`
                        : formatThaiDate(cell.dateStr)
                    }
                    className={`grid h-10 w-10 place-items-center rounded-xl font-mono text-sm tabular-nums transition ${cellClasses} ${todayRing}`}
                  >
                    {cell.dayNum}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Holiday Legend & Policy Note */}
          <div className="mt-5 space-y-1 border-t border-sand/70 pt-3.5 text-xs">
            {monthHolidays.map((h) => (
              <p key={h.date} className="text-rose-600">
                {formatThaiDayMonth(h.date)} {h.name}
              </p>
            ))}
            <p className="text-ink/55">
              วันเสาร์-อาทิตย์และวันหยุดราชการไม่เปิดให้จอง
            </p>
          </div>
        </div>
      </div>

      {/* Time slot selector */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Clock className="h-4 w-4 text-ink-2" aria-hidden="true" />
            <span>
              เลือกรอบเวลา{' '}
              {date && (
                <span className="font-normal text-ink/70">
                  ({formatThaiDate(date)})
                </span>
              )}
            </span>
          </div>
          <span className="text-xs text-ink/60">พักเที่ยง 11:30–13:00 น.</span>
        </div>

        {error ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setReloadTick((n) => n + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              ลองใหม่
            </button>
          </div>
        ) : loading || !slots ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-[74px] animate-pulse rounded-xl border border-sand/60 bg-white/50"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {slots.map((slot) => {
              const selected = slot.id === slotId;
              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => onSlot(slot.id)}
                  className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left transition ${
                    !slot.available
                      ? 'cursor-not-allowed border-sand/60 bg-sand/25 text-ink/40'
                      : selected
                        ? 'border-ink bg-ink text-cream shadow-sm'
                        : 'border-sand bg-white/70 text-ink hover:border-ink/40 hover:bg-white'
                  }`}
                >
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {slot.start} – {slot.end} น.
                  </span>
                  <span
                    className={`mt-1 text-xs tabular-nums ${
                      !slot.available
                        ? 'text-ink/45'
                        : selected
                          ? 'text-cream/80'
                          : 'text-moss font-medium'
                    }`}
                  >
                    {slot.isPast
                      ? 'ปิดรับจอง'
                      : slot.remaining <= 0
                        ? 'รอบเวลาเต็ม'
                        : `ว่าง ${slot.remaining} คิว`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

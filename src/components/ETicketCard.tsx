import {
  BookingRecord,
  CHANNELS,
  OFFICE_INFO,
  STATUS_LABELS,
  formatQueueNoDisplay,
  formatSlotTime,
  formatThaiDate,
  getServiceById,
} from '../shared/bookingConfig';
import { ServiceIcon } from './ServiceIcon';

export function ETicketCard({ booking }: { booking: BookingRecord }) {
  const service = getServiceById(booking.serviceId);

  return (
    <div className="print-area w-full max-w-[410px] overflow-hidden rounded-3xl bg-white shadow-xl shadow-ink/15 ring-1 ring-sand">
      {/* Top dark forest ink ticket header */}
      <div className="relative overflow-hidden bg-ink px-6 pb-6 pt-5 text-cream">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium tracking-wider text-cream/65">
              E-TICKET · บัตรคิวอิเล็กทรอนิกส์
            </p>
            <p className="mt-1 text-sm font-semibold text-cream">
              {OFFICE_INFO.name}
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-cream px-2.5 py-1 text-[11px] font-semibold text-ink whitespace-nowrap">
            {STATUS_LABELS[booking.status] ?? booking.status}
          </span>
        </div>

        <p className="mt-5 text-xs text-cream/65">หมายเลขคิว</p>
        <p className="relative z-10 mt-1 font-mono text-[52px] font-bold leading-none tracking-wide tabular-nums text-cream">
          {formatQueueNoDisplay(booking.queueNo)}
        </p>

        {/* Wave motif */}
        <svg
          className="absolute bottom-0 right-0 h-24 w-56 text-moss"
          viewBox="0 0 220 90"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M0 90 L0 70 C 20 66 28 40 46 44 C 62 48 64 70 82 62 C 100 54 104 18 124 22 C 144 26 140 58 160 52 C 176 47 182 30 198 34 C 210 37 214 50 220 52 L220 90 Z"
          />
        </svg>

        <span className="absolute bottom-5 right-6 z-10 grid h-11 w-11 place-items-center rounded-xl bg-white/15 backdrop-blur-sm">
          <ServiceIcon
            serviceId={booking.serviceId}
            className="h-5 w-5 text-cream"
          />
        </span>
      </div>

      {/* Perforated divider */}
      <div className="relative flex items-center justify-between px-4">
        <span className="-ml-6 h-5 w-5 rounded-full bg-cream ring-1 ring-inset ring-sand/80" />
        <div className="mx-2 flex-1 border-b border-dashed border-sand" />
        <span className="-mr-6 h-5 w-5 rounded-full bg-cream ring-1 ring-inset ring-sand/80" />
      </div>

      {/* Ticket body */}
      <div className="space-y-4 px-6 pb-6 pt-4 text-ink">
        <div>
          <p className="text-[11px] text-ink/55">บริการ</p>
          <p className="mt-0.5 font-semibold leading-snug">
            {booking.serviceTitle}
          </p>
          <p className="mt-0.5 text-sm text-ink/70">
            {CHANNELS[booking.channel]?.label ?? ''}
            {booking.status === 'called' || booking.status === 'done'
              ? ` · ช่องบริการ ${booking.counter}`
              : ` · ช่องบริการ 1–${CHANNELS[booking.channel]?.counters.length ?? 3}`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] text-ink/55">วันนัดหมาย</p>
            <p className="mt-0.5 text-sm font-medium leading-snug">
              {formatThaiDate(booking.date)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-ink/55">รอบเวลา</p>
            <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
              {formatSlotTime(booking.slotId)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-ink/55">ชื่อผู้จอง</p>
            <p className="mt-0.5 text-sm font-medium">{booking.fullName}</p>
          </div>
          <div>
            <p className="text-[11px] text-ink/55">รหัสการจอง</p>
            <p className="mt-0.5 font-mono text-sm font-bold tracking-wide tabular-nums text-ink-2">
              {booking.bookingCode}
            </p>
          </div>
        </div>

        <div className="border-t border-sand/80 pt-3.5 text-xs leading-relaxed text-ink/70 space-y-1.5">
          <p>• กรุณามาถึงก่อนเวลา 15 นาที และแสดงบัตรคิวนี้ที่จุดคัดกรอง</p>
          {service && (
            <p>• เอกสารที่ต้องเตรียม: {service.documents.join(', ')}</p>
          )}
          <p>• สอบถามเพิ่มเติม โทร {OFFICE_INFO.ticketPhone}</p>
        </div>
      </div>
    </div>
  );
}

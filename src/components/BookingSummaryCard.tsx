import { FileText } from 'lucide-react';
import {
  CHANNELS,
  ServiceId,
  formatSlotTime,
  formatThaiDate,
  getServiceById,
} from '../shared/bookingConfig';
import { ServiceIcon } from './ServiceIcon';

export function BookingSummaryCard({
  serviceId,
  date,
  slotId,
}: {
  serviceId: ServiceId | null;
  date: string | null;
  slotId: string | null;
}) {
  const service = serviceId ? getServiceById(serviceId) : null;
  const channel = service ? CHANNELS[service.channel] : null;

  return (
    <aside className="rounded-2xl border border-sand bg-cream-2 p-5">
      <p className="text-xs font-semibold tracking-wide text-ink/55">
        สรุปรายการจองคิว
      </p>

      {!service ? (
        <div className="mt-4 rounded-xl border border-dashed border-sand px-4 py-6 text-center text-sm text-ink/55">
          เลือกประเภทบริการทางซ้ายเพื่อดูช่องบริการ วันเวลา และเอกสารที่ต้องเตรียม
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-cream">
              <ServiceIcon serviceId={service.id} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold leading-snug text-ink">
                {service.title}
              </p>
              <p className="mt-1 text-xs text-ink/60">
                {channel?.label} · หมวดคิว {service.prefix} ·{' '}
                {service.durationHint}
              </p>
            </div>
          </div>

          <div className="border-t border-sand/80 pt-3.5 space-y-2.5 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-ink/55">วันนัดหมาย</span>
              <span className="text-right font-medium text-ink">
                {date ? formatThaiDate(date) : 'ยังไม่เลือก'}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-ink/55">รอบเวลา</span>
              <span className="font-mono font-semibold tabular-nums text-ink">
                {slotId ? formatSlotTime(slotId) : 'ยังไม่เลือก'}
              </span>
            </div>
          </div>

          <div className="border-t border-sand/80 pt-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink/75">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              <span>เอกสารที่ต้องนำมาในวันนัด</span>
            </div>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-ink/75">
              {service.documents.map((doc) => (
                <li key={doc} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-moss" />
                  <span>{doc}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </aside>
  );
}

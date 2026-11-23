import { FormEvent, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Loader2,
  Printer,
  RotateCcw,
} from 'lucide-react';
import { BookingSummaryCard } from '../components/BookingSummaryCard';
import { DateSlotPicker } from '../components/DateSlotPicker';
import { ETicketCard } from '../components/ETicketCard';
import { ServiceIcon } from '../components/ServiceIcon';
import { createOnlineBooking } from '../lib/queueService';
import {
  BookingRecord,
  CHANNELS,
  OFFICE_INFO,
  SERVICES,
  ServiceId,
  getBookableWorkdays,
  getServiceById,
  isValidIdForService,
  isValidThaiPhone,
  normalizeIdNumber,
} from '../shared/bookingConfig';

const STEPS = [
  { num: 1, label: 'เลือกบริการ' },
  { num: 2, label: 'วันและเวลา' },
  { num: 3, label: 'ข้อมูลผู้จอง' },
  { num: 4, label: 'รับบัตรคิว' },
];

const INPUT_CLASS =
  'w-full rounded-xl border border-sand bg-white/85 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-ink focus:bg-white focus:ring-2 focus:ring-ink/10';

export function BookingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [serviceId, setServiceId] = useState<ServiceId | null>(null);
  const [date, setDate] = useState<string>(() => getBookableWorkdays()[0] ?? '');
  const [slotId, setSlotId] = useState<string>('');
  const [form, setForm] = useState({
    fullName: '',
    idNumber: '',
    phone: '',
    note: '',
  });
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdBooking, setCreatedBooking] = useState<BookingRecord | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const selectedService = serviceId ? getServiceById(serviceId) : null;
  const isForeign = serviceId === 'foreign';

  const handleSelectService = (id: ServiceId) => {
    const prevService = serviceId ? getServiceById(serviceId) : null;
    const nextService = getServiceById(id);
    if (prevService && nextService && prevService.channel !== nextService.channel) {
      setSlotId('');
    }
    setServiceId(id);
    setError('');
    setStep(2);
  };

  const handleDateChange = useCallback((d: string) => {
    setDate(d);
  }, []);

  const handleSlotChange = useCallback((s: string) => {
    setSlotId(s);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!serviceId || !date || !slotId) {
      setError('กรุณาเลือกบริการ วัน และรอบเวลาให้ครบถ้วน');
      return;
    }

    const trimmedName = form.fullName.trim();
    if (trimmedName.length < 2) {
      setError('กรุณากรอกชื่อ-นามสกุล');
      return;
    }

    const cleanId = normalizeIdNumber(form.idNumber);
    if (!isValidIdForService(cleanId, serviceId)) {
      setError(
        isForeign
          ? 'กรุณากรอกเลขบัตรประชาชน 13 หลัก หรือเลขหนังสือเดินทางให้ถูกต้อง'
          : 'เลขบัตรประจำตัวประชาชนไม่ถูกต้อง',
      );
      return;
    }

    if (!isValidThaiPhone(form.phone)) {
      setError('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง');
      return;
    }

    if (!consent) {
      setError('กรุณายืนยันความถูกต้องของข้อมูล');
      return;
    }

    setSubmitting(true);
    try {
      const booking = await createOnlineBooking({
        serviceId,
        date,
        slotId,
        fullName: trimmedName,
        idNumber: cleanId,
        phone: form.phone,
        note: form.note,
        consent,
      });
      setCreatedBooking(booking);
      setStep(4);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setServiceId(null);
    setSlotId('');
    setForm({ fullName: '', idNumber: '', phone: '', note: '' });
    setConsent(false);
    setError('');
    setCreatedBooking(null);
    setCopied(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Page Intro */}
      <div className="no-print mb-8 border-b border-sand/80 pb-6">
        <p className="text-xs font-medium text-ink-2">
          {OFFICE_INFO.department} · {OFFICE_INFO.hours}
        </p>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <h1
            className="text-2xl font-bold tracking-tight text-ink sm:text-3xl"
            style={{ textWrap: 'balance' }}
          >
            จองคิวรับบริการออนไลน์
          </h1>
          <p className="text-xs text-ink/65">
            ฝ่ายส่งเสริม (3 ช่องบริการ): บริการทั่วไป (A, B, D, E) · ฝ่ายต่างด้าว (5 ช่องบริการ): งานคนต่างด้าว (C)
          </p>
        </div>

        {/* 4-Step Progress Bar */}
        <ol className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STEPS.map((item) => {
            const active = step === item.num;
            const completed = step > item.num;
            const canJump =
              step !== 4 &&
              ((item.num === 1) ||
                (item.num === 2 && Boolean(serviceId)) ||
                (item.num === 3 && Boolean(serviceId && date && slotId)));

            return (
              <li key={item.num}>
                <button
                  type="button"
                  disabled={!canJump}
                  onClick={() => canJump && setStep(item.num as 1 | 2 | 3)}
                  className={`flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-xs transition ${
                    active
                      ? 'border-ink bg-ink text-cream font-semibold'
                      : completed
                        ? 'border-moss/35 bg-cream-2 text-ink font-medium hover:border-ink/40'
                        : 'border-sand/80 bg-white/40 text-ink/50'
                  } ${!canJump && !active ? 'cursor-default' : ''}`}
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-md font-mono text-[11px] font-bold tabular-nums ${
                      active
                        ? 'bg-cream text-ink'
                        : completed
                          ? 'bg-moss text-white'
                          : 'bg-sand/70 text-ink/60'
                    }`}
                  >
                    {completed ? <Check className="h-3 w-3" /> : item.num}
                  </span>
                  <span className="truncate whitespace-nowrap">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Step 4: Digital E-Ticket */}
      {step === 4 && createdBooking ? (
        <div className="flex flex-col items-center py-2">
          <div className="no-print mb-6 text-center">
            <h2 className="text-xl font-bold text-ink">
              จองคิวสำเร็จเรียบร้อยแล้ว
            </h2>
            <p className="mt-1 text-sm text-ink/65">
              กรุณาบันทึกรหัสการจองหรือพิมพ์บัตรคิวเพื่อแสดงต่อเจ้าหน้าที่ในวันนัดหมาย
            </p>
          </div>

          <ETicketCard booking={createdBooking} />

          <div className="no-print mt-6 grid w-full max-w-[410px] grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-cream transition hover:bg-ink-2 whitespace-nowrap"
            >
              <Printer className="h-4 w-4" />
              พิมพ์บัตรคิว
            </button>
            <button
              type="button"
              onClick={() => handleCopyCode(createdBooking.bookingCode)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-sand bg-white/80 px-4 py-3 text-sm font-semibold text-ink transition hover:bg-white whitespace-nowrap"
            >
              {copied ? (
                <Check className="h-4 w-4 text-moss" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? 'คัดลอกแล้ว' : 'คัดลอกรหัส'}
            </button>
          </div>

          <div className="no-print mt-4 flex flex-wrap items-center justify-center gap-4 text-sm">
            <button
              type="button"
              onClick={() =>
                navigate('/check', {
                  state: {
                    bookingCode: createdBooking.bookingCode,
                    idNumber: createdBooking.idNumber,
                    fullName: createdBooking.fullName,
                  },
                })
              }
              className="font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
            >
              ตรวจสอบ / เลื่อนนัดคิวนี้
            </button>
            <span className="text-sand" aria-hidden="true">
              |
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 font-medium text-ink/70 hover:text-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              จองคิวรายการใหม่
            </button>
          </div>
        </div>
      ) : (
        /* Steps 1–3: 2-Column Wizard + Sticky Summary */
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            {step === 1 && (
              <div>
                <h2 className="text-xl font-bold text-ink">
                  เลือกบริการที่ต้องการ
                </h2>
                <p className="mt-1 text-sm text-ink/65">
                  เลือกประเภทบริการเพื่อดูวันและรอบเวลาที่ว่าง
                </p>

                <ul className="mt-5 divide-y divide-sand/80 overflow-hidden rounded-2xl border border-sand bg-white/55">
                  {SERVICES.map((svc) => {
                    const selected = svc.id === serviceId;
                    const channel = CHANNELS[svc.channel];
                    return (
                      <li key={svc.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectService(svc.id)}
                          className={`group flex w-full items-start gap-4 px-5 py-5 text-left transition ${
                            selected ? 'bg-blue-50/75' : 'hover:bg-white'
                          }`}
                        >
                          <span
                            className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl transition ${
                              selected
                                ? 'bg-ink text-cream'
                                : 'bg-sand/65 text-ink/75 group-hover:bg-ink group-hover:text-cream'
                            }`}
                          >
                            <ServiceIcon serviceId={svc.id} className="h-5 w-5" />
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block text-[17px] font-semibold text-ink">
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

                          <ChevronRight className="mt-2.5 h-5 w-5 shrink-0 text-ink/35 transition group-hover:translate-x-0.5 group-hover:text-ink/70" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {step === 2 && serviceId && (
              <div>
                <h2 className="text-xl font-bold text-ink">
                  เลือกวันที่และช่วงเวลา
                </h2>
                <p className="mb-6 mt-1 text-sm text-ink/65">
                  เปิดให้จองล่วงหน้าได้ 30 วัน เฉพาะวันทำการ (ไม่รวมวันเสาร์-อาทิตย์และวันหยุดราชการ)
                </p>

                <DateSlotPicker
                  serviceId={serviceId}
                  date={date}
                  slotId={slotId}
                  onDate={handleDateChange}
                  onSlot={handleSlotChange}
                />

                <div className="mt-8 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-ink/75 transition hover:bg-sand/55 whitespace-nowrap"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    ย้อนกลับ
                  </button>
                  <button
                    type="button"
                    disabled={!date || !slotId}
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-2.5 text-sm font-semibold text-cream transition hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                  >
                    ถัดไป
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 3 && selectedService && (
              <form onSubmit={handleSubmit} noValidate>
                <h2 className="text-xl font-bold text-ink">ข้อมูลผู้จอง</h2>
                <p className="mb-6 mt-1 text-sm text-ink/65">
                  ข้อมูลนี้ใช้สำหรับยืนยันตัวตนเมื่อมารับบริการ
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="sm:col-span-2 block">
                    <span className="mb-1.5 block text-sm font-medium text-ink">
                      ชื่อ-นามสกุล <span className="text-red-600">*</span>
                    </span>
                    <input
                      type="text"
                      className={INPUT_CLASS}
                      value={form.fullName}
                      onChange={(e) =>
                        setForm({ ...form, fullName: e.target.value })
                      }
                      placeholder="เช่น สมชาย ใจดี"
                      autoComplete="name"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-ink">
                      {isForeign
                        ? 'เลขบัตรประชาชน / เลขหนังสือเดินทาง'
                        : 'เลขบัตรประจำตัวประชาชน'}{' '}
                      <span className="text-red-600">*</span>
                    </span>
                    <input
                      type="text"
                      className={`${INPUT_CLASS} font-mono tabular-nums`}
                      value={form.idNumber}
                      onChange={(e) =>
                        setForm({ ...form, idNumber: e.target.value })
                      }
                      inputMode={isForeign ? 'text' : 'numeric'}
                      maxLength={isForeign ? 20 : 17}
                      placeholder={
                        isForeign
                          ? 'เลข 13 หลัก หรือเลขหนังสือเดินทาง'
                          : 'เลข 13 หลัก'
                      }
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-ink">
                      เบอร์โทรศัพท์ <span className="text-red-600">*</span>
                    </span>
                    <input
                      type="tel"
                      className={`${INPUT_CLASS} font-mono tabular-nums`}
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                      inputMode="tel"
                      maxLength={12}
                      placeholder="08x-xxx-xxxx"
                      autoComplete="tel"
                    />
                  </label>

                  <label className="sm:col-span-2 block">
                    <span className="mb-1.5 block text-sm font-medium text-ink">
                      รายละเอียดเพิ่มเติม (ถ้ามี)
                    </span>
                    <textarea
                      className={`${INPUT_CLASS} min-h-24 resize-y`}
                      value={form.note}
                      onChange={(e) =>
                        setForm({ ...form, note: e.target.value })
                      }
                      maxLength={500}
                      placeholder={
                        isForeign
                          ? 'เช่น ชื่อนายจ้าง / ประเภทคำขอ'
                          : 'เรื่องที่ต้องการติดต่อ'
                      }
                    />
                  </label>
                </div>

                <label className="mt-5 flex items-start gap-3 text-sm leading-relaxed text-ink/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded accent-[#132d63]"
                  />
                  <span>
                    ข้าพเจ้ายืนยันว่าข้อมูลข้างต้นถูกต้อง และยินยอมให้
                    {OFFICE_INFO.name}ใช้ข้อมูลนี้เพื่อการให้บริการ
                  </span>
                </label>

                {error && (
                  <p
                    role="alert"
                    className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {error}
                  </p>
                )}

                <div className="mt-8 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-ink/75 transition hover:bg-sand/55 whitespace-nowrap"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    ย้อนกลับ
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-2.5 text-sm font-semibold text-cream transition hover:bg-ink-2 disabled:opacity-50 whitespace-nowrap"
                  >
                    {submitting && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    ยืนยันการจอง
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="lg:sticky lg:top-24">
            <BookingSummaryCard
              serviceId={serviceId}
              date={step >= 2 ? date : null}
              slotId={step >= 2 ? slotId : null}
            />
          </div>
        </div>
      )}
    </div>
  );
}

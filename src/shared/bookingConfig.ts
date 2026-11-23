export type ServiceId =
  | 'domestic'
  | 'unemployment'
  | 'foreign'
  | 'overseas'
  | 'guidance';

export type ChannelId = 'general' | 'foreign';

export type BookingStatus =
  | 'waiting'
  | 'called'
  | 'done'
  | 'no_show'
  | 'cancelled';

export interface ServiceDef {
  id: ServiceId;
  prefix: 'A' | 'B' | 'C' | 'D' | 'E';
  title: string;
  description: string;
  documents: string[];
  channel: ChannelId;
  color: string;
  durationHint: string;
}

export interface ChannelDef {
  id: ChannelId;
  counter: number;
  counters: number[];
  label: string;
  hint: string;
}

export interface TimeSlotDef {
  id: string;
  start: string;
  end: string;
  capacity: number;
}

export interface BookingRecord {
  id: string;
  bookingCode: string;
  queueNo: string;
  serviceId: ServiceId;
  serviceTitle: string;
  channel: ChannelId;
  counter: number;
  date: string; // YYYY-MM-DD
  slotId: string;
  issuedTime?: string; // HH:mm
  source?: 'online' | 'kiosk';
  fullName: string;
  idNumber: string;
  phone: string;
  note: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
}

export const SERVICES: ServiceDef[] = [
  {
    id: 'unemployment',
    prefix: 'B',
    title: 'ขึ้นทะเบียนผู้ประกันตนกรณีว่างงาน',
    description:
      'ขึ้นทะเบียนว่างงาน รายงานตัวตามนัด เพื่อรับเงินทดแทนกรณีว่างงานจากประกันสังคม',
    documents: [
      'บัตรประจำตัวประชาชน',
      'หนังสือรับรองการผ่านงาน (ถ้ามี)',
      'สมุดบัญชีเงินฝากธนาคาร',
    ],
    channel: 'general',
    color: '#8b5cf6',
    durationHint: 'ประมาณ 15 นาที',
  },
  {
    id: 'domestic',
    prefix: 'A',
    title: 'บริการจัดหางานในประเทศ',
    description:
      'ลงทะเบียนผู้หางาน รับคำแนะนำตำแหน่งงานว่าง และส่งตัวไปสมัครงานกับนายจ้างในพื้นที่',
    documents: [
      'บัตรประจำตัวประชาชน',
      'ประวัติย่อ / Resume',
      'สำเนาวุฒิการศึกษา',
    ],
    channel: 'general',
    color: '#3b82f6',
    durationHint: 'ประมาณ 15 นาที',
  },
  {
    id: 'foreign',
    prefix: 'C',
    title: 'งานคนต่างด้าว',
    description:
      'ยื่นคำขออนุญาตทำงาน ต่ออายุ เปลี่ยนนายจ้าง หรือแจ้งเข้า-ออกของคนต่างด้าว',
    documents: [
      'หนังสือเดินทาง / เอกสารประจำตัวคนต่างด้าว',
      'ใบอนุญาตทำงานเดิม (ถ้ามี)',
      'หนังสือแต่งตั้งผู้รับมอบอำนาจ (กรณีนายจ้าง)',
    ],
    channel: 'foreign',
    color: '#ec4899',
    durationHint: 'ประมาณ 25 นาที',
  },
  {
    id: 'overseas',
    prefix: 'D',
    title: 'ส่งเสริมการไปทำงานต่างประเทศ',
    description:
      'แจ้งการเดินทางไปทำงานต่างประเทศ ขอรับใบอนุญาตกลับไปทำงาน (Re-Entry) และตรวจสอบบริษัทจัดหางาน',
    documents: [
      'บัตรประจำตัวประชาชน',
      'หนังสือเดินทาง',
      'สัญญาจ้าง / หนังสือรับรองการจ้าง',
    ],
    channel: 'general',
    color: '#f97316',
    durationHint: 'ประมาณ 20 นาที',
  },
  {
    id: 'guidance',
    prefix: 'E',
    title: 'แนะแนวอาชีพและส่งเสริมการมีงานทำ',
    description:
      'ปรึกษาแนะแนวอาชีพ ทดสอบความถนัด บริการคนพิการ ผู้สูงอายุ และนักเรียนนักศึกษา',
    documents: ['บัตรประจำตัวประชาชน', 'บัตรคนพิการ (ถ้ามี)'],
    channel: 'general',
    color: '#14b8a6',
    durationHint: 'ประมาณ 20 นาที',
  },
];

export const CHANNELS: Record<ChannelId, ChannelDef> = {
  general: {
    id: 'general',
    counter: 1,
    counters: [1, 2, 3],
    label: 'ฝ่ายส่งเสริม',
    hint: 'ทุกประเภทบริการ ยกเว้นงานคนต่างด้าว (3 ช่องบริการ)',
  },
  foreign: {
    id: 'foreign',
    counter: 1,
    counters: [1, 2, 3, 4, 5],
    label: 'ฝ่ายต่างด้าว',
    hint: 'เฉพาะงานคนต่างด้าว (5 ช่องบริการ)',
  },
};

export function isValidCounterForChannel(
  channel: ChannelId,
  counter: number,
): boolean {
  return (
    Number.isInteger(counter) && CHANNELS[channel].counters.includes(counter)
  );
}

export const TIME_SLOTS: TimeSlotDef[] = [
  { id: '0830', start: '08:30', end: '09:30', capacity: 8 },
  { id: '0930', start: '09:30', end: '10:30', capacity: 8 },
  { id: '1030', start: '10:30', end: '11:30', capacity: 8 },
  { id: '1300', start: '13:00', end: '14:00', capacity: 8 },
  { id: '1400', start: '14:00', end: '15:00', capacity: 8 },
  { id: '1500', start: '15:00', end: '16:00', capacity: 8 },
];

export const OFFICE_INFO = {
  name: 'สำนักงานจัดหางานจังหวัดพังงา',
  short: 'สนจ.พังงา',
  department: 'กรมการจัดหางาน · กระทรวงแรงงาน',
  address:
    'สำนักงานจัดหางานจังหวัดพังงา เลขที่ 71 หมู่ที่ 3 ตำบลถ้ำน้ำผุด อำเภอเมืองพังงา จังหวัดพังงา 82000',
  hours: 'เปิดทำการวันจันทร์–ศุกร์ เวลา 08:30–16:30 น.',
  phones:
    'โทรศัพท์: 076-460-674 (ฝ่ายส่งเสริมการมีงานทำ) และ 076-460-671 (ฝ่ายแรงงานต่างด้าว)',
  ticketPhone: '0 7648 1286',
};

export const STATUS_LABELS: Record<BookingStatus, string> = {
  waiting: 'รอรับบริการ',
  called: 'กำลังเรียกคิว',
  done: 'เสร็จสิ้น',
  no_show: 'ไม่มาตามนัด',
  cancelled: 'ยกเลิก',
};

export function getServiceById(id: string): ServiceDef | undefined {
  return SERVICES.find((s) => s.id === id);
}

export function getSlotById(id: string): TimeSlotDef | undefined {
  return TIME_SLOTS.find((s) => s.id === id);
}

export function formatSlotTime(slotId: string): string {
  if (slotId.endsWith('-kiosk') && /^\d{4}-kiosk$/.test(slotId)) {
    return `หน้างาน ${slotId.slice(0, 2)}:${slotId.slice(2, 4)} น.`;
  }
  const slot = getSlotById(slotId);
  return slot ? `${slot.start} – ${slot.end} น.` : '-';
}

export function formatQueueNoDisplay(queueNo: string): string {
  return queueNo.replace('-', '');
}

const THAI_DAYS = [
  'อาทิตย์',
  'จันทร์',
  'อังคาร',
  'พุธ',
  'พฤหัสบดี',
  'ศุกร์',
  'เสาร์',
];

const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

const THAI_SHORT_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

export function parseDateUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function isValidDateStr(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function formatThaiDate(dateStr: string): string {
  if (!isValidDateStr(dateStr)) return dateStr;
  const dt = parseDateUTC(dateStr);
  return `วัน${THAI_DAYS[dt.getUTCDay()]}ที่ ${dt.getUTCDate()} ${THAI_MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear() + 543}`;
}

export function getDateChipParts(dateStr: string) {
  const dt = parseDateUTC(dateStr);
  return {
    dayName: THAI_DAYS[dt.getUTCDay()],
    dayNum: dt.getUTCDate(),
    monthShort: THAI_SHORT_MONTHS[dt.getUTCMonth()],
    yearBE: dt.getUTCFullYear() + 543,
  };
}

export function isWeekendDate(dateStr: string): boolean {
  const day = parseDateUTC(dateStr).getUTCDay();
  return day === 0 || day === 6;
}

export function getBangkokDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
  }).format(now);
}

export function getBangkokTimeString(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

export function getBangkokNowMinutes(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function addDaysDateStr(dateStr: string, offset: number): string {
  const dt = parseDateUTC(dateStr);
  dt.setUTCDate(dt.getUTCDate() + offset);
  return dt.toISOString().slice(0, 10);
}

export interface PublicHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

export const THAI_PUBLIC_HOLIDAYS: Record<string, string> = {
  // 2569 (2026)
  '2026-01-01': 'วันขึ้นปีใหม่',
  '2026-03-03': 'วันมาฆบูชา',
  '2026-04-06': 'วันจักรี',
  '2026-04-13': 'วันสงกรานต์',
  '2026-04-14': 'วันสงกรานต์',
  '2026-04-15': 'วันสงกรานต์',
  '2026-05-04': 'วันฉัตรมงคล',
  '2026-05-31': 'วันวิสาขบูชา',
  '2026-06-01': 'ชดเชยวันวิสาขบูชา',
  '2026-06-03': 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี',
  '2026-07-28': 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว',
  '2026-07-29': 'วันอาสาฬหบูชา',
  '2026-07-30': 'วันเข้าพรรษา',
  '2026-08-12': 'วันเฉลิมพระชนมพรรษาสมเด็จพระบรมราชชนนีพันปีหลวง / วันแม่แห่งชาติ',
  '2026-10-13': 'วันนวมินทรมหาราช',
  '2026-10-23': 'วันปิยมหาราช',
  '2026-12-05': 'วันคล้ายวันพระบรมราชสมภพ ร.9 / วันชาติ / วันพ่อแห่งชาติ',
  '2026-12-07': 'ชดเชยวันคล้ายวันพระบรมราชสมภพ ร.9 / วันชาติ / วันพ่อแห่งชาติ',
  '2026-12-10': 'วันรัฐธรรมนูญ',
  '2026-12-31': 'วันสิ้นปี',

  // 2570 (2027)
  '2027-01-01': 'วันขึ้นปีใหม่',
  '2027-02-21': 'วันมาฆบูชา',
  '2027-02-22': 'ชดเชยวันมาฆบูชา',
  '2027-04-06': 'วันจักรี',
  '2027-04-13': 'วันสงกรานต์',
  '2027-04-14': 'วันสงกรานต์',
  '2027-04-15': 'วันสงกรานต์',
  '2027-05-04': 'วันฉัตรมงคล',
  '2027-05-20': 'วันวิสาขบูชา',
  '2027-06-03': 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี',
  '2027-07-19': 'วันอาสาฬหบูชา',
  '2027-07-20': 'วันเข้าพรรษา',
  '2027-07-28': 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว',
  '2027-08-12': 'วันเฉลิมพระชนมพรรษาสมเด็จพระบรมราชชนนีพันปีหลวง / วันแม่แห่งชาติ',
  '2027-10-13': 'วันนวมินทรมหาราช',
  '2027-10-23': 'วันปิยมหาราช',
  '2027-10-25': 'ชดเชยวันปิยมหาราช',
  '2027-12-05': 'วันคล้ายวันพระบรมราชสมภพ ร.9 / วันชาติ / วันพ่อแห่งชาติ',
  '2027-12-06': 'ชดเชยวันคล้ายวันพระบรมราชสมภพ ร.9 / วันชาติ / วันพ่อแห่งชาติ',
  '2027-12-10': 'วันรัฐธรรมนูญ',
  '2027-12-31': 'วันสิ้นปี',
};

export function getPublicHolidayName(dateStr: string): string | null {
  return THAI_PUBLIC_HOLIDAYS[dateStr] ?? null;
}

export function getMonthHolidays(year: number, monthIndex0: number): PublicHoliday[] {
  const prefix = `${year}-${String(monthIndex0 + 1).padStart(2, '0')}-`;
  return Object.entries(THAI_PUBLIC_HOLIDAYS)
    .filter(([date]) => date.startsWith(prefix))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, name]) => ({ date, name }));
}

export function formatThaiMonthYear(year: number, monthIndex0: number): string {
  return `${THAI_MONTHS[monthIndex0]} ${year + 543}`;
}

export function formatThaiDayMonth(dateStr: string): string {
  const dt = parseDateUTC(dateStr);
  return `${dt.getUTCDate()} ${THAI_MONTHS[dt.getUTCMonth()]}`;
}

export function getBookableWorkdays(
  startDateStr: string = getBangkokDateString(),
): string[] {
  const list: string[] = [];
  for (let i = 0; i <= 30; i++) {
    const d = addDaysDateStr(startDateStr, i);
    if (!isWeekendDate(d) && !getPublicHolidayName(d)) {
      list.push(d);
    }
  }
  return list;
}

export function normalizeIdNumber(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase().trim();
}

export function normalizePhone(raw: string): string {
  return raw.replace(/[\s-]/g, '').trim();
}

export function isValidThaiId(id: string): boolean {
  const clean = normalizeIdNumber(id);
  if (!/^\d{13}$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(clean[i]) * (13 - i);
  }
  return (11 - (sum % 11)) % 10 === Number(clean[12]);
}

export function isValidIdForService(
  id: string,
  serviceId: ServiceId,
): boolean {
  const clean = normalizeIdNumber(id);
  if (serviceId === 'foreign') {
    return isValidThaiId(clean) || /^[A-Z0-9]{6,20}$/.test(clean);
  }
  return isValidThaiId(clean);
}

export function isValidThaiPhone(phone: string): boolean {
  const clean = normalizePhone(phone);
  return /^0\d{8,9}$/.test(clean);
}

export function slotEndMinutes(slot: TimeSlotDef): number {
  const [h, m] = slot.end.split(':').map(Number);
  return h * 60 + m;
}

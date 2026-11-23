import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  type BookingRecord,
  type BookingStatus,
  CHANNELS,
  type ChannelId,
  type ServiceId,
  TIME_SLOTS,
  getBangkokDateString,
  getBangkokNowMinutes,
  getBangkokTimeString,
  getBookableWorkdays,
  getPublicHolidayName,
  getServiceById,
  getSlotById,
  isValidCounterForChannel,
  isValidDateStr,
  isValidIdForService,
  isValidThaiPhone,
  isWeekendDate,
  normalizeIdNumber,
  normalizePhone,
  slotEndMinutes,
} from '../shared/bookingConfig';
import {
  OperationType,
  PRIMARY_ADMIN_EMAIL,
  db,
  handleFirestoreError,
} from './firebase';

export interface SlotAvailability {
  id: string;
  start: string;
  end: string;
  capacity: number;
  booked: number;
  remaining: number;
  isPast: boolean;
  available: boolean;
}

export interface ChannelSummaryData {
  called: BookingRecord | null;
  calledByCounter: Record<string, BookingRecord | null>;
  waitingCount: number;
  nextWaiting: BookingRecord | null;
  waitingQueue: BookingRecord[];
}

export interface BoardSnapshot {
  date: string;
  channels: {
    general: ChannelSummaryData;
    foreign: ChannelSummaryData;
  };
  stats: {
    total: number;
    waiting: number;
    called: number;
    done: number;
  };
}

export interface AdminDaySnapshot {
  date: string;
  bookings: BookingRecord[];
  channels: {
    general: ChannelSummaryData;
    foreign: ChannelSummaryData;
  };
}

export interface StaffAdminRecord {
  email: string;
  displayName: string;
  addedBy: string;
  createdAt: string;
}

interface FirestoreQueueDoc {
  bookingCode: string;
  queueNo: string;
  serviceId: ServiceId;
  serviceTitle: string;
  channel: ChannelId;
  counter: number;
  date: string;
  slotId: string;
  issuedTime: string;
  source: 'online' | 'kiosk';
  status: BookingStatus;
  lookupHash: string;
  identityHash: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

interface FirestoreQueueDetailDoc {
  queueId: string;
  date: string;
  bookingCode: string;
  fullName: string;
  idNumber: string;
  phone: string;
  note: string;
  lookupHash: string;
  createdAt?: Timestamp | null;
}

export class QueueBusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueueBusinessError';
  }
}

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (
    typeof val === 'object' &&
    val !== null &&
    'toDate' in val &&
    typeof (val as { toDate: () => Date }).toDate === 'function'
  ) {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return '';
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function computeLookupHash(
  bookingCode: string,
  idNumber: string,
): Promise<string> {
  return sha256Hex(
    `${bookingCode.trim().toUpperCase()}:${normalizeIdNumber(idNumber)}`,
  );
}

async function computeIdentityHash(
  date: string,
  channel: ChannelId,
  idNumber: string,
): Promise<string> {
  return sha256Hex(`${date}:${channel}:${normalizeIdNumber(idNumber)}`);
}

function mapQueueDocToPublicBooking(
  id: string,
  q: FirestoreQueueDoc,
  detail?: FirestoreQueueDetailDoc | null,
): BookingRecord {
  return {
    id,
    bookingCode: q.bookingCode,
    queueNo: q.queueNo,
    serviceId: q.serviceId,
    serviceTitle: q.serviceTitle,
    channel: q.channel,
    counter: q.counter,
    date: q.date,
    slotId: q.slotId,
    issuedTime: q.issuedTime || undefined,
    source: q.source,
    fullName:
      detail?.fullName ??
      (q.source === 'kiosk'
        ? 'ผู้รับบริการหน้าเคาน์เตอร์ (เครื่องกดบัตรคิว)'
        : 'ผู้ลงทะเบียนนัดหมาย (ยืนยันตัวตนแล้ว)'),
    idNumber: detail?.idNumber ?? '-',
    phone: detail?.phone ?? '-',
    note: detail?.note ?? '',
    status: q.status,
    createdAt: timestampToIso(q.createdAt),
    updatedAt: timestampToIso(q.updatedAt),
  };
}

function computeSlotsFromDocs(
  channel: ChannelId,
  dateStr: string,
  dayDocs: Array<{ id: string; data: FirestoreQueueDoc }>,
): SlotAvailability[] {
  const todayBangkok = getBangkokDateString();
  const nowMinutes = getBangkokNowMinutes();
  const isToday = dateStr === todayBangkok;

  return TIME_SLOTS.map((slot) => {
    const booked = dayDocs.filter(
      ({ data: b }) =>
        b.date === dateStr &&
        b.slotId === slot.id &&
        b.channel === channel &&
        b.status !== 'cancelled',
    ).length;
    const remaining = Math.max(0, slot.capacity - booked);
    const isPast = isToday && nowMinutes >= slotEndMinutes(slot) - 15;
    return {
      id: slot.id,
      start: slot.start,
      end: slot.end,
      capacity: slot.capacity,
      booked,
      remaining,
      isPast,
      available: !isPast && remaining > 0,
    };
  });
}

function nextQueueNoForPrefix(
  prefix: string,
  dayDocs: Array<{ data: FirestoreQueueDoc }>,
): string {
  let maxNum = 0;
  for (const { data } of dayDocs) {
    if (data.queueNo.startsWith(`${prefix}-`)) {
      const parsed = Number(data.queueNo.slice(prefix.length + 1));
      if (Number.isFinite(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }
  return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
}

function generateUniqueBookingCode(
  dayDocs: Array<{ data: FirestoreQueueDoc }>,
): string {
  const existing = new Set(dayDocs.map((d) => d.data.bookingCode));
  for (let i = 0; i < 30; i++) {
    const rand = new Uint32Array(1);
    window.crypto.getRandomValues(rand);
    const num = 100000 + (rand[0] % 900000);
    const code = `PN-${num}`;
    if (!existing.has(code)) return code;
  }
  return `PN-${Date.now().toString().slice(-6)}`;
}

function summarizeChannel(
  channel: ChannelId,
  bookings: BookingRecord[],
): ChannelSummaryData {
  const dayChannelBookings = bookings
    .filter((b) => b.channel === channel)
    .sort((a, b) => {
      if (a.slotId !== b.slotId) return a.slotId.localeCompare(b.slotId);
      return a.createdAt.localeCompare(b.createdAt);
    });

  const calledList = dayChannelBookings
    .filter((b) => b.status === 'called')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const called = calledList[0] ?? null;

  const calledByCounter: Record<string, BookingRecord | null> = {};
  for (const c of CHANNELS[channel].counters) {
    calledByCounter[String(c)] =
      calledList.find((b) => (b.counter || 1) === c) ?? null;
  }

  const waiting = dayChannelBookings.filter((b) => b.status === 'waiting');

  return {
    called,
    calledByCounter,
    waitingCount: waiting.length,
    nextWaiting: waiting[0] ?? null,
    waitingQueue: waiting.slice(0, 5),
  };
}

async function fetchQueuesForDate(
  dateStr: string,
): Promise<Array<{ id: string; data: FirestoreQueueDoc }>> {
  const path = `queues`;
  try {
    const q = query(
      collection(db, path),
      where('date', '==', dateStr),
      limit(300),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      data: d.data() as FirestoreQueueDoc,
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeSlotsForDate(
  serviceId: ServiceId,
  dateStr: string,
  onData: (slots: SlotAvailability[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const service = getServiceById(serviceId);
  if (!service) {
    onError(new QueueBusinessError('ประเภทบริการไม่ถูกต้อง'));
    return () => {};
  }
  if (!isValidDateStr(dateStr) || isWeekendDate(dateStr)) {
    onError(new QueueBusinessError('วันที่นัดหมายไม่ถูกต้องหรือไม่ใช่วันทำการ'));
    return () => {};
  }
  const holidayName = getPublicHolidayName(dateStr);
  if (holidayName) {
    onError(
      new QueueBusinessError(
        `วันที่เลือกเป็นวันหยุดราชการ (${holidayName}) ไม่เปิดให้จองคิว`,
      ),
    );
    return () => {};
  }
  const validDates = getBookableWorkdays();
  if (!validDates.includes(dateStr)) {
    onError(
      new QueueBusinessError('วันที่เลือกอยู่นอกช่วงเปิดรับจอง 30 วัน'),
    );
    return () => {};
  }

  const q = query(
    collection(db, 'queues'),
    where('date', '==', dateStr),
    limit(300),
  );
  return onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs.map((d) => ({
        id: d.id,
        data: d.data() as FirestoreQueueDoc,
      }));
      onData(computeSlotsFromDocs(service.channel, dateStr, docs));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'queues');
      } catch (wrapped) {
        onError(
          wrapped instanceof Error ? wrapped : new Error('โหลดรอบเวลาไม่สำเร็จ'),
        );
      }
    },
  );
}

export async function createOnlineBooking(input: {
  serviceId: ServiceId;
  date: string;
  slotId: string;
  fullName: string;
  idNumber: string;
  phone: string;
  note: string;
  consent: boolean;
}): Promise<BookingRecord> {
  const service = getServiceById(input.serviceId);
  if (!service) {
    throw new QueueBusinessError('กรุณาเลือกประเภทบริการให้ถูกต้อง');
  }

  const holidayName = getPublicHolidayName(input.date);
  if (holidayName) {
    throw new QueueBusinessError(
      `วันที่เลือกเป็นวันหยุดราชการ (${holidayName}) ไม่เปิดให้จองคิว`,
    );
  }

  const validDates = getBookableWorkdays();
  if (!isValidDateStr(input.date) || !validDates.includes(input.date)) {
    throw new QueueBusinessError('วันที่นัดหมายไม่ถูกต้องหรือปิดรับจอง');
  }

  if (!getSlotById(input.slotId)) {
    throw new QueueBusinessError('รอบเวลาที่เลือกไม่ถูกต้อง');
  }

  const fullName = input.fullName.trim().slice(0, 120);
  if (fullName.length < 2) {
    throw new QueueBusinessError('กรุณากรอกชื่อ-นามสกุลให้ถูกต้อง');
  }

  const idNumber = normalizeIdNumber(input.idNumber);
  if (!isValidIdForService(idNumber, service.id) || idNumber.length > 32) {
    throw new QueueBusinessError(
      service.id === 'foreign'
        ? 'เลขบัตรประจำตัวประชาชนหรือเลขหนังสือเดินทางไม่ถูกต้อง'
        : 'เลขบัตรประจำตัวประชาชน 13 หลักไม่ถูกต้อง',
    );
  }

  const phone = normalizePhone(input.phone);
  if (!isValidThaiPhone(phone) || phone.length > 24) {
    throw new QueueBusinessError('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง');
  }

  if (!input.consent) {
    throw new QueueBusinessError(
      'กรุณายืนยันความถูกต้องของข้อมูลก่อนจองคิว',
    );
  }

  const note = input.note.trim().slice(0, 500);
  const dayDocs = await fetchQueuesForDate(input.date);
  const slots = computeSlotsFromDocs(service.channel, input.date, dayDocs);
  const chosenSlot = slots.find((s) => s.id === input.slotId);
  if (!chosenSlot || !chosenSlot.available) {
    throw new QueueBusinessError(
      'รอบเวลาที่เลือกเต็มหรือปิดรับจองแล้ว กรุณาเลือกรอบเวลาอื่น',
    );
  }

  const identityHash = await computeIdentityHash(
    input.date,
    service.channel,
    idNumber,
  );
  const duplicate = dayDocs.find(
    ({ data: b }) =>
      b.channel === service.channel &&
      b.identityHash === identityHash &&
      (b.status === 'waiting' || b.status === 'called'),
  );
  if (duplicate) {
    throw new QueueBusinessError(
      `เลขบัตรนี้มีนัดหมายในวันดังกล่าวแล้ว (รหัสการจอง ${duplicate.data.bookingCode})`,
    );
  }

  const queueId = window.crypto.randomUUID();
  const bookingCode = generateUniqueBookingCode(dayDocs);
  const queueNo = nextQueueNoForPrefix(service.prefix, dayDocs);
  const lookupHash = await computeLookupHash(bookingCode, idNumber);
  const channelDef = CHANNELS[service.channel];

  const batch = writeBatch(db);
  batch.set(doc(db, 'queues', queueId), {
    bookingCode,
    queueNo,
    serviceId: service.id,
    serviceTitle: service.title.slice(0, 120),
    channel: service.channel,
    counter: channelDef.counter,
    date: input.date,
    slotId: input.slotId,
    issuedTime: '',
    source: 'online',
    status: 'waiting',
    lookupHash,
    identityHash,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'queueDetails', queueId), {
    queueId,
    date: input.date,
    bookingCode,
    fullName,
    idNumber,
    phone,
    note,
    lookupHash,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'queueLookups', lookupHash), {
    queueId,
    bookingCode,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `queues/${queueId}`);
  }

  const nowIso = new Date().toISOString();
  return {
    id: queueId,
    bookingCode,
    queueNo,
    serviceId: service.id,
    serviceTitle: service.title,
    channel: service.channel,
    counter: channelDef.counter,
    date: input.date,
    slotId: input.slotId,
    source: 'online',
    fullName,
    idNumber,
    phone,
    note,
    status: 'waiting',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export async function issueKioskTicket(
  serviceId: ServiceId,
): Promise<BookingRecord> {
  const service = getServiceById(serviceId);
  if (!service) {
    throw new QueueBusinessError('กรุณาเลือกประเภทบริการให้ถูกต้อง');
  }

  const now = new Date();
  const date = getBangkokDateString(now);
  const issuedTime = getBangkokTimeString(now);
  const slotId = `${issuedTime.replace(':', '')}-kiosk`;

  const dayDocs = await fetchQueuesForDate(date);
  const queueId = window.crypto.randomUUID();
  const bookingCode = generateUniqueBookingCode(dayDocs);
  const queueNo = nextQueueNoForPrefix(service.prefix, dayDocs);
  const lookupHash = await sha256Hex(`kiosk-lookup:${queueId}`);
  const identityHash = await sha256Hex(`kiosk-identity:${queueId}`);
  const channelDef = CHANNELS[service.channel];

  const fullName = 'ผู้รับบริการหน้าเคาน์เตอร์ (เครื่องกดบัตรคิว)';
  const note = `กดบัตรคิวจากตู้หน้างาน เวลา ${issuedTime} น.`;

  const batch = writeBatch(db);
  batch.set(doc(db, 'queues', queueId), {
    bookingCode,
    queueNo,
    serviceId: service.id,
    serviceTitle: service.title.slice(0, 120),
    channel: service.channel,
    counter: channelDef.counter,
    date,
    slotId,
    issuedTime,
    source: 'kiosk',
    status: 'waiting',
    lookupHash,
    identityHash,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'queueDetails', queueId), {
    queueId,
    date,
    bookingCode,
    fullName,
    idNumber: '-',
    phone: '-',
    note,
    lookupHash,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `queues/${queueId}`);
  }

  const nowIso = now.toISOString();
  return {
    id: queueId,
    bookingCode,
    queueNo,
    serviceId: service.id,
    serviceTitle: service.title,
    channel: service.channel,
    counter: channelDef.counter,
    date,
    slotId,
    issuedTime,
    source: 'kiosk',
    fullName,
    idNumber: '-',
    phone: '-',
    note,
    status: 'waiting',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export async function lookupCitizenBooking(
  bookingCodeRaw: string,
  idNumberRaw: string,
): Promise<{ booking: BookingRecord; nowServing: BookingRecord | null }> {
  const bookingCode = bookingCodeRaw.trim().toUpperCase();
  const idNumber = normalizeIdNumber(idNumberRaw);
  if (!bookingCode || !idNumber) {
    throw new QueueBusinessError('กรุณากรอกรหัสการจองและเลขบัตรให้ครบถ้วน');
  }

  const lookupHash = await computeLookupHash(bookingCode, idNumber);
  let lookupSnap;
  try {
    lookupSnap = await getDoc(doc(db, 'queueLookups', lookupHash));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.GET,
      `queueLookups/${lookupHash}`,
    );
  }

  if (!lookupSnap.exists()) {
    throw new QueueBusinessError(
      'ไม่พบข้อมูลนัดหมาย โปรดตรวจสอบรหัสการจองและเลขบัตรอีกครั้ง',
    );
  }

  const { queueId } = lookupSnap.data() as { queueId: string };
  let queueSnap;
  try {
    queueSnap = await getDoc(doc(db, 'queues', queueId));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `queues/${queueId}`);
  }

  if (!queueSnap.exists()) {
    throw new QueueBusinessError(
      'ไม่พบข้อมูลนัดหมาย โปรดตรวจสอบรหัสการจองและเลขบัตรอีกครั้ง',
    );
  }

  const qData = queueSnap.data() as FirestoreQueueDoc;
  if (qData.bookingCode !== bookingCode || qData.lookupHash !== lookupHash) {
    throw new QueueBusinessError(
      'ไม่พบข้อมูลนัดหมาย โปรดตรวจสอบรหัสการจองและเลขบัตรอีกครั้ง',
    );
  }

  const booking = mapQueueDocToPublicBooking(queueSnap.id, qData);
  const dayDocs = await fetchQueuesForDate(qData.date);
  const dayBookings = dayDocs.map((d) =>
    mapQueueDocToPublicBooking(d.id, d.data),
  );
  const summary = summarizeChannel(qData.channel, dayBookings);

  return {
    booking,
    nowServing: summary.called,
  };
}

export async function rescheduleCitizenBooking(input: {
  bookingCode: string;
  idNumber: string;
  date: string;
  slotId: string;
}): Promise<BookingRecord> {
  const bookingCode = input.bookingCode.trim().toUpperCase();
  const idNumber = normalizeIdNumber(input.idNumber);
  const newDate = input.date;
  const newSlotId = input.slotId;

  const lookupHash = await computeLookupHash(bookingCode, idNumber);
  let lookupSnap;
  try {
    lookupSnap = await getDoc(doc(db, 'queueLookups', lookupHash));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.GET,
      `queueLookups/${lookupHash}`,
    );
  }
  if (!lookupSnap.exists()) {
    throw new QueueBusinessError('ไม่พบข้อมูลนัดหมาย');
  }

  const { queueId } = lookupSnap.data() as { queueId: string };
  let queueSnap;
  try {
    queueSnap = await getDoc(doc(db, 'queues', queueId));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `queues/${queueId}`);
  }
  if (!queueSnap.exists()) {
    throw new QueueBusinessError('ไม่พบข้อมูลนัดหมาย');
  }

  const existing = queueSnap.data() as FirestoreQueueDoc;
  if (existing.status !== 'waiting') {
    throw new QueueBusinessError(
      'สามารถเลื่อนนัดได้เฉพาะคิวที่มีสถานะรอรับบริการเท่านั้น',
    );
  }

  const holidayName = getPublicHolidayName(newDate);
  if (holidayName) {
    throw new QueueBusinessError(
      `วันที่เลือกเป็นวันหยุดราชการ (${holidayName}) ไม่เปิดให้จองคิว`,
    );
  }

  const validDates = getBookableWorkdays();
  if (!isValidDateStr(newDate) || !validDates.includes(newDate)) {
    throw new QueueBusinessError('วันที่นัดหมายใหม่ไม่ถูกต้อง');
  }

  if (!getSlotById(newSlotId)) {
    throw new QueueBusinessError('รอบเวลาที่เลือกไม่ถูกต้อง');
  }

  if (existing.date === newDate && existing.slotId === newSlotId) {
    throw new QueueBusinessError(
      'กรุณาเลือกวันหรือรอบเวลาใหม่ที่แตกต่างจากเดิม',
    );
  }

  const dayDocs = await fetchQueuesForDate(newDate);
  const slots = computeSlotsFromDocs(existing.channel, newDate, dayDocs);
  const chosenSlot = slots.find((s) => s.id === newSlotId);
  if (!chosenSlot || !chosenSlot.available) {
    throw new QueueBusinessError('รอบเวลาใหม่เต็มหรือปิดรับจองแล้ว');
  }

  const service = getServiceById(existing.serviceId);
  const nextQueueNo =
    existing.date !== newDate && service
      ? nextQueueNoForPrefix(service.prefix, dayDocs)
      : existing.queueNo;
  const nextIdentityHash = await computeIdentityHash(
    newDate,
    existing.channel,
    idNumber,
  );

  try {
    await updateDoc(doc(db, 'queues', queueId), {
      date: newDate,
      slotId: newSlotId,
      queueNo: nextQueueNo,
      identityHash: nextIdentityHash,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `queues/${queueId}`);
  }

  const updatedSnap = await getDoc(doc(db, 'queues', queueId));
  return mapQueueDocToPublicBooking(
    queueId,
    updatedSnap.data() as FirestoreQueueDoc,
  );
}

export async function cancelCitizenBooking(input: {
  bookingCode: string;
  idNumber: string;
}): Promise<BookingRecord> {
  const bookingCode = input.bookingCode.trim().toUpperCase();
  const idNumber = normalizeIdNumber(input.idNumber);
  const lookupHash = await computeLookupHash(bookingCode, idNumber);

  let lookupSnap;
  try {
    lookupSnap = await getDoc(doc(db, 'queueLookups', lookupHash));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.GET,
      `queueLookups/${lookupHash}`,
    );
  }
  if (!lookupSnap.exists()) {
    throw new QueueBusinessError('ไม่พบข้อมูลนัดหมาย');
  }

  const { queueId } = lookupSnap.data() as { queueId: string };
  let queueSnap;
  try {
    queueSnap = await getDoc(doc(db, 'queues', queueId));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `queues/${queueId}`);
  }
  if (!queueSnap.exists()) {
    throw new QueueBusinessError('ไม่พบข้อมูลนัดหมาย');
  }

  const existing = queueSnap.data() as FirestoreQueueDoc;
  if (existing.status !== 'waiting') {
    throw new QueueBusinessError(
      'ไม่สามารถยกเลิกคิวที่ถูกเรียกหรือดำเนินการเสร็จสิ้นแล้วได้',
    );
  }

  try {
    await updateDoc(doc(db, 'queues', queueId), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `queues/${queueId}`);
  }

  const updatedSnap = await getDoc(doc(db, 'queues', queueId));
  return mapQueueDocToPublicBooking(
    queueId,
    updatedSnap.data() as FirestoreQueueDoc,
  );
}

export function subscribeBoardSnapshot(
  dateStr: string,
  onData: (board: BoardSnapshot) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'queues'),
    where('date', '==', dateStr),
    limit(300),
  );

  return onSnapshot(
    q,
    (snap) => {
      // Wait for server timestamps to stabilize before firing voice announcements if needed
      const bookings = snap.docs.map((d) =>
        mapQueueDocToPublicBooking(d.id, d.data() as FirestoreQueueDoc),
      );

      const general = summarizeChannel('general', bookings);
      const foreign = summarizeChannel('foreign', bookings);

      const stats = {
        total: bookings.filter((b) => b.status !== 'cancelled').length,
        waiting: bookings.filter((b) => b.status === 'waiting').length,
        called: bookings.filter((b) => b.status === 'called').length,
        done: bookings.filter((b) => b.status === 'done').length,
      };

      onData({
        date: dateStr,
        channels: { general, foreign },
        stats,
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'queues');
      } catch (wrapped) {
        onError(
          wrapped instanceof Error
            ? wrapped
            : new Error('ไม่สามารถโหลดหน้าจอเรียกคิวได้'),
        );
      }
    },
  );
}

export async function checkIsAdminEmail(
  rawEmail: string | null | undefined,
): Promise<boolean> {
  if (!rawEmail) return false;
  const email = rawEmail.trim().toLowerCase();
  if (email === PRIMARY_ADMIN_EMAIL) return true;
  try {
    const snap = await getDoc(doc(db, 'staffAdmins', email));
    return snap.exists();
  } catch {
    return false;
  }
}

export function subscribeAdminDayBookings(
  dateStr: string,
  onData: (data: AdminDaySnapshot) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  let queueDocs: Array<{ id: string; data: FirestoreQueueDoc }> | null = null;
  let detailMap = new Map<string, FirestoreQueueDetailDoc>();
  let detailsLoaded = false;

  const emit = () => {
    if (!queueDocs || !detailsLoaded) return;
    const bookings = queueDocs
      .map(({ id, data }) =>
        mapQueueDocToPublicBooking(id, data, detailMap.get(id) ?? null),
      )
      .sort((a, b) => {
        if (a.slotId !== b.slotId) return a.slotId.localeCompare(b.slotId);
        return a.queueNo.localeCompare(b.queueNo);
      });

    onData({
      date: dateStr,
      bookings,
      channels: {
        general: summarizeChannel('general', bookings),
        foreign: summarizeChannel('foreign', bookings),
      },
    });
  };

  const qQueues = query(
    collection(db, 'queues'),
    where('date', '==', dateStr),
    limit(300),
  );
  const qDetails = query(
    collection(db, 'queueDetails'),
    where('date', '==', dateStr),
  );

  const unsubQueues = onSnapshot(
    qQueues,
    (snap) => {
      queueDocs = snap.docs.map((d) => ({
        id: d.id,
        data: d.data() as FirestoreQueueDoc,
      }));
      emit();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'queues');
      } catch (wrapped) {
        onError(
          wrapped instanceof Error ? wrapped : new Error('โหลดข้อมูลคิวล้มเหลว'),
        );
      }
    },
  );

  const unsubDetails = onSnapshot(
    qDetails,
    (snap) => {
      const next = new Map<string, FirestoreQueueDetailDoc>();
      for (const d of snap.docs) {
        next.set(d.id, d.data() as FirestoreQueueDetailDoc);
      }
      detailMap = next;
      detailsLoaded = true;
      emit();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'queueDetails');
      } catch (wrapped) {
        onError(
          wrapped instanceof Error
            ? wrapped
            : new Error('โหลดรายละเอียดผู้จองล้มเหลว'),
        );
      }
    },
  );

  return () => {
    unsubQueues();
    unsubDetails();
  };
}

export async function adminCallNext(
  channel: ChannelId,
  dateStr: string,
  counter: number,
): Promise<{ called: BookingRecord | null; message: string }> {
  if (!isValidCounterForChannel(channel, counter)) {
    throw new QueueBusinessError('หมายเลขช่องบริการไม่ถูกต้อง');
  }

  const dayDocs = await fetchQueuesForDate(dateStr);
  const batch = writeBatch(db);
  let hasBatchWrites = false;

  for (const { id, data } of dayDocs) {
    if (
      data.channel === channel &&
      (data.counter || 1) === counter &&
      data.status === 'called'
    ) {
      batch.update(doc(db, 'queues', id), {
        status: 'done',
        updatedAt: serverTimestamp(),
      });
      hasBatchWrites = true;
    }
  }

  const nextCandidate = dayDocs
    .filter(
      ({ data }) => data.channel === channel && data.status === 'waiting',
    )
    .sort((a, b) => {
      if (a.data.slotId !== b.data.slotId) {
        return a.data.slotId.localeCompare(b.data.slotId);
      }
      return timestampToIso(a.data.createdAt).localeCompare(
        timestampToIso(b.data.createdAt),
      );
    })[0];

  if (!nextCandidate) {
    if (hasBatchWrites) {
      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'queues');
      }
    }
    return {
      called: null,
      message: `ไม่มีคิวรอรับบริการใน${CHANNELS[channel].label}`,
    };
  }

  batch.update(doc(db, 'queues', nextCandidate.id), {
    status: 'called',
    counter,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `queues/${nextCandidate.id}`,
    );
  }

  const calledRecord = mapQueueDocToPublicBooking(nextCandidate.id, {
    ...nextCandidate.data,
    status: 'called',
    counter,
  });

  return {
    called: calledRecord,
    message: `กำลังเรียกคิว ${calledRecord.queueNo} (${CHANNELS[channel].label} ช่องบริการ ${counter})`,
  };
}

export async function adminUpdateBookingStatus(
  id: string,
  status: BookingStatus,
  counter?: number,
): Promise<BookingRecord> {
  const queueRef = doc(db, 'queues', id);
  let snap;
  try {
    snap = await getDoc(queueRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `queues/${id}`);
  }

  if (!snap.exists()) {
    throw new QueueBusinessError('ไม่พบรายการคิว');
  }

  const target = snap.data() as FirestoreQueueDoc;

  if (status === 'called') {
    const requestedCounter =
      counter !== undefined
        ? counter
        : isValidCounterForChannel(target.channel, target.counter)
          ? target.counter
          : 1;

    if (!isValidCounterForChannel(target.channel, requestedCounter)) {
      throw new QueueBusinessError('หมายเลขช่องบริการไม่ถูกต้อง');
    }

    const dayDocs = await fetchQueuesForDate(target.date);
    const batch = writeBatch(db);
    for (const d of dayDocs) {
      if (
        d.id !== id &&
        d.data.channel === target.channel &&
        (d.data.counter || 1) === requestedCounter &&
        d.data.status === 'called'
      ) {
        batch.update(doc(db, 'queues', d.id), {
          status: 'done',
          updatedAt: serverTimestamp(),
        });
      }
    }
    batch.update(queueRef, {
      status: 'called',
      counter: requestedCounter,
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `queues/${id}`);
    }

    return mapQueueDocToPublicBooking(id, {
      ...target,
      status: 'called',
      counter: requestedCounter,
    });
  }

  try {
    await updateDoc(queueRef, {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `queues/${id}`);
  }

  return mapQueueDocToPublicBooking(id, {
    ...target,
    status,
  });
}

export async function adminRecallQueue(
  id: string,
  counter?: number,
): Promise<{ booking: BookingRecord; message: string }> {
  const queueRef = doc(db, 'queues', id);
  let snap;
  try {
    snap = await getDoc(queueRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `queues/${id}`);
  }

  if (!snap.exists()) {
    throw new QueueBusinessError('ไม่พบรายการคิว');
  }

  const target = snap.data() as FirestoreQueueDoc;
  if (target.status !== 'called') {
    throw new QueueBusinessError(
      'สามารถเรียกซ้ำได้เฉพาะคิวที่มีสถานะกำลังเรียกเท่านั้น',
    );
  }

  const nextCounter = counter ?? (target.counter || 1);
  if (!isValidCounterForChannel(target.channel, nextCounter)) {
    throw new QueueBusinessError('หมายเลขช่องบริการไม่ถูกต้อง');
  }

  try {
    await updateDoc(queueRef, {
      counter: nextCounter,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `queues/${id}`);
  }

  const updated = mapQueueDocToPublicBooking(id, {
    ...target,
    counter: nextCounter,
  });
  return {
    booking: updated,
    message: `เรียกซ้ำคิว ${updated.queueNo} (${CHANNELS[updated.channel].label} ช่องบริการ ${nextCounter})`,
  };
}

export async function listStaffAdmins(): Promise<StaffAdminRecord[]> {
  try {
    const q = query(collection(db, 'staffAdmins'), where('email', '>=', ''));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as {
        email: string;
        displayName: string;
        addedBy: string;
        createdAt?: Timestamp | null;
      };
      return {
        email: data.email,
        displayName: data.displayName || '',
        addedBy: data.addedBy,
        createdAt: timestampToIso(data.createdAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'staffAdmins');
  }
}

export async function addStaffAdmin(
  emailRaw: string,
  displayNameRaw: string,
  addedByRaw: string,
): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(email)) {
    throw new QueueBusinessError('รูปแบบอีเมล Google ไม่ถูกต้อง');
  }
  const displayName = displayNameRaw.trim().slice(0, 120);
  const addedBy = addedByRaw.trim().toLowerCase();

  try {
    await setDoc(doc(db, 'staffAdmins', email), {
      email,
      displayName,
      addedBy,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `staffAdmins/${email}`);
  }
}

export async function removeStaffAdmin(emailRaw: string): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  if (email === PRIMARY_ADMIN_EMAIL) {
    throw new QueueBusinessError('ไม่สามารถลบผู้ดูแลระบบหลักได้');
  }
  try {
    await deleteDoc(doc(db, 'staffAdmins', email));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `staffAdmins/${email}`);
  }
}

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { speakThaiQueueCall, unlockQueueAudio } from '../lib/api';
import {
  type BoardSnapshot,
  subscribeBoardSnapshot,
} from '../lib/queueService';
import {
  CHANNELS,
  OFFICE_INFO,
  formatQueueNoDisplay,
  formatSlotTime,
  formatThaiDate,
  getBangkokDateString,
} from '../shared/bookingConfig';

export function BoardPage() {
  const [boardDate, setBoardDate] = useState(() => getBangkokDateString());
  const [data, setData] = useState<BoardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [testingVoice, setTestingVoice] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const voiceEnabledRef = useRef(false);
  const lastCalledBySlotRef = useRef<Record<string, string>>({});

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const today = getBangkokDateString();
      setBoardDate((prev) => (prev === today ? prev : today));
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeBoardSnapshot(
      boardDate,
      (res) => {
        setData(res);
        setLoading(false);

        const nextSnapshots: Record<string, string> = {};
        const toAnnounce: Array<{ queueNo: string; counter: number }> = [];

        for (const chKey of ['general', 'foreign'] as const) {
          const chData = res.channels[chKey];
          const map = chData.calledByCounter ?? {};
          for (const c of CHANNELS[chKey].counters) {
            const item = map[String(c)];
            if (item) {
              const slotKey = `${chKey}-${c}`;
              const sig = `${item.queueNo}:${item.updatedAt}`;
              nextSnapshots[slotKey] = sig;
              if (
                voiceEnabledRef.current &&
                item.updatedAt &&
                lastCalledBySlotRef.current[slotKey] !== sig
              ) {
                toAnnounce.push({ queueNo: item.queueNo, counter: c });
              }
            }
          }
        }

        if (voiceEnabledRef.current && toAnnounce.length > 0) {
          const latest = toAnnounce[toAnnounce.length - 1];
          void speakThaiQueueCall(latest.queueNo, latest.counter).then((r) => {
            if (!r.ok && r.error) setVoiceNotice(r.error);
            else setVoiceNotice(null);
          });
        }

        lastCalledBySlotRef.current = nextSnapshots;
      },
      (err) => {
        setLoading(false);
        setVoiceNotice(err.message);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [boardDate, reloadTick]);

  const handleToggleVoice = async () => {
    const next = !voiceEnabled;
    if (next) {
      unlockQueueAudio();
      setVoiceNotice(null);
      setVoiceEnabled(true);
      const activeGeneral = data?.channels.general.called;
      const activeForeign = data?.channels.foreign.called;
      const target = activeGeneral ?? activeForeign;
      if (target) {
        const slotKey = `${target.channel}-${target.counter || 1}`;
        lastCalledBySlotRef.current[slotKey] = `${target.queueNo}:${target.updatedAt}`;
        const r = await speakThaiQueueCall(target.queueNo, target.counter || 1);
        if (!r.ok && r.error) setVoiceNotice(r.error);
      }
    } else {
      setVoiceEnabled(false);
    }
  };

  const handleTestVoice = async () => {
    unlockQueueAudio();
    setVoiceNotice(null);
    setTestingVoice(true);
    try {
      const r = await speakThaiQueueCall('A-001', 1);
      if (!r.ok && r.error) {
        setVoiceNotice(r.error);
      }
    } finally {
      setTestingVoice(false);
    }
  };

  const channels = [
    { key: 'general' as const, meta: CHANNELS.general },
    { key: 'foreign' as const, meta: CHANNELS.foreign },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex flex-col gap-4 border-b border-sand/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-ink-2">
            {OFFICE_INFO.name} · หน้าจอแสดงผลเรียกคิว
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {data ? formatThaiDate(data.date) : 'กำลังโหลดข้อมูลคิว...'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition whitespace-nowrap ${
              voiceEnabled
                ? 'border-ink bg-ink text-cream'
                : 'border-sand bg-cream-2 text-ink hover:bg-white'
            }`}
          >
            {voiceEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
            {voiceEnabled ? 'เปิดเสียงเรียกคิวอัตโนมัติ' : 'ปิดเสียงเรียกคิว'}
          </button>

          <button
            type="button"
            disabled={testingVoice}
            onClick={handleTestVoice}
            className="inline-flex items-center gap-2 rounded-xl border border-sand bg-white/80 px-4 py-2 text-xs font-semibold text-ink transition hover:bg-white disabled:opacity-50 whitespace-nowrap"
          >
            <Volume2 className="h-3.5 w-3.5" />
            {testingVoice ? 'กำลังทดสอบเสียง...' : 'ทดสอบเสียง'}
          </button>

          <button
            type="button"
            onClick={() => {
              setBoardDate(getBangkokDateString());
              setReloadTick((n) => n + 1);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-sand bg-white/80 px-4 py-2 text-xs font-semibold text-ink transition hover:bg-white whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            รีเฟรช
          </button>
        </div>
      </div>

      {voiceNotice && (
        <div
          role="alert"
          className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800"
        >
          {voiceNotice}
        </div>
      )}

      {/* Summary KPI strip */}
      {data && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-sand bg-cream-2 px-5 py-4">
            <p className="text-xs text-ink/60">นัดหมายทั้งหมด</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-ink">
              {data.stats.total}
            </p>
          </div>
          <div className="rounded-2xl border border-sand bg-cream-2 px-5 py-4">
            <p className="text-xs text-ink/60">กำลังเรียกคิว</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-blue-700">
              {data.stats.called}
            </p>
          </div>
          <div className="rounded-2xl border border-sand bg-cream-2 px-5 py-4">
            <p className="text-xs text-ink/60">รอรับบริการ</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-700">
              {data.stats.waiting}
            </p>
          </div>
          <div className="rounded-2xl border border-sand bg-cream-2 px-5 py-4">
            <p className="text-xs text-ink/60">ให้บริการแล้ว</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-700">
              {data.stats.done}
            </p>
          </div>
        </div>
      )}

      {/* Channel Displays */}
      {loading && !data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-80 animate-pulse rounded-3xl bg-sand/40" />
          <div className="h-80 animate-pulse rounded-3xl bg-sand/40" />
        </div>
      ) : data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {channels.map(({ key, meta }) => {
            const ch = data.channels[key];
            const isForeign = key === 'foreign';
            return (
              <section
                key={key}
                className={`overflow-hidden rounded-3xl border bg-white ${
                  isForeign ? 'border-pink-200' : 'border-sand'
                }`}
              >
                <div
                  className={`px-6 py-6 text-white ${
                    isForeign ? 'bg-pink-700' : 'bg-ink'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-white/80">
                        {meta.hint}
                      </p>
                      <h2 className="mt-0.5 text-xl font-bold">{meta.label}</h2>
                    </div>
                    <span className="font-mono text-xs text-white/85 tabular-nums">
                      รอรับบริการ {ch.waitingCount} คิว
                    </span>
                  </div>

                  <div className="mt-6 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs text-white/80">หมายเลขคิวที่กำลังเรียก</p>
                      <p className="mt-1 font-mono text-6xl font-bold leading-none tracking-wider tabular-nums">
                        {ch.called
                          ? formatQueueNoDisplay(ch.called.queueNo)
                          : '—'}
                      </p>
                    </div>
                    {ch.called && (
                      <div className="text-right text-xs text-white/90">
                        <span className="inline-block rounded-lg bg-white/20 px-2.5 py-1 font-semibold text-white">
                          ช่องบริการ {ch.called.counter}
                        </span>
                        <p className="mt-1.5 font-semibold">{ch.called.serviceTitle}</p>
                        <p className="mt-0.5 font-mono tabular-nums">
                          รอบ {formatSlotTime(ch.called.slotId)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Per-counter live grid */}
                <div
                  className={`border-b px-6 py-4 ${
                    isForeign
                      ? 'border-pink-100 bg-pink-50/45'
                      : 'border-sand/70 bg-cream/60'
                  }`}
                >
                  <p className="mb-2.5 text-[11px] font-semibold text-ink/60">
                    สถานะรายช่องบริการ ({meta.counters.length} ช่อง)
                  </p>
                  <div
                    className={`grid gap-2 ${
                      isForeign
                        ? 'grid-cols-3 sm:grid-cols-5'
                        : 'grid-cols-3'
                    }`}
                  >
                    {meta.counters.map((counterNum) => {
                      const activeAtCounter =
                        ch.calledByCounter?.[String(counterNum)] ?? null;
                      return (
                        <div
                          key={counterNum}
                          className={`rounded-xl border px-2.5 py-2 text-center ${
                            activeAtCounter
                              ? isForeign
                                ? 'border-pink-300 bg-white shadow-xs'
                                : 'border-blue-300 bg-white shadow-xs'
                              : 'border-sand/70 bg-white/60'
                          }`}
                        >
                          <p className="text-[11px] font-medium text-ink/55">
                            ช่อง {counterNum}
                          </p>
                          <p
                            className={`mt-0.5 font-mono text-base font-bold tabular-nums ${
                              activeAtCounter
                                ? isForeign
                                  ? 'text-pink-700'
                                  : 'text-ink'
                                : 'text-ink/30'
                            }`}
                          >
                            {activeAtCounter
                              ? formatQueueNoDisplay(activeAtCounter.queueNo)
                              : '—'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-xs font-semibold text-ink/65">
                    คิวถัดไปที่รอเรียก
                  </h3>
                  {ch.waitingQueue.length === 0 ? (
                    <p className="mt-3 text-sm text-ink/50">
                      ไม่มีคิวรอรับบริการในช่องนี้
                    </p>
                  ) : (
                    <ul className="mt-3 divide-y divide-sand/60">
                      {ch.waitingQueue.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-3 py-2.5 text-sm"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`font-mono text-base font-bold tabular-nums ${
                                isForeign ? 'text-pink-700' : 'text-ink'
                              }`}
                            >
                              {formatQueueNoDisplay(item.queueNo)}
                            </span>
                            <span className="truncate text-ink/75">
                              {item.serviceTitle}
                            </span>
                          </div>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-ink/55">
                            {formatSlotTime(item.slotId)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

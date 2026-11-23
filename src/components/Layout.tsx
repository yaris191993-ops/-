import { Link, NavLink, useLocation } from 'react-router-dom';
import { OFFICE_INFO } from '../shared/bookingConfig';

const NAV_ITEMS = [
  { to: '/', label: 'จองคิว', end: true },
  { to: '/check', label: 'ตรวจสอบ / เลื่อน / ยกเลิก', end: false },
  { to: '/board', label: 'หน้าจอเรียกคิว', end: false },
  { to: '/admin', label: 'เจ้าหน้าที่', end: false },
];

export function DepartmentLogo({ className = 'h-11 w-11' }: { className?: string }) {
  return (
    <img
      src="/assets/logo-doe.png"
      alt="ตราสัญลักษณ์กรมการจัดหางาน"
      referrerPolicy="no-referrer"
      className={`${className} shrink-0 object-contain drop-shadow-[0_1px_2px_rgba(255,255,255,0.22)]`}
    />
  );
}

export function PublicHeader() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <header className="no-print sticky top-0 z-30 border-b border-[#0d204a] bg-[#132d63] text-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-3 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <DepartmentLogo className="h-11 w-11" />
          <span className="text-[15px] font-semibold tracking-tight text-white whitespace-nowrap">
            {OFFICE_INFO.name}
          </span>
        </Link>

        <nav
          aria-label="เมนูหลัก"
          className="hidden md:flex items-center gap-6 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `whitespace-nowrap shrink-0 border-b-2 py-1 transition-colors ${
                  isActive
                    ? 'border-amber-300 text-white font-semibold'
                    : 'border-transparent text-white/75 hover:text-white hover:border-white/40'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center shrink-0">
          {isHome ? (
            <Link
              to="/check"
              className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-[#132d63] transition hover:bg-blue-50 whitespace-nowrap shrink-0"
            >
              ตรวจสอบคิวของฉัน
            </Link>
          ) : (
            <Link
              to="/"
              className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-[#132d63] transition hover:bg-blue-50 whitespace-nowrap shrink-0"
            >
              จองคิวใหม่
            </Link>
          )}
        </div>
      </div>

      {/* Mobile navigation strip */}
      <nav
        aria-label="เมนูมือถือ"
        className="flex md:hidden items-center gap-5 overflow-x-auto border-t border-white/15 bg-[#0f2452] px-4 py-2 text-xs font-medium"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `whitespace-nowrap shrink-0 border-b-2 py-1 transition-colors ${
                isActive
                  ? 'border-amber-300 text-white font-semibold'
                  : 'border-transparent text-white/75'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter({ tone = 'cream' }: { tone?: 'cream' | 'slate' }) {
  const isSlate = tone === 'slate';
  return (
    <footer
      className={`no-print border-t ${
        isSlate
          ? 'border-slate-200 bg-white text-slate-600'
          : 'border-sand bg-white text-ink/75'
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1 text-xs leading-relaxed">
            <p
              className={`text-sm font-semibold ${
                isSlate ? 'text-slate-900' : 'text-ink'
              }`}
            >
              {OFFICE_INFO.name} · {OFFICE_INFO.department}
            </p>
            <p>{OFFICE_INFO.address}</p>
            <p>{OFFICE_INFO.phones}</p>
          </div>
          <div className="text-xs leading-relaxed sm:text-right">
            <p className="font-medium">{OFFICE_INFO.hours}</p>
            <p className="mt-1 opacity-75">
              ระบบจองคิวรับบริการออนไลน์ (จองล่วงหน้าได้สูงสุด 30 วัน)
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

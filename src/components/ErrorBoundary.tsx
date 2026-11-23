import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

function extractReadableError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (typeof parsed.error === 'string' && parsed.error.length > 0) {
      if (parsed.error.toLowerCase().includes('permission')) {
        return 'ไม่มีสิทธิ์เข้าถึงข้อมูลในส่วนนี้ หรือสิทธิ์การใช้งานหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง';
      }
      if (parsed.error.toLowerCase().includes('quota')) {
        return 'ระบบฐานข้อมูลใช้งานครบโควต้าประจำวันแล้ว กรุณาลองใหม่อีกครั้งในวันถัดไป';
      }
      return parsed.error;
    }
  } catch {
    // Plain error string
  }
  return raw || 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณารีโหลดหน้าเว็บ';
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: extractReadableError(error.message),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Uncaught application error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-screen place-items-center bg-[#f8f9fc] p-4 text-slate-900">
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-lg font-bold text-slate-900">
              เกิดข้อผิดพลาดในการทำงานของระบบ
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#132d63] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1b3c82]"
            >
              <RotateCcw className="h-4 w-4" />
              โหลดหน้าใหม่
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

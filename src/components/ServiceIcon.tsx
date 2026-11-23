import {
  Briefcase,
  Compass,
  FileCheck2,
  Globe2,
  Plane,
  type LucideIcon,
} from 'lucide-react';
import type { ServiceId } from '../shared/bookingConfig';

const ICON_MAP: Record<ServiceId, LucideIcon> = {
  unemployment: FileCheck2,
  domestic: Briefcase,
  foreign: Globe2,
  overseas: Plane,
  guidance: Compass,
};

export function ServiceIcon({
  serviceId,
  className = 'h-5 w-5',
}: {
  serviceId: ServiceId;
  className?: string;
}) {
  const Icon = ICON_MAP[serviceId] ?? Briefcase;
  return <Icon className={className} aria-hidden="true" />;
}

'use client';
import { Badge } from '@/components/ui/Badge';

type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

const COLORS: Record<Severity, string> = {
  info: '#6B7280',
  low: '#3B82F6',
  medium: '#F59E0B',
  high: '#EF4444',
  critical: '#7C1D6F',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge color={COLORS[severity]} variant="soft">
      {severity}
    </Badge>
  );
}

export function StatusBadge({
  status,
}: {
  status: 'open' | 'acknowledged' | 'fixed' | 'wont_fix' | 'duplicate';
}) {
  const palette: Record<string, string> = {
    open: '#EF4444',
    acknowledged: '#F59E0B',
    fixed: '#10B981',
    wont_fix: '#6B7280',
    duplicate: '#6B7280',
  };
  return (
    <Badge color={palette[status]} variant="outline">
      {status.replace('_', ' ')}
    </Badge>
  );
}

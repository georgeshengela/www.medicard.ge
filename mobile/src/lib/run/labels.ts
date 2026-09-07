import { ka } from '@/i18n/ka';
import { formatThousands, type RunTarget } from '@/lib/run/geo';

/** "5 კმ" / "10 000 ნაბიჯი". */
export function targetLabel(target: RunTarget | null | undefined): string {
  if (!target) return '';
  return target.kind === 'km' ? `${target.value} ${ka.run.km}` : `${formatThousands(target.value)} ${ka.run.steps}`;
}

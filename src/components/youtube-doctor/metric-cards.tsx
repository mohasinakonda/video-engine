'use client';

import type { MetricValue } from '@/lib/youtube/types';
import { METRIC_INFO } from './format';

/** Key numbers. A change is shown only when the period before is a fair comparison. */
export function MetricCards({ metrics, previousLabel }: { metrics: MetricValue[]; previousLabel: string }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {metrics.map((metric) => {
        const info = METRIC_INFO[metric.key];
        const change = metric.changePct;
        return (
          <div key={metric.key} className="p-4 rounded-xl bg-bg-surface border border-bg-border space-y-1" title={info.help}>
            <p className="text-sm text-zinc-400">{info.label}</p>
            {metric.value === null ? (
              <p className="text-base text-zinc-500 font-medium">Not available yet</p>
            ) : (
              <p className="text-2xl font-bold text-white tabular-nums">{info.format(metric.value)}</p>
            )}
            {change !== null ? (
              <p className={`text-sm font-medium tabular-nums ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(0)}% vs {previousLabel}
              </p>
            ) : (
              <p className="text-xs text-zinc-500 leading-snug">{metric.value === null ? metric.note : info.help}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

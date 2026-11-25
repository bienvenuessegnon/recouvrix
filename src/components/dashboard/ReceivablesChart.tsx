import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { EmptyState } from '../ui';
import { formatCurrency, formatDate } from '../../design-system/formatters';
import type { EvolutionPoint } from '../../types/dashboard';

export interface ReceivablesChartProps {
  data: EvolutionPoint[];
}

function formatAxisCompact(value: number): string {
  if (value === 0) return '0';
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)} M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)} k`;
  }
  return String(Math.round(value));
}

export const ReceivablesChart: React.FC<ReceivablesChartProps> = ({ data }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="w-5 h-5" aria-hidden="true" />}
        title="Aucune donnée d’évolution disponible"
        description="La courbe d’évolution des créances apparaîtra dès que des factures seront enregistrées dans Recouvrix."
      />
    );
  }

  const maxVal = Math.max(
    1,
    ...data.flatMap((d) => [d.openAmount, d.recoveredAmount, d.overdueAmount])
  );
  // Arrondi propre du plafond de l'axe Y
  const yMax = Math.ceil(maxVal * 1.12);

  const width = 680;
  const height = 220;
  const padLeft = 52;
  const padRight = 18;
  const padTop = 16;
  const padBottom = 30;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const getX = (index: number) => {
    if (data.length === 1) return padLeft + innerW / 2;
    return padLeft + (index / (data.length - 1)) * innerW;
  };

  const getY = (value: number) => {
    return padTop + innerH - (value / yMax) * innerH;
  };

  const buildPolyline = (getter: (point: EvolutionPoint) => number) =>
    data.map((point, idx) => `${getX(idx)},${getY(getter(point))}`).join(' ');

  const activeIdx =
    selectedIndex !== null && selectedIndex < data.length
      ? selectedIndex
      : data.length - 1;
  const activePoint = data[activeIdx];

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(yMax * ratio));

  return (
    <div className="space-y-4">
      {/* Détail du point sélectionné + légende claire */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-md px-4 py-2.5">
        <span className="text-[12px] font-medium text-[var(--color-ink-muted)] tabular-amount">
          Situation au {formatDate(activePoint.date)}
        </span>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px]">
          <div className="inline-flex items-center gap-2">
            <span className="w-3 h-0.5 bg-[var(--color-primary)] inline-block" aria-hidden="true" />
            <span className="text-[var(--color-ink-secondary)]">Ouvertes :</span>
            <span className="font-semibold tabular-amount text-[var(--color-ink)]">
              {formatCurrency(activePoint.openAmount)}
            </span>
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="w-3 h-0.5 bg-[var(--color-success)] inline-block" aria-hidden="true" />
            <span className="text-[var(--color-ink-secondary)]">Recouvrées :</span>
            <span className="font-semibold tabular-amount text-[var(--color-success)]">
              {formatCurrency(activePoint.recoveredAmount)}
            </span>
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="w-3 h-0.5 bg-[var(--color-overdue)] inline-block" aria-hidden="true" />
            <span className="text-[var(--color-ink-secondary)]">En retard :</span>
            <span className="font-semibold tabular-amount text-[var(--color-overdue)]">
              {formatCurrency(activePoint.overdueAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Graphique SVG sobre */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[460px] h-auto select-none"
          role="img"
          aria-label="Évolution des créances ouvertes, recouvrées et en retard"
        >
          {/* Grille horizontale et valeurs Y */}
          {yTicks.map((tickVal, idx) => {
            const y = getY(tickVal);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-[#64748B] text-[10px] font-mono"
                >
                  {formatAxisCompact(tickVal)}
                </text>
              </g>
            );
          })}

          {/* Repère vertical du point sélectionné */}
          <line
            x1={getX(activeIdx)}
            y1={padTop}
            x2={getX(activeIdx)}
            y2={height - padBottom}
            stroke="#CBD5E1"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Courbes */}
          <polyline
            fill="none"
            stroke="#1D4ED8"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={buildPolyline((p) => p.openAmount)}
          />
          <polyline
            fill="none"
            stroke="#15803D"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={buildPolyline((p) => p.recoveredAmount)}
          />
          <polyline
            fill="none"
            stroke="#C2410C"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={buildPolyline((p) => p.overdueAmount)}
          />

          {/* Points interactifs et étiquettes de dates */}
          {data.map((point, idx) => {
            const cx = getX(idx);
            const isSelected = idx === activeIdx;
            const showLabel =
              data.length <= 8 || idx === 0 || idx === data.length - 1 || idx % 2 === 0;

            return (
              <g key={point.date}>
                <circle
                  cx={cx}
                  cy={getY(point.openAmount)}
                  r={isSelected ? 4.5 : 2.8}
                  fill="#1D4ED8"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
                <circle
                  cx={cx}
                  cy={getY(point.recoveredAmount)}
                  r={isSelected ? 4.5 : 2.8}
                  fill="#15803D"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
                <circle
                  cx={cx}
                  cy={getY(point.overdueAmount)}
                  r={isSelected ? 4.5 : 2.8}
                  fill="#C2410C"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />

                {showLabel && (
                  <text
                    x={cx}
                    y={height - 8}
                    textAnchor="middle"
                    className={`text-[10px] font-mono ${
                      isSelected ? 'fill-[#0F172A] font-semibold' : 'fill-[#64748B]'
                    }`}
                  >
                    {point.label}
                  </text>
                )}

                {/* Zone cliquable / survolable étendue */}
                <rect
                  x={cx - 18}
                  y={padTop}
                  width={36}
                  height={innerH}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => setSelectedIndex(idx)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

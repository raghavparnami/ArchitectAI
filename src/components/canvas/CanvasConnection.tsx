'use client';
import { memo, useMemo } from 'react';
import { DiagramConnection, DiagramNode } from '@/lib/types';
import { autoPorts, bezierPath, portPosition } from '@/lib/canvas-utils';

interface CanvasConnectionProps {
  connection: DiagramConnection;
  fromNode: DiagramNode;
  toNode: DiagramNode;
  selected?: boolean;
  onClick?: (id: string) => void;
}

function CanvasConnectionImpl({
  connection,
  fromNode,
  toNode,
  selected,
  onClick,
}: CanvasConnectionProps) {
  const { d, mid, color } = useMemo(() => {
    const ports = autoPorts(fromNode, toNode);
    const from = portPosition(fromNode, ports.fromPort);
    const to = portPosition(toNode, ports.toPort);
    return {
      d: bezierPath(from, to, ports.fromPort, ports.toPort),
      mid: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
      color: selected ? '#C7521B' : '#3F3A33',
    };
  }, [
    fromNode.x, fromNode.y, fromNode.width, fromNode.height,
    toNode.x, toNode.y, toNode.width, toNode.height,
    selected,
  ]);

  const styleMode = connection.style ?? 'solid';
  // Only dashed/dotted modes get a stroke-dasharray; solid stays solid.
  const explicitDash =
    styleMode === 'dashed' ? '6 4'
    : styleMode === 'dotted' ? '1 5'
    : undefined;

  // Selected lines pop with the accent color; resting lines are a softer
  // warm-charcoal that reads well on the paper background without
  // overpowering the cards.
  const restColor = '#5A5249';
  const lineColor = selected ? '#C7521B' : restColor;
  const baseStrokeWidth = selected ? 2.25 : 1.5;
  const label = connection.label?.trim();

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(connection.id);
      }}
      style={{ cursor: onClick ? 'pointer' : undefined }}
    >
      {/* invisible thick hit area */}
      <path d={d} stroke="transparent" strokeWidth={16} fill="none" />
      {/* main line — solid for default style; dashed/dotted only when the
          connection has an explicit non-solid style set in properties. */}
      <path
        d={d}
        stroke={lineColor}
        strokeWidth={baseStrokeWidth}
        strokeDasharray={explicitDash}
        strokeLinecap="round"
        fill="none"
        markerEnd={selected ? 'url(#arrowhead-strong-selected)' : 'url(#arrowhead-strong)'}
      />
      {label && label.length > 0 && (
        <g transform={`translate(${mid.x}, ${mid.y})`}>
          <rect
            x={-(label.length * 2.8 + 6)}
            y={-8}
            width={label.length * 5.6 + 12}
            height={16}
            rx={8}
            fill="#FFFFFF"
            stroke="#E5E1D6"
            strokeWidth={1}
            // Soft shadow so the pill sits visually above any line it crosses
            style={{ filter: 'drop-shadow(0 1px 2px rgba(15,17,16,0.06))' }}
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={9}
            fontFamily="ui-monospace, 'SF Mono', monospace"
            fontWeight={600}
            fill="#3F3A33"
            letterSpacing="0.02em"
          >
            {label.length > 18 ? label.slice(0, 17) + '…' : label}
          </text>
        </g>
      )}
    </g>
  );
}

export const CanvasConnection = memo(CanvasConnectionImpl);

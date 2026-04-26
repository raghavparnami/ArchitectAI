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
  const explicitDash =
    styleMode === 'dashed' ? '8 4'
    : styleMode === 'dotted' ? '1 5'
    : undefined;

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
      {/* base faint solid line behind the moving dashes (so direction is visible at rest) */}
      {styleMode === 'solid' && (
        <path
          d={d}
          stroke={color}
          strokeOpacity={0.18}
          strokeWidth={selected ? 2.5 : 1.75}
          strokeLinecap="round"
          fill="none"
        />
      )}
      {/* main line */}
      <path
        d={d}
        stroke={color}
        strokeWidth={selected ? 2.5 : 1.75}
        strokeDasharray={explicitDash ?? '8 4'}
        strokeLinecap={styleMode === 'dotted' ? 'round' : 'round'}
        fill="none"
        markerEnd={selected ? 'url(#arrowhead-strong-selected)' : 'url(#arrowhead-strong)'}
        className={styleMode === 'solid' ? 'flow-line' : undefined}
      />
      {connection.label && (
        <g transform={`translate(${mid.x}, ${mid.y})`}>
          <rect
            x={-(connection.label.length * 2.6 + 5)}
            y={-7}
            width={connection.label.length * 5.2 + 10}
            height={14}
            rx={7}
            fill="#FBFAF6"
            stroke="#E5E1D6"
            strokeWidth={1}
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={9}
            fontFamily="ui-monospace, monospace"
            fontWeight={600}
            fill="#3F3A33"
          >
            {connection.label.length > 18
              ? connection.label.slice(0, 17) + '…'
              : connection.label}
          </text>
        </g>
      )}
    </g>
  );
}

export const CanvasConnection = memo(CanvasConnectionImpl);

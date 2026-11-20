"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Datum = { label: string; value: number };

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };

function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: { value: number }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">
        {payload[0]!.value} {unit}
      </p>
    </div>
  );
}

/** Horizontal bars: one hue (magnitude), category names on the axis. */
export function HorizontalBars({ data, unit, color = "var(--chart-1)" }: { data: Datum[]; unit: string; color?: string }) {
  if (data.every((d) => d.value === 0)) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Nessun dato da visualizzare.</p>;
  }
  return (
    <div style={{ height: Math.max(140, data.length * 30 + 20) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }} barCategoryGap={4}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={170} tick={axis} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<ChartTooltip unit={unit} />} />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ActivityArea({ data }: { data: Datum[] }) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="activityFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} interval={6} />
          <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: 3 }} content={<ChartTooltip unit="operazioni" />} />
          <Area type="monotone" dataKey="value" stroke="var(--chart-2)" strokeWidth={2} fill="url(#activityFill)" activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

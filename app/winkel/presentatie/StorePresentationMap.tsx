"use client";

import { HEYENDAAL_TOUCHPOINTS } from "./presentationData";

type Props = {
  activeIds?: readonly string[];
  completedIds?: readonly string[];
  selectedId?: string;
  onSelect?: (touchpointId: string) => void;
  compact?: boolean;
};

const priorityColors = {
  A: { fill: "#f8dd75", stroke: "#9a6c00" },
  B: { fill: "#cfe1c9", stroke: "#315e42" },
  C: { fill: "#e6e0d9", stroke: "#75685f" },
};

function Furniture({
  x,
  y,
  width,
  height,
  label,
}: Readonly<{ x: number; y: number; width: number; height: number; label: string }>) {
  return (
    <g aria-hidden="true">
      <rect x={x} y={y} width={width} height={height} rx="7" fill="#f6f2ec" stroke="#c8beb4" strokeWidth="2" />
      <text
        x={x + width / 2}
        y={y + height / 2 + 4}
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="#897b72"
      >
        {label}
      </text>
    </g>
  );
}

export default function StorePresentationMap({
  activeIds = [],
  completedIds = [],
  selectedId = "",
  onSelect,
  compact = false,
}: Readonly<Props>) {
  const active = new Set(activeIds);
  const completed = new Set(completedIds);

  return (
    <div className="overflow-hidden rounded-[1.4rem] border border-[#d9d0c7] bg-[#fffdf8] p-2 shadow-sm sm:p-3">
      <svg
        viewBox="0 0 1000 485"
        role="img"
        aria-label="Interactieve plattegrond van winkel Heyendaalseweg"
        className={`block h-auto w-full ${compact ? "max-h-[30rem]" : "max-h-[42rem]"}`}
      >
        <defs>
          <filter id="active-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#5c3d13" floodOpacity="0.22" />
          </filter>
          <marker id="route-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#a8899b" />
          </marker>
        </defs>

        <rect x="10" y="10" width="980" height="455" rx="18" fill="#fff" stroke="#463a34" strokeWidth="4" />

        <Furniture x={22} y={110} width={56} height={192} label="brood" />
        <Furniture x={80} y={360} width={72} height={92} label="kassa" />
        <Furniture x={155} y={210} width={105} height={242} label="toonbank" />
        <Furniture x={272} y={135} width={66} height={58} label="kassa" />

        <path
          d="M 790 445 L 810 245 Q 810 222 780 222 L 320 250 L 320 405 Q 320 435 360 445"
          fill="none"
          stroke="#a8899b"
          strokeWidth="4"
          strokeDasharray="10 10"
          markerEnd="url(#route-arrow)"
          opacity="0.55"
          aria-hidden="true"
        />

        <rect x="680" y="445" width="115" height="28" rx="6" fill="#eaf1e7" stroke="#315e42" strokeWidth="2" />
        <text x="737" y="463" textAnchor="middle" fontSize="12" fontWeight="900" fill="#315e42">INGANG</text>
        <rect x="305" y="445" width="115" height="28" rx="6" fill="#f3ece6" stroke="#75685f" strokeWidth="2" />
        <text x="362" y="463" textAnchor="middle" fontSize="12" fontWeight="900" fill="#75685f">UITGANG</text>

        <g aria-label="Deur naar de bakkerij">
          <rect x="205" y="8" width="125" height="20" fill="#fff" />
          <path d="M 205 10 L 205 85 M 205 85 Q 280 85 280 10" fill="none" stroke="#75685f" strokeWidth="2" />
          <text x="270" y="105" textAnchor="middle" fontSize="11" fontWeight="700" fill="#75685f">Deur bakkerij</text>
        </g>

        {HEYENDAAL_TOUCHPOINTS.map((touchpoint) => {
          const isActive = active.has(touchpoint.id);
          const isCompleted = completed.has(touchpoint.id);
          const isSelected = selectedId === touchpoint.id;
          const colors = priorityColors[touchpoint.priority];
          const { x, y, width, height } = touchpoint.map;
          const badgeX = touchpoint.id === "koekmeubel" ? x + 48 : x + 17;
          const fill = isCompleted ? "#76a780" : isActive ? "#ffd84b" : colors.fill;
          const stroke = isSelected ? "#ef5737" : isActive ? "#61450a" : colors.stroke;

          return (
            <g
              key={touchpoint.id}
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={`${touchpoint.code} ${touchpoint.label}${isActive ? ", ingepland" : ""}${isCompleted ? ", geplaatst" : ""}`}
              onClick={() => onSelect?.(touchpoint.id)}
              onKeyDown={(event) => {
                if (!onSelect || (event.key !== "Enter" && event.key !== " ")) return;
                event.preventDefault();
                onSelect(touchpoint.id);
              }}
              className={onSelect ? "cursor-pointer outline-none" : undefined}
              filter={isActive || isSelected ? "url(#active-shadow)" : undefined}
            >
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                rx="7"
                fill={fill}
                fillOpacity={isActive || isCompleted ? 0.96 : 0.68}
                stroke={stroke}
                strokeWidth={isSelected ? 6 : isActive ? 4 : 2}
                strokeDasharray={touchpoint.movable ? "6 4" : undefined}
              />
              <circle cx={badgeX} cy={y + 17} r="12" fill={isActive || isCompleted ? "#49342d" : "#fff"} stroke={stroke} strokeWidth="2" />
              <text x={badgeX} y={y + 21} textAnchor="middle" fontSize="10" fontWeight="900" fill={isActive || isCompleted ? "#fff" : stroke}>
                {isCompleted ? "✓" : touchpoint.code}
              </text>
              {width > 100 ? (
                <text
                  x={x + width / 2}
                  y={y + height / 2 + 4}
                  textAnchor="middle"
                  fontSize={width > 220 ? 13 : 11}
                  fontWeight="900"
                  fill="#49342d"
                >
                  {touchpoint.shortLabel}
                </text>
              ) : null}
              {touchpoint.movable ? (
                <text x={x + width / 2} y={y + height - 9} textAnchor="middle" fontSize="9" fontWeight="700" fill="#75685f">verrijdbaar · optioneel</text>
              ) : null}
            </g>
          );
        })}
        <g aria-label="Grote pilaar midden in het koekmeubel">
          <rect x="490" y="290" width="60" height="68" rx="3" fill="#b8afa5" stroke="#463a34" strokeWidth="3" />
          <text x="520" y="328" textAnchor="middle" fontSize="11" fontWeight="900" fill="#463a34">PILAAR</text>
        </g>
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 px-2 pb-1 text-[0.68rem] font-bold text-[#6f625b]">
        <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm border border-[#9a6c00] bg-[#f8dd75]" /> A-locatie</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm border border-[#315e42] bg-[#cfe1c9]" /> B-locatie</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm border border-[#61450a] bg-[#ffd84b]" /> Deze week</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm border border-[#315e42] bg-[#76a780]" /> Geplaatst</span>
      </div>
    </div>
  );
}

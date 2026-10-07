/**
 * Coach's-board diagram for the drill briefing card: a top-down attacking
 * third with the drill's cones, runs and ball paths. Pure SVG, no ids, so it
 * costs nothing on low-end phones.
 */
const LINE = 'rgba(234,245,234,.75)'
const BALL = '#fff'
const CONE = '#ff8a3d'
const RUN = '#ffc83d'
const PASS = '#3da5ff'
const YOU = '#1fd47a'

function Player({ x, y, c = YOU }: { x: number; y: number; c?: string }) {
  return <g><circle cx={x} cy={y} r="6" fill={c} stroke="#04140b" stroke-width="1.5" /></g>
}
function Cone({ x, y }: { x: number; y: number }) {
  return <path d={`M${x} ${y - 5}L${x + 4} ${y + 3}H${x - 4}Z`} fill={CONE} />
}
function Ball({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r="3.2" fill={BALL} stroke="#0b1220" stroke-width="1" />
}
const dash = { fill: 'none', 'stroke-width': 2, 'stroke-dasharray': '5 4', 'stroke-linecap': 'round' } as const

function Body({ kind, setPiece }: { kind: string; setPiece: boolean }) {
  if (setPiece) {
    return (
      <>
        {[86, 96, 106, 116].map((x) => <Player key={x} x={x} y={74} c="#ff4d5e" />)}
        <Player x={110} y={112} />
        <Ball x={104} y={104} />
        <path d="M104 104C70 70 120 40 120 30" stroke={RUN} {...dash} />
      </>
    )
  }
  switch (kind) {
    case 'passing':
      return (
        <>
          <Player x={50} y={104} /><Player x={110} y={80} c="#b4c0d6" /><Player x={160} y={104} c="#b4c0d6" />
          <Cone x={78} y={92} /><Cone x={86} y={98} /><Cone x={132} y={92} /><Cone x={140} y={98} />
          <path d="M56 100L104 82M116 84L154 100" stroke={PASS} {...dash} />
          <Ball x={62} y={98} />
        </>
      )
    case 'dribbling':
      return (
        <>
          {[60, 84, 108, 132, 156].map((x, i) => <Cone key={x} x={x} y={i % 2 ? 84 : 100} />)}
          <path d="M36 92C48 70 54 112 72 92S96 70 108 92 132 112 144 92 168 70 178 90" stroke={RUN} {...dash} />
          <Player x={34} y={96} /><Ball x={42} y={98} />
        </>
      )
    case 'crossing':
      return (
        <>
          <Player x={188} y={92} /><Ball x={182} y={86} />
          <path d="M182 86C160 40 120 40 108 52" stroke={RUN} {...dash} />
          <Player x={106} y={58} c="#b4c0d6" />
          <circle cx="108" cy="52" r="12" fill="none" stroke={RUN} stroke-opacity=".5" />
        </>
      )
    case 'heading':
      return (
        <>
          <path d="M30 110C60 30 100 40 108 48" stroke={PASS} {...dash} />
          <Player x={110} y={54} /><Ball x={108} y={46} />
          <path d="M108 46L96 22" stroke={RUN} {...dash} />
        </>
      )
    case 'goalkeeping':
      return (
        <>
          <Player x={110} y={24} c="#ffc83d" />
          <path d="M110 24h-22M110 24h22" stroke="#ffc83d" stroke-width="2" stroke-linecap="round" opacity=".6" />
          <Ball x={84} y={96} /><Ball x={136} y={100} />
          <path d="M84 96L96 20M136 100L126 18" stroke="#ff4d5e" {...dash} />
        </>
      )
    case 'tackling':
      return (
        <>
          <Player x={110} y={64} c="#ff4d5e" /><Ball x={116} y={70} />
          <path d="M150 104C140 90 130 80 118 72" stroke={RUN} {...dash} />
          <Player x={152} y={106} />
          <Cone x={70} y={60} /><Cone x={150} y={60} />
        </>
      )
    case 'fitness':
      return (
        <>
          {[40, 80, 120, 160].map((x) => <Cone key={x} x={x} y={100} />)}
          {[40, 80, 120, 160].map((x) => <Cone key={x + 1} x={x} y={64} />)}
          <path d="M40 100V64H80V100H120V64H160V100" stroke={RUN} {...dash} />
          <Player x={40} y={108} />
        </>
      )
    default: // finishing
      return (
        <>
          <rect x="82" y="10" width="12" height="10" fill="none" stroke={RUN} stroke-width="2" />
          <rect x="126" y="10" width="12" height="10" fill="none" stroke={RUN} stroke-width="2" />
          <path d="M110 92C100 60 92 40 88 18" stroke={RUN} {...dash} />
          <Player x={110} y={100} /><Ball x={110} y={92} />
          <Player x={110} y={22} c="#b4c0d6" />
        </>
      )
  }
}

export function DrillDiagram({ kind, setPiece = false }: { kind: string; setPiece?: boolean }) {
  return (
    <svg class="trn-diagram" viewBox="0 0 220 124" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="220" height="124" rx="10" fill="#1d6b35" />
      {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x="0" y={i * 22 - 8} width="220" height="11" fill="#237a3e" opacity=".55" />)}
      <g fill="none" stroke={LINE} stroke-width="1.5">
        <path d="M6 6H214V118H6Z" />
        <path d="M60 6V48H160V6M86 6V20H134V6" />
        <path d="M88 48A24 24 0 0 0 132 48" />
      </g>
      <path d="M96 6V1H124V6" fill="none" stroke="#fff" stroke-width="2.5" />
      <Body kind={kind} setPiece={setPiece} />
    </svg>
  )
}

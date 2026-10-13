import Svg, { Circle, Path, Rect } from 'react-native-svg';

// Proste ikony liniowe 24x24, rysowane kolorem `color`.
const P = {
  tag: (p) => (<><Path d="M3 8.5 8.5 3H21v18H8.5L3 15.5z" {...p} /><Circle cx={8.5} cy={12} r={1.6} {...p} /></>),
  search: (p) => (<><Circle cx={10.5} cy={10.5} r={6.5} {...p} /><Path d="m15.5 15.5 5 5" {...p} /></>),
  star: (p) => <Path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" {...p} />,
  user: (p) => (<><Circle cx={12} cy={8} r={4} {...p} /><Path d="M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6" {...p} /></>),
  bell: (p) => (<><Path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" {...p} /><Path d="M10 20a2 2 0 0 0 4 0" {...p} /></>),
  clock: (p) => (<><Circle cx={12} cy={12} r={8.5} {...p} /><Path d="M12 7.5V12l3 2" {...p} /></>),
  back: (p) => <Path d="m15 5-7 7 7 7" {...p} />,
  text: (p) => <Path d="M5 6h14M5 12h14M5 18h9" {...p} />,
  coding: (p) => <Path d="m8 7-5 5 5 5M16 7l5 5-5 5" {...p} />,
  image: (p) => (<><Rect x={3.5} y={5} width={17} height={14} rx={2} {...p} /><Circle cx={9} cy={10} r={1.8} {...p} /><Path d="m4 18 5.5-5 4 3.5 2.5-2 4 3.5" {...p} /></>),
  video: (p) => (<><Rect x={3} y={6} width={13} height={12} rx={2} {...p} /><Path d="m16 10 5-3v10l-5-3z" {...p} /></>),
  all: (p) => (<><Rect x={4} y={4} width={6.5} height={6.5} rx={1.5} {...p} /><Rect x={13.5} y={4} width={6.5} height={6.5} rx={1.5} {...p} /><Rect x={4} y={13.5} width={6.5} height={6.5} rx={1.5} {...p} /><Rect x={13.5} y={13.5} width={6.5} height={6.5} rx={1.5} {...p} /></>),
  warn: (p) => (<><Path d="M12 4 2.5 20h19z" {...p} /><Path d="M12 10v4.5M12 17.2v.3" {...p} /></>),
  check: (p) => <Path d="m5 12.5 4.5 4.5L19 7.5" {...p} />,
  trophy: (p) => (<><Path d="M8 4h8v5a4 4 0 0 1-8 0z" {...p} /><Path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7" {...p} /></>),
  external: (p) => (<><Path d="M14 4h6v6M20 4l-9 9" {...p} /><Path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" {...p} /></>),
  sun: (p) => (<><Circle cx={12} cy={12} r={4} {...p} /><Path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" {...p} /></>),
  moon: (p) => <Path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" {...p} />,
  phone: (p) => (<><Rect x={6.5} y={2.5} width={11} height={19} rx={2.5} {...p} /><Path d="M11 18.5h2" {...p} /></>),
  close: (p) => <Path d="M6 6l12 12M18 6 6 18" {...p} />,
  plus: (p) => <Path d="M12 5v14M5 12h14" {...p} />,
  spark: (p) => <Path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" {...p} />,
};

export default function Icon({ name, size = 22, color = '#000', width = 2, fill = 'none' }) {
  const draw = P[name];
  if (!draw) return null;
  const p = { stroke: color, strokeWidth: width, fill, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {draw(p)}
    </Svg>
  );
}

// Znak LightTokenz: 4 kwadraty w kolorach kategorii.
export function Logo({ size = 32, colors }) {
  const c = colors ?? ['#3d63ff', '#8b3dff', '#ff4f8b', '#ff8a00'];
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect x={2} y={2} width={13} height={13} rx={4} fill={c[0]} />
      <Rect x={17} y={2} width={13} height={13} rx={4} fill={c[1]} />
      <Rect x={2} y={17} width={13} height={13} rx={4} fill={c[2]} />
      <Rect x={17} y={17} width={13} height={13} rx={4} fill={c[3]} />
    </Svg>
  );
}

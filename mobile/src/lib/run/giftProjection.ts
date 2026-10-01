/**
 * Where a gift lying on the ground appears in the portrait back camera (MEDIRUN, Pokémon GO style, no AR kit):
 * the gift sits `east`/`north` metres away; the phone faces `heading` (compass, degrees) with `pitch` = device beta
 * (90° upright, smaller when the camera looks down). Returns screen pixels for the box's centre-bottom and its size.
 */
export const GIFT_VIEW = { hFov: 56, vFov: 72, eye: 1.3, box: 1.1 };
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
export const wrapDeg = (a: number) => (((a % 360) + 540) % 360) - 180;

export function projectGift(at: { east: number; north: number }, heading: number, pitch: number, width: number, height: number) {
  const { hFov, vFov, eye, box } = GIFT_VIEW;
  const dist = Math.max(2.5, Math.hypot(at.east, at.north));
  const rel = wrapDeg(deg(Math.atan2(at.east, at.north)) - heading);        // + = to the right of where the camera looks
  const up = -deg(Math.atan(eye / dist)) - (pitch - 90);                    // degrees above the camera's axis
  const clampDeg = (a: number) => Math.max(-80, Math.min(80, a));
  const x = width / 2 + (Math.tan(rad(clampDeg(rel))) / Math.tan(rad(hFov / 2))) * (width / 2);
  const y = height / 2 - (Math.tan(rad(clampDeg(up))) / Math.tan(rad(vFov / 2))) * (height / 2);
  const size = Math.max(70, Math.min(320, (box / dist / Math.tan(rad(vFov / 2))) * (height / 2)));
  const visible = Math.abs(rel) < hFov / 2 + 4 && y > -size * 0.2 && y < height + size * 0.2;
  return { x, y, size, dist, rel, visible, side: visible ? null : rel < 0 ? ('left' as const) : ('right' as const) };
}

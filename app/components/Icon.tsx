import type { SVGProps } from "react";

const paths = {
  route: "M4 18c0-6 16-6 16-12M7 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0M23 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  up: "m3 18 6-6 4 3 8-11M14 4h7v7",
  down: "m3 6 6 6 4-3 8 11M14 20h7v-7",
  mountain: "m2 20 8-15 5 8 3-5 5 12H2m5-9 3 3 3-3",
  clock: "M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  speed: "M4 19a10 10 0 1 1 16 0M12 13l5-6M8 19h8",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  close: "m6 6 12 12M6 18 18 6",
  settings: "M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6M9 15v6",
  camera: "M3 7h4l2-3h6l2 3h4v14H3V7m13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  pin: "M12 22s8-9 8-14A8 8 0 0 0 4 8c0 5 8 14 8 14m3-14a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  check: "m4 12 5 5L20 6",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M3 22v-3a9 9 0 0 1 18 0v3",
  info: "M12 11v6m0-10v.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  cube: "m12 2 10 5v10l-10 5-10-5V7l10-5m0 10v10M2 7l10 5 10-5",
};
export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: keyof typeof paths }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }} {...props}><path d={paths[name]} /></svg>;
}

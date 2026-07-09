// SVG path data parser: extracts bezier anchor points and control handles
// so the construction-grid scene can visualize the drawing skeleton.

export type Pt = { x: number; y: number };
export type Handle = { a: Pt; c: Pt };
export type PathSkeleton = { anchors: Pt[]; handles: Handle[] };

const PARAM_COUNTS: Record<string, number> = {
  M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0,
};

export function parsePathD(d: string): PathSkeleton {
  const anchors: Pt[] = [];
  const handles: Handle[] = [];
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens) return { anchors, handles };

  let i = 0;
  let cmd = "";
  let cur: Pt = { x: 0, y: 0 };
  let start: Pt = { x: 0, y: 0 };
  let prevCubicCtrl: Pt | null = null;
  let prevQuadCtrl: Pt | null = null;

  const read = () => parseFloat(tokens[i++]);

  while (i < tokens.length) {
    const t = tokens[i];
    if (/[A-Za-z]/.test(t)) {
      cmd = t;
      i++;
      if (cmd.toUpperCase() === "Z") {
        cur = { ...start };
        prevCubicCtrl = null;
        prevQuadCtrl = null;
        continue;
      }
    } else if (cmd.toUpperCase() === "M") {
      // Implicit lineto after moveto
      cmd = cmd === "M" ? "L" : "l";
    }

    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (!(C in PARAM_COUNTS)) break;
    const need = PARAM_COUNTS[C];
    if (i + need > tokens.length) break;

    const dx = rel ? cur.x : 0;
    const dy = rel ? cur.y : 0;

    switch (C) {
      case "M": {
        cur = { x: read() + dx, y: read() + dy };
        start = { ...cur };
        anchors.push(cur);
        prevCubicCtrl = prevQuadCtrl = null;
        break;
      }
      case "L": {
        cur = { x: read() + dx, y: read() + dy };
        anchors.push(cur);
        prevCubicCtrl = prevQuadCtrl = null;
        break;
      }
      case "H": {
        cur = { x: read() + dx, y: cur.y };
        anchors.push(cur);
        prevCubicCtrl = prevQuadCtrl = null;
        break;
      }
      case "V": {
        cur = { x: cur.x, y: read() + dy };
        anchors.push(cur);
        prevCubicCtrl = prevQuadCtrl = null;
        break;
      }
      case "C": {
        const c1 = { x: read() + dx, y: read() + dy };
        const c2 = { x: read() + dx, y: read() + dy };
        const end = { x: read() + dx, y: read() + dy };
        handles.push({ a: cur, c: c1 }, { a: end, c: c2 });
        anchors.push(end);
        cur = end;
        prevCubicCtrl = c2;
        prevQuadCtrl = null;
        break;
      }
      case "S": {
        const c1: Pt = prevCubicCtrl
          ? { x: 2 * cur.x - prevCubicCtrl.x, y: 2 * cur.y - prevCubicCtrl.y }
          : { ...cur };
        const c2 = { x: read() + dx, y: read() + dy };
        const end = { x: read() + dx, y: read() + dy };
        handles.push({ a: cur, c: c1 }, { a: end, c: c2 });
        anchors.push(end);
        cur = end;
        prevCubicCtrl = c2;
        prevQuadCtrl = null;
        break;
      }
      case "Q": {
        const c = { x: read() + dx, y: read() + dy };
        const end = { x: read() + dx, y: read() + dy };
        handles.push({ a: cur, c }, { a: end, c });
        anchors.push(end);
        cur = end;
        prevQuadCtrl = c;
        prevCubicCtrl = null;
        break;
      }
      case "T": {
        const c: Pt = prevQuadCtrl
          ? { x: 2 * cur.x - prevQuadCtrl.x, y: 2 * cur.y - prevQuadCtrl.y }
          : { ...cur };
        const end = { x: read() + dx, y: read() + dy };
        handles.push({ a: cur, c }, { a: end, c });
        anchors.push(end);
        cur = end;
        prevQuadCtrl = c;
        prevCubicCtrl = null;
        break;
      }
      case "A": {
        read(); read(); read(); read(); read(); // rx ry rot large-arc sweep
        const end = { x: read() + dx, y: read() + dy };
        anchors.push(end);
        cur = end;
        prevCubicCtrl = prevQuadCtrl = null;
        break;
      }
    }
  }
  return { anchors, handles };
}

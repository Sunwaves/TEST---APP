export interface Positioned<T> {
  item: T;
  lane: number; // 0-based column within its overlap group
  lanes: number; // total columns in its overlap group
}

/**
 * Assigns side-by-side columns to overlapping events, like a calendar day view.
 * Events that overlap (directly or through a chain) share a group and split its width.
 */
export function layoutLanes<T>(items: T[], start: (t: T) => number, end: (t: T) => number): Positioned<T>[] {
  const sorted = [...items].sort((a, b) => start(a) - start(b) || end(b) - end(a));
  const result: Positioned<T>[] = [];
  let group: Positioned<T>[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;

  const flush = () => {
    for (const p of group) p.lanes = laneEnds.length;
    result.push(...group);
    group = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (start(item) >= groupEnd) flush();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start(item));
    if (lane === -1) lane = laneEnds.push(0) - 1;
    laneEnds[lane] = end(item);
    groupEnd = Math.max(groupEnd, end(item));
    group.push({ item, lane, lanes: 0 });
  }
  flush();
  return result;
}

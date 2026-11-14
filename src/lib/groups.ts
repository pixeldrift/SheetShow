import type { DesignItem } from "../types";
import { uid } from "./data";

/** Items that belong to the same group as `item` (just the item itself when it isn't grouped). */
export const membersOf = (list: DesignItem[], item: DesignItem): DesignItem[] =>
  item.groupId ? list.filter((i) => i.groupId === item.groupId) : [item];

/** Adds every member of any group that one of the ids belongs to. */
export function expandToGroups(list: DesignItem[], ids: string[]): string[] {
  const groups = new Set(list.filter((i) => ids.includes(i.id) && i.groupId).map((i) => i.groupId));
  return list.filter((i) => ids.includes(i.id) || (i.groupId && groups.has(i.groupId))).map((i) => i.id);
}

/** A group needs two members; a lone leftover quietly becomes an ordinary object again. */
export function dissolveSingletons(list: DesignItem[]): DesignItem[] {
  const counts = new Map<string, number>();
  for (const i of list) if (i.groupId) counts.set(i.groupId, (counts.get(i.groupId) ?? 0) + 1);
  return list.map((i) => {
    if (!i.groupId || (counts.get(i.groupId) ?? 0) > 1) return i;
    const { groupId: _g, groupName: _n, ...rest } = i;
    return rest;
  });
}

/**
 * Puts the chosen items in a new group. The members are gathered into one block in the stacking order (at the
 * position of the topmost one) so the group stays together in the layers list. Groups that lose members and
 * end up with one are dissolved.
 */
export function groupItems(list: DesignItem[], ids: string[], name: string): DesignItem[] {
  const chosen = list.filter((i) => ids.includes(i.id));
  if (chosen.length < 2) return list;
  const groupId = uid();
  const top = Math.max(...chosen.map((i) => list.indexOf(i)));
  const before = list.slice(0, top).filter((i) => !ids.includes(i.id));
  const after = list.slice(top + 1).filter((i) => !ids.includes(i.id));
  const block = chosen.map((i) => ({ ...i, groupId, groupName: name }));
  return dissolveSingletons([...before, ...block, ...after]);
}

/** Ungroups every group that any of the ids belongs to. */
export function ungroupItems(list: DesignItem[], ids: string[]): DesignItem[] {
  const groups = new Set(list.filter((i) => ids.includes(i.id) && i.groupId).map((i) => i.groupId));
  if (!groups.size) return list;
  return list.map((i) => {
    if (!i.groupId || !groups.has(i.groupId)) return i;
    const { groupId: _g, groupName: _n, ...rest } = i;
    return rest;
  });
}

export const renameGroup = (list: DesignItem[], groupId: string, name: string) => list.map((i) => (i.groupId === groupId ? { ...i, groupName: name } : i));

/** Next free "Group n" name. */
export const nextGroupName = (list: DesignItem[]) => {
  const used = new Set(list.map((i) => i.groupName));
  for (let n = 1; ; n++) if (!used.has(`Group ${n}`)) return `Group ${n}`;
};

/** Copies with fresh ids; each copied group becomes a new, independent group. */
export function cloneItems(list: DesignItem[], dx: number, dy: number): DesignItem[] {
  const remap = new Map<string, string>();
  return list.map((i) => {
    const copy: DesignItem = { ...i, id: uid(), x: i.x + dx, y: i.y + dy };
    if (i.groupId) { if (!remap.has(i.groupId)) remap.set(i.groupId, uid()); copy.groupId = remap.get(i.groupId); }
    return copy;
  });
}

/** The stacking order as blocks: a group is one block, every other object its own. */
function blocks(list: DesignItem[]): DesignItem[][] {
  const out: DesignItem[][] = [];
  for (const item of list) {
    const last = out[out.length - 1];
    if (item.groupId && last && last[0].groupId === item.groupId) last.push(item);
    else out.push([item]);
  }
  return out;
}

/** Moves an object (or, when `asGroup`, its whole group) one step up (+1) or down (−1) in the stacking order. */
export function moveLayer(list: DesignItem[], id: string, direction: -1 | 1, asGroup: boolean): DesignItem[] {
  const item = list.find((i) => i.id === id);
  if (!item) return list;
  if (item.groupId && !asGroup) {
    // Inside a group an object only reorders among its siblings.
    const index = list.indexOf(item), target = index + direction;
    if (target < 0 || target >= list.length || list[target].groupId !== item.groupId) return list;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  }
  const all = blocks(list);
  const at = all.findIndex((b) => b.some((i) => i.id === id));
  const to = at + direction;
  if (at < 0 || to < 0 || to >= all.length) return list;
  [all[at], all[to]] = [all[to], all[at]];
  return all.flat();
}

export type Unit = { key: string; members: DesignItem[] };
/** The selection as units: each group is one unit, every other object its own. Alignment treats a unit as a single box. */
export function unitsOf(list: DesignItem[], ids: string[]): Unit[] {
  const map = new Map<string, DesignItem[]>();
  for (const item of list) if (ids.includes(item.id)) { const key = item.groupId ?? item.id; map.set(key, [...(map.get(key) ?? []), item]); }
  return [...map].map(([key, members]) => ({ key, members }));
}

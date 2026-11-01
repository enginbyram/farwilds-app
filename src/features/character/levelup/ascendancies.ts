/** Reading the ascendancies a character has taken from the nodes it owns on the tree. */
import type { TreeModel } from "@/features/tree/types";
import type { Rules } from "@/features/rules/types";

export interface TreeAscendancy { node: string; asc: string; note: string; }
/**
 * Ascendancies are chosen on the tree, not on this screen: an ascendancy node owned one ring out from the
 * class start is the first ascendancy, two rings out the second.
 *  - "Barbarian" → Barbarian;  "Fighter II" → Fighter (go deep)
 *  - a combination node ("Bloodrager" = Barbarian + Bloodmagic) → its other root
 *  - a deepening node ("Carnage II") → no new ascendancy; the build stays in the first one
 */
export function ascendanciesFromTree(rules: Rules, model: TreeModel, ids: string[], startRing: number, asc1Hint = "") {
  const nodes = ids.map(id => model.byId.get(id)).filter((n): n is NonNullable<typeof n> => !!n && /ascend/i.test(n.type));
  const resolve = (name: string, first: string): { asc: string; note: string } => {
    const exact = rules.ascendancies.find(a => a.name === name);
    if (exact) return { asc: exact.name, note: "" };
    const base = name.replace(/\s+(I{1,3}|IV|V)$/, "");
    const deep = rules.ascendancies.find(a => a.name === base);
    if (deep) return { asc: deep.name, note: base === first ? "deepens the first ascendancy" : "go deep" };
    const combo = rules.combinations.find(c => c.name === name);
    if (combo) return { asc: combo.rootA === first ? combo.rootB : combo.rootB === first ? combo.rootA : combo.rootB, note: `${combo.name} = ${combo.rootA} + ${combo.rootB}` };
    return { asc: "", note: "deepens the first ascendancy" };
  };
  const at = (ring: number) => nodes.find(n => n.ring === ring);
  const n1 = at(startRing + 1), n2 = at(startRing + 2);
  const first: TreeAscendancy | null = n1 ? { node: n1.name, ...resolve(n1.name, "") } : null;
  const a1 = first?.asc || asc1Hint;
  const second: TreeAscendancy | null = n2 ? { node: n2.name, ...resolve(n2.name, a1) } : null;
  if (second && second.asc === a1) { second.asc = ""; second.note = "deepens the first ascendancy"; }
  return { first, second };
}

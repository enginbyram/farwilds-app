import { APTITUDE_COLOR } from "@/config/settings";
import { isForbidden } from "@/features/tree/model/buildModel";
import type { TreeNode } from "@/features/tree/types";

export const aptitudeColor = (aptitude: string) => `var(${APTITUDE_COLOR[aptitude] ?? "--apt-centre"})`;
export const nodeColor = (n: TreeNode) => (isForbidden(n) ? "var(--forbidden)" : aptitudeColor(n.aptitude));

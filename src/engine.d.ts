/** Preserved legacy demo only. New planning lives in packages/core/src/planning. */
export interface ProjectInputs {
  L: number; W: number; stack: number; layout: string; floor: number;
  budget: number; basement: boolean; vent: boolean; permit: boolean;
}
export function calcProject(v: ProjectInputs, owned?: Record<string, boolean>): {
  v: ProjectInputs; m: Array<Record<string, unknown>>; cost: number;
  groups: Record<string, Array<Record<string, unknown>>>;
  tripsSaved: number; wasteSaved: number; rework: number; totalSave: number; area: number;
};

/**
 * "1 shot" / "3 shots": a count with the right English noun form (PLAN.md#11.2), for every count
 * the UI and the stage labels show. Pure.
 */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${String(count)} ${count === 1 ? singular : pluralForm}`;
}

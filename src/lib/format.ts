/** Indian digit grouping (1,01,222) with an explicit decimal precision. */
export function formatIndian(value: number, maximumFractionDigits = 0): string {
  return value.toLocaleString("en-IN", { maximumFractionDigits });
}

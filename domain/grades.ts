export const V_GRADES = [
  'VB','V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12','V13','V14','V15','V16','V17',
] as const;

export type VGrade = (typeof V_GRADES)[number];
const supported = new Set<string>(V_GRADES);

export function getVGradeIndex(grade: VGrade): number {
  return V_GRADES.indexOf(grade);
}

export function parseVGradeToken(value: string): VGrade | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'VB') return 'VB';
  const match = normalized.match(/^V?(\d{1,2})$/);
  if (!match) return null;
  const grade = `V${Number(match[1])}`;
  return supported.has(grade) ? (grade as VGrade) : null;
}

export function parseVGrade(value: string): { start: VGrade; end: VGrade } | null {
  const normalized = value.trim().toUpperCase().replace(/[–—]/g, '-');
  if (!normalized) return null;
  const parts = normalized.split('-').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 1 || parts.length > 2) return null;
  const start = parseVGradeToken(parts[0]);
  const end = parseVGradeToken(parts[1] ?? parts[0]);
  if (!start || !end || getVGradeIndex(start) > getVGradeIndex(end)) return null;
  return { start, end };
}

export function formatVGrade(start: VGrade, end: VGrade): string {
  return start === end ? start : `${start}–${end}`;
}

export function normalizeVGradeInput(value: string): string | null {
  const parsed = parseVGrade(value);
  return parsed ? formatVGrade(parsed.start, parsed.end) : null;
}

export function isSupportedVGradeValue(value: string): boolean {
  return parseVGrade(value) !== null;
}

export function isValidGradeRange(start: VGrade, end: VGrade): boolean {
  return getVGradeIndex(start) <= getVGradeIndex(end);
}

export function gradeToNumber(value: string): number {
  const parsed = parseVGrade(value);
  return parsed ? getVGradeIndex(parsed.start) - 1 : -999;
}

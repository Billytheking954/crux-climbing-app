import type { RouteDiscipline, RouteResult } from './models';

// French sport grades. Kept separate from the V scale: conversion would be misleading.
export const FRENCH_GRADES: string[] = [
  '3', '3+', '4',
  ...Array.from({ length: 6 }, (_, offset) => offset + 4)
    .flatMap((n) => ['a', 'b', 'c'].flatMap((letter) => [`${n}${letter}`, `${n}${letter}+`])),
];

const knownGrades = new Set(FRENCH_GRADES);

export function normalizeFrenchGrade(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '');
  return knownGrades.has(normalized) ? normalized : null;
}

export function isRouteResultForDiscipline(discipline: RouteDiscipline, result: RouteResult): boolean {
  return discipline === 'top-rope'
    ? result === 'Clean' || result === 'Attempt'
    : result === 'Onsight' || result === 'Flash' || result === 'Redpoint' || result === 'Attempt';
}

export function validateRouteInput(input: {
  discipline: RouteDiscipline;
  grade: string;
  result: RouteResult;
  attempts: number;
}): void {
  if (input.discipline !== 'top-rope' && input.discipline !== 'lead') {
    throw new Error('Climbing style must be top-rope or lead.');
  }
  if (!normalizeFrenchGrade(input.grade)) {
    throw new Error('Route grade must use a supported French grade (for example 5c, 6a or 6a+).');
  }
  if (!isRouteResultForDiscipline(input.discipline, input.result)) {
    throw new Error('That result is not valid for this climbing style.');
  }
  if (!Number.isSafeInteger(input.attempts) || input.attempts < 1) {
    throw new Error('Route attempts must be a positive whole number.');
  }
  if (['Clean', 'Onsight', 'Flash'].includes(input.result) && input.attempts !== 1) {
    throw new Error('Clean, onsight and flash ascents require exactly one attempt.');
  }
}

export function highestRouteGrade(
  routes: Array<{ grade: string; result: RouteResult; discipline: RouteDiscipline }>,
  discipline: RouteDiscipline,
): string | null {
  const successful = routes.filter((route) =>
    route.discipline === discipline && route.result !== 'Attempt'
  );
  if (!successful.length) return null;
  return successful.reduce((best, route) =>
    FRENCH_GRADES.indexOf(route.grade) > FRENCH_GRADES.indexOf(best) ? route.grade : best,
  successful[0].grade);
}

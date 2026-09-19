import type {
  BoulderResult,
} from '@/data/storage';

export const V_GRADES = [
  'VB',
  'V0',
  'V1',
  'V2',
  'V3',
  'V4',
  'V5',
  'V6',
  'V7',
  'V8',
  'V9',
  'V10',
  'V11',
  'V12',
  'V13',
  'V14',
  'V15',
  'V16',
  'V17',
] as const;

export type VGrade =
  (typeof V_GRADES)[number];

export type GradeMode =
  | 'single'
  | 'range';

export const BOULDER_RESULTS = [
  {
    value: 'Flash',
    label: 'Flash',
    description:
      'Completed first try',
  },
  {
    value: 'Send',
    label: 'Send',
    description:
      'Completed after more than one attempt',
  },
  {
    value: 'Completed',
    label: 'Completed',
    description:
      'Finished after projecting',
  },
  {
    value: 'Project',
    label: 'Project',
    description:
      'Still trying',
  },
  {
    value: 'Attempt',
    label: 'Attempt',
    description:
      'Tried but not completed',
  },
] satisfies readonly {
  value: BoulderResult;
  label: string;
  description: string;
}[];

export const TERRAINS = [
  'Slab',
  'Vertical',
  'Overhang',
  'Roof',
] as const;

export type Terrain =
  (typeof TERRAINS)[number];

export const HOLD_TYPES = [
  'Crimp',
  'Sloper',
  'Jug',
  'Pinch',
  'Pocket',
  'Volume',
] as const;

export const MOVEMENT_TYPES = [
  'Technical',
  'Power',
  'Compression',
  'Dyno',
  'Heel Hook',
  'Toe Hook',
  'Drop Knee',
] as const;

export function resolveRouteParam(
  value:
    | string
    | string[]
    | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function normalizeSelections(
  value:
    | string
    | string[]
    | undefined,
  allowed: readonly string[],
  fallback: string,
): string[] {
  const rawValues =
    Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? [value]
        : [];

  const normalized =
    Array.from(
      new Set(
        rawValues
          .map((item) =>
            item.trim(),
          )
          .filter((item) =>
            allowed.includes(item),
          ),
      ),
    );

  return normalized.length > 0
    ? normalized
    : [fallback];
}

export function isTerrain(
  value: string,
): value is Terrain {
  return (
    TERRAINS as readonly string[]
  ).includes(value);
}

function normalizeVGradeToken(
  value: string,
): VGrade | null {
  const normalized =
    value
      .trim()
      .toUpperCase();

  if (normalized === 'VB') {
    return 'VB';
  }

  const match =
    normalized.match(
      /^V?(\d{1,2})$/,
    );

  if (!match) {
    return null;
  }

  const number =
    Number(match[1]);

  const grade =
    `V${number}`;

  return (
    V_GRADES as readonly string[]
  ).includes(grade)
    ? (grade as VGrade)
    : null;
}

export function parseVGrade(
  value: string,
): {
  start: VGrade;
  end: VGrade;
} | null {
  const normalized =
    value
      .trim()
      .toUpperCase()
      .replace(/[–—]/g, '-');

  if (!normalized) {
    return null;
  }

  const parts =
    normalized
      .split('-')
      .map((part) =>
        part.trim(),
      )
      .filter(Boolean);

  if (
    parts.length < 1 ||
    parts.length > 2
  ) {
    return null;
  }

  const start =
    normalizeVGradeToken(
      parts[0],
    );

  const end =
    normalizeVGradeToken(
      parts[1] ?? parts[0],
    );

  if (!start || !end) {
    return null;
  }

  if (
    getVGradeIndex(start) >
    getVGradeIndex(end)
  ) {
    return null;
  }

  return {
    start,
    end,
  };
}

export function formatVGrade(
  start: VGrade,
  end: VGrade,
): string {
  return start === end
    ? start
    : `${start}–${end}`;
}

export function normalizeVGradeInput(
  value: string,
): string | null {
  const parsed =
    parseVGrade(value);

  if (!parsed) {
    return null;
  }

  return formatVGrade(
    parsed.start,
    parsed.end,
  );
}

export function getVGradeIndex(
  grade: VGrade,
): number {
  return V_GRADES.indexOf(
    grade,
  );
}

export function isValidGradeRange(
  start: VGrade,
  end: VGrade,
): boolean {
  return (
    getVGradeIndex(start) <=
    getVGradeIndex(end)
  );
}

export function resultSupportsProjectLink(
  result: BoulderResult,
): boolean {
  return (
    result === 'Project' ||
    result === 'Completed'
  );
}

export function adjustAttemptsForResult(
  result: BoulderResult,
  currentValue: string,
): string {
  if (result === 'Flash') {
    return '1';
  }

  if (result === 'Send') {
    const parsed =
      Number(currentValue);

    if (
      !Number.isInteger(parsed) ||
      parsed < 2
    ) {
      return '2';
    }
  }

  return currentValue;
}

export function validateAttempts(
  result: BoulderResult,
  rawValue: string,
):
  | {
      ok: true;
      value: number;
    }
  | {
      ok: false;
      error: string;
    } {
  const trimmed =
    rawValue.trim();

  if (!/^\d+$/.test(trimmed)) {
    return {
      ok: false,
      error:
        'Enter a whole number of attempts.',
    };
  }

  const value =
    Number(trimmed);

  if (
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    return {
      ok: false,
      error:
        'Please enter at least 1 attempt.',
    };
  }

  if (
    result === 'Flash' &&
    value !== 1
  ) {
    return {
      ok: false,
      error:
        'A flash must have exactly 1 attempt.',
    };
  }

  if (
    result === 'Send' &&
    value < 2
  ) {
    return {
      ok: false,
      error:
        'A send is a completed climb after more than one attempt. Use Flash for a first-try completion.',
    };
  }

  return {
    ok: true,
    value,
  };
}

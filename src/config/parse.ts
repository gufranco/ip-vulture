interface FieldError {
  readonly variable: string;
  readonly reason: string;
}

type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: FieldError };

type EnvSource = Readonly<Record<string, string | undefined>>;

function ok<T>(value: T): Parsed<T> {
  return { ok: true, value };
}

function fail<T>(variable: string, reason: string): Parsed<T> {
  return { ok: false, error: { variable, reason } };
}

function read(env: EnvSource, variable: string): string | undefined {
  const raw = env[variable];

  if (raw === undefined) {
    return undefined;
  }

  const trimmed = raw.trim();

  return trimmed.length === 0 ? undefined : trimmed;
}

function parseInteger(
  env: EnvSource,
  variable: string,
  fallback: number,
  bounds: { readonly min: number; readonly max: number },
): Parsed<number> {
  const raw = read(env, variable);

  if (raw === undefined) {
    return ok(fallback);
  }

  const value = Number(raw);

  if (!Number.isInteger(value)) {
    return fail(variable, `"${raw}" is not an integer`);
  }

  if (value < bounds.min || value > bounds.max) {
    return fail(
      variable,
      `${value} is outside the range ${bounds.min} to ${bounds.max}`,
    );
  }

  return ok(value);
}

function parseString(
  env: EnvSource,
  variable: string,
  fallback: string,
): string {
  return read(env, variable) ?? fallback;
}

function parseBoolean(
  env: EnvSource,
  variable: string,
  fallback: boolean,
): Parsed<boolean> {
  const raw = read(env, variable);

  if (raw === undefined) {
    return ok(fallback);
  }

  const normalized = raw.toLowerCase();

  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return ok(true);
  }

  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return ok(false);
  }

  return fail(variable, `"${raw}" is not a boolean. Use true or false`);
}

function parseEnum<T extends string>(
  env: EnvSource,
  variable: string,
  allowed: readonly T[],
  fallback: T,
): Parsed<T> {
  const raw = read(env, variable);

  if (raw === undefined) {
    return ok(fallback);
  }

  const match = allowed.find((candidate) => candidate === raw);

  if (match === undefined) {
    return fail(variable, `"${raw}" is not one of: ${allowed.join(", ")}`);
  }

  return ok(match);
}

function parseList(
  env: EnvSource,
  variable: string,
  fallback: readonly string[],
): Parsed<readonly string[]> {
  const raw = read(env, variable);

  if (raw === undefined) {
    return ok(fallback);
  }

  const entries = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return ok(Object.freeze(entries));
}

function collectErrors(
  results: readonly Parsed<unknown>[],
): readonly FieldError[] {
  return Object.freeze(
    results
      .filter(
        (
          result,
        ): result is { readonly ok: false; readonly error: FieldError } =>
          !result.ok,
      )
      .map((result) => result.error),
  );
}

function unwrap<T>(result: Parsed<T>): T {
  if (!result.ok) {
    throw new Error(
      `Attempted to read a failed configuration value: ${result.error.variable}`,
    );
  }

  return result.value;
}

export {
  collectErrors,
  type EnvSource,
  type FieldError,
  fail,
  ok,
  type Parsed,
  parseBoolean,
  parseEnum,
  parseInteger,
  parseList,
  parseString,
  unwrap,
};

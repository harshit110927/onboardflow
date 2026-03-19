// NEW FILE — created for tier selection feature

declare module "next/dist/compiled/zod" {
  type ZodIssue = {
    message: string;
  };

  type SafeParseSuccess<T> = {
    success: true;
    data: T;
  };

  type SafeParseError = {
    success: false;
    error: {
      issues: ZodIssue[];
    };
  };

  interface ZodType<T> {
    safeParse(data: unknown): SafeParseSuccess<T> | SafeParseError;
    optional(): ZodType<T | undefined>;
  }

  interface ZodString extends ZodType<string> {
    min(length: number): ZodString;
    max(length: number): ZodString;
    email(): ZodString;
    datetime(): ZodString;
  }

  type Shape = Record<string, ZodType<unknown>>;

  type InferShape<T extends Shape> = {
    [K in keyof T]: T[K] extends ZodType<infer TValue> ? TValue : never;
  };

  interface ZodObject<T extends Shape> extends ZodType<InferShape<T>> {}

  export const z: {
    string(): ZodString;
    object<T extends Shape>(shape: T): ZodObject<T>;
  };
}

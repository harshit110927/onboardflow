type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue | undefined };

export interface IdentifyProperties extends JsonObject {
  plan?: string;
  planValue?: number;
  customerType?: "free" | "paying" | "trial" | "churned";
}

export interface IdentifyParams {
  userId: string;
  email: string;
  properties?: IdentifyProperties;
}

export type DripmetricErrorCode =
  | "INVALID_API_KEY"
  | "MISSING_REQUIRED_FIELD"
  | "USER_NOT_FOUND"
  | "RATE_LIMIT_EXCEEDED"
  | "INTERNAL_ERROR"
  | "UNKNOWN_ERROR";

export class DripmetricApiError extends Error {
  readonly status: number;
  readonly code: DripmetricErrorCode;

  constructor(status: number, code: DripmetricErrorCode, message: string) {
    super(`Dripmetric error (${status} ${code}): ${message}`);
    this.name = "DripmetricApiError";
    this.status = status;
    this.code = code;
  }
}

export class Dripmetric {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, options?: { baseUrl?: string }) {
    this.apiKey = apiKey;
    this.baseUrl = options?.baseUrl || "https://www.dripmetric.com/api/v1";
  }

  /**
   * Identify a user on signup or login.
   * Creates the user in your Dripmetric dashboard.
   */
  async identify(user: IdentifyParams): Promise<{ success: boolean }> {
    return this._request("/identify", {
      userId: user.userId,
      email: user.email,
      ...(user.properties !== undefined ? { properties: user.properties } : {}),
    });
  }

  /**
   * Track a completed onboarding step.
   * stepId must match the Event Name (Code) set in your dashboard.
   */
  async track(data: { userId: string; stepId: string }): Promise<{ success: boolean; step: string }> {
    return this._request("/track", {
      userId: data.userId,
      stepId: data.stepId,
    });
  }

  private async _request(path: string, body: object): Promise<any> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const apiError = payload?.error;
      const code = typeof apiError?.code === "string"
        ? apiError.code as DripmetricErrorCode
        : "UNKNOWN_ERROR";
      const message = typeof apiError?.message === "string"
        ? apiError.message
        : "Unknown error";

      throw new DripmetricApiError(response.status, code, message);
    }

    return response.json();
  }
}

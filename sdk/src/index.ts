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
  metadata?: IdentifyProperties;
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
    this.baseUrl = options?.baseUrl || "https://www.dripmetric.com/api/public";
  }

  /**
   * Identify a user on signup or login.
   * Creates the user in your Dripmetric dashboard.
   */
  async identify(user: IdentifyParams): Promise<{ success: boolean }> {
    return this._request("/identify", {
      userId: user.userId,
      email: user.email,
      ...((user.metadata ?? user.properties) !== undefined ? { metadata: user.metadata ?? user.properties } : {}),
    });
  }

  /**
   * Track a completed onboarding step.
   * stepId must match the Event Name (Code) set in your dashboard.
   */
  async track(data: { userId: string; eventName?: string; stepId?: string; properties?: JsonObject; timestamp?: string }): Promise<{ success: boolean; eventName: string; duplicate: boolean }> {
    return this._request("/track", {
      userId: data.userId,
      eventName: data.eventName ?? data.stepId,
      ...(data.properties !== undefined ? { properties: data.properties } : {}),
      ...(data.timestamp !== undefined ? { timestamp: data.timestamp } : {}),
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

export class OnboardFlow {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, options?: { baseUrl?: string }) {
    this.apiKey = apiKey;
    this.baseUrl = options?.baseUrl || "https://www.onboardflow.xyz/api/v1";
  }

  /**
   * Identify a user on signup or login.
   * Creates the user in your OnboardFlow dashboard.
   */
  async identify(user: { userId: string; email: string }): Promise<{ success: boolean }> {
    return this._request("/identify", {
      userId: user.userId,
      email: user.email,
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
      const error = await response.json().catch(() => ({}));
      throw new Error(`OnboardFlow error (${response.status}): ${error?.error || "Unknown error"}`);
    }

    return response.json();
  }
}
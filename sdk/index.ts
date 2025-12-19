// sdk/index.ts
// This is what users would import if they installed "npm install onboardflow"

export class OnboardFlow {
    private apiKey: string;
    private baseUrl: string;
  
    constructor(apiKey: string, options?: { baseUrl?: string }) {
      this.apiKey = apiKey;
      // Default to production, but allow localhost for testing
      this.baseUrl = options?.baseUrl || "http://localhost:3000/api/v1";
    }
  
    /**
     * Identify a user (Login/Signup)
     */
    async identify(user: { userId: string; email: string }) {
      return this._request('/identify', 'POST', user);
    }
  
    /**
     * Track a specific event/step
     */
    async track(event: { userId: string; eventName: string }) {
      // We haven't built the specific 'track' endpoint yet, 
      // but typically it would look like this:
      // return this._request('/track', 'POST', event);
      console.log(`[SDK] Tracking ${event.eventName} for ${event.userId}`);
    }
  
    /**
     * Private helper to handle the fetch logic
     */
    private async _request(path: string, method: string, body: any) {
      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
          },
          body: JSON.stringify(body),
        });
  
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("[OnboardFlow SDK Error]", error);
        throw error;
      }
    }
  }
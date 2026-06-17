# Dripmetric SDK

Lightweight TypeScript wrapper for the Dripmetric public API. Works with any language capable of making HTTP requests; this package is only a convenience wrapper for Node.js/TypeScript users.

```bash
npm install dripmetric
```

```ts
import { Dripmetric } from "dripmetric";

const dripmetric = new Dripmetric(process.env.DRIPMETRIC_API_KEY!);

await dripmetric.identify({
  userId: "user_123",
  email: "alice@example.com",
  metadata: { plan: "startup" },
});

await dripmetric.track({
  userId: "user_123",
  eventName: "created_project",
  properties: { source: "app" },
});
```

The SDK sends HTTP requests to `/api/public/identify` and `/api/public/track`; it does not bypass the public API.

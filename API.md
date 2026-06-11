# Dripmetric REST API

## Authentication

All endpoints require your API key in the `x-api-key` header.
Your API key starts with `obf_live_` and is found in your dashboard.

## Base URL

```text
https://www.dripmetric.com/api/v1
```

## Endpoints

### POST /identify

Create or update a tracked end user for your Dripmetric tenant. Call this when a user signs up, logs in, or when your backend learns new plan/payment properties for that user.

#### Request

```http
POST /api/v1/identify
x-api-key: obf_live_your_api_key
Content-Type: application/json
```

```json
{
  "userId": "user_123",
  "email": "alice@example.com",
  "event": "signed_up",
  "properties": {
    "plan": "basic",
    "planValue": 79,
    "customerType": "paying"
  }
}
```

Fields:

| Field | Required | Description |
| --- | --- | --- |
| `email` | Yes | End user's email address. |
| `userId` | No | Your application's user ID. If omitted, Dripmetric uses `email` as the external user ID. |
| `event` | No | Optional onboarding event to mark as completed during identify. |
| `properties` | No | Optional JSON object for plan, payment, or custom metadata. Existing properties are merged with new values. |

#### Response

```json
{
  "success": true
}
```

### POST /track

Mark an onboarding step as completed for a previously identified user.

#### Request

```http
POST /api/v1/track
x-api-key: obf_live_your_api_key
Content-Type: application/json
```

```json
{
  "userId": "user_123",
  "stepId": "created_project"
}
```

Fields:

| Field | Required | Description |
| --- | --- | --- |
| `userId` | Yes | The user ID passed to `/identify`. |
| `stepId` | Yes | Event Name (Code) configured in your Dripmetric dashboard. `event` is also accepted for backward compatibility. |

#### Response

```json
{
  "success": true,
  "step": "created_project"
}
```

### GET /users

List tracked end users for your tenant, including computed lifecycle status.

#### Query parameters

| Parameter | Required | Default | Description |
| --- | --- | --- | --- |
| `status` | No | All statuses | Filter by `stalled`, `activated`, `at_risk`, or `churned`. |
| `page` | No | `1` | Positive integer page number. |
| `limit` | No | `50` | Positive integer page size. Maximum `200`; higher values are clamped. |

#### Request

```http
GET /api/v1/users?status=at_risk&page=1&limit=50
x-api-key: obf_live_your_api_key
```

#### Response

```json
{
  "success": true,
  "users": [
    {
      "userId": "user_123",
      "email": "alice@example.com",
      "properties": {
        "plan": "basic",
        "planValue": 79,
        "customerType": "paying"
      },
      "completedSteps": ["created_project"],
      "lastSeenAt": "2026-06-11T09:00:00.000Z",
      "lastEmailedAt": "2026-06-10T09:00:00.000Z",
      "automationsReceived": ["nudge_step1"],
      "createdAt": "2026-06-01T09:00:00.000Z",
      "status": "at_risk"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50
}
```

### GET /users/:userId

Fetch one tracked end user by the `userId`/`externalId` value you sent to `/identify`.

#### Request

```http
GET /api/v1/users/user_123
x-api-key: obf_live_your_api_key
```

#### Response

```json
{
  "success": true,
  "user": {
    "userId": "user_123",
    "email": "alice@example.com",
    "properties": {
      "plan": "basic",
      "planValue": 79,
      "customerType": "paying"
    },
    "completedSteps": ["signed_up", "created_project"],
    "lastSeenAt": "2026-06-11T09:00:00.000Z",
    "lastEmailedAt": "2026-06-10T09:00:00.000Z",
    "automationsReceived": ["nudge_step1"],
    "createdAt": "2026-06-01T09:00:00.000Z",
    "status": "activated"
  }
}
```

## Code examples

### curl

```bash
curl -X POST "https://www.dripmetric.com/api/v1/identify" \
  -H "x-api-key: obf_live_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_123","email":"alice@example.com"}'

curl -X POST "https://www.dripmetric.com/api/v1/track" \
  -H "x-api-key: obf_live_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_123","stepId":"created_project"}'
```

### Python requests

```python
import requests

API_KEY = "obf_live_your_api_key"
BASE_URL = "https://www.dripmetric.com/api/v1"
headers = {
    "x-api-key": API_KEY,
    "Content-Type": "application/json",
}

# In your Razorpay payment.captured webhook handler:
requests.post(
    f"{BASE_URL}/identify",
    headers=headers,
    json={
        "userId": user["id"],
        "email": user["email"],
        "properties": {
            "plan": "basic",
            "planValue": 79,
            "customerType": "paying",
        },
    },
).raise_for_status()

requests.post(
    f"{BASE_URL}/track",
    headers=headers,
    json={"userId": user["id"], "stepId": "created_project"},
).raise_for_status()
```

### Ruby net/http

```ruby
require "json"
require "net/http"
require "uri"

api_key = "obf_live_your_api_key"
base_url = "https://www.dripmetric.com/api/v1"

def post_json(url, api_key, payload)
  uri = URI(url)
  request = Net::HTTP::Post.new(uri)
  request["x-api-key"] = api_key
  request["Content-Type"] = "application/json"
  request.body = payload.to_json

  Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
    response = http.request(request)
    raise response.body unless response.is_a?(Net::HTTPSuccess)
    JSON.parse(response.body)
  end
end

post_json("#{base_url}/identify", api_key, {
  userId: "user_123",
  email: "alice@example.com"
})

post_json("#{base_url}/track", api_key, {
  userId: "user_123",
  stepId: "created_project"
})
```

### Node.js native fetch

```js
const apiKey = "obf_live_your_api_key";
const baseUrl = "https://www.dripmetric.com/api/v1";

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

await post("/identify", {
  userId: "user_123",
  email: "alice@example.com",
});

await post("/track", {
  userId: "user_123",
  stepId: "created_project",
});
```

## Error reference

Errors use this JSON shape:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Invalid API Key"
  }
}
```

| Code | HTTP status | Meaning |
| --- | --- | --- |
| `INVALID_API_KEY` | `401` | API key is missing or invalid. |
| `MISSING_REQUIRED_FIELD` | `400` | The request is missing required data or contains an invalid request body. |
| `USER_NOT_FOUND` | `404` | The requested user does not exist for this API key. |
| `RATE_LIMIT_EXCEEDED` | `429` | The API rate limit or plan limit was exceeded. |
| `INTERNAL_ERROR` | `500` | An unexpected server error occurred. |

## Rate limits

1000 requests per hour per API key. Returns 429 with `RATE_LIMIT_EXCEEDED` when exceeded.

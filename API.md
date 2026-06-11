# Dripmetric REST API

## Authentication

All endpoints require your API key in the `x-api-key` header.
Your API key starts with `obf_live_` and is found in your dashboard.

## Base URL

https://www.dripmetric.com/api/v1

## Endpoints

### POST /identify

Create or update an end user, optionally record an onboarding event, and send the configured welcome email to newly identified users.

**Request**

```http
POST /api/v1/identify
x-api-key: obf_live_your_api_key
content-type: application/json
```

```json
{
  "userId": "user_123",
  "email": "alex@example.com",
  "event": "signed_up",
  "properties": {
    "customerType": "trial",
    "plan": "Starter",
    "planValue": 29,
    "currency": "USD"
  }
}
```

**Response**

```json
{
  "success": true
}
```

### POST /track

Record that an identified user completed an onboarding step. `stepId` and `event` are aliases; send either field.

**Request**

```http
POST /api/v1/track
x-api-key: obf_live_your_api_key
content-type: application/json
```

```json
{
  "userId": "user_123",
  "stepId": "connect_repo"
}
```

**Response**

```json
{
  "success": true,
  "step": "connect_repo"
}
```

### GET /users

List tracked end users for the tenant that owns the API key. Status is computed at request time from completed steps, automations received, last activity, and user properties.

**Query parameters**

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `status` | `stalled` \| `activated` \| `at_risk` \| `churned` | none | Optional server-side status filter. |
| `page` | integer | `1` | 1-based page number. |
| `limit` | integer | `50` | Maximum `200`; higher values are clamped to `200`. |

**Request**

```http
GET /api/v1/users?status=stalled&page=1&limit=50
x-api-key: obf_live_your_api_key
```

**Response**

```json
{
  "success": true,
  "users": [
    {
      "userId": "user_123",
      "email": "alex@example.com",
      "properties": {
        "customerType": "trial",
        "plan": "Starter",
        "planValue": 29,
        "currency": "USD"
      },
      "completedSteps": ["signed_up"],
      "lastSeenAt": "2026-06-11T10:00:00.000Z",
      "lastEmailedAt": null,
      "automationsReceived": [],
      "createdAt": "2026-06-10T10:00:00.000Z",
      "status": "stalled"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50
}
```

### GET /users/:userId

Fetch one tracked end user by `externalId` / `userId`.

**Request**

```http
GET /api/v1/users/user_123
x-api-key: obf_live_your_api_key
```

**Response**

```json
{
  "success": true,
  "user": {
    "userId": "user_123",
    "email": "alex@example.com",
    "properties": {
      "customerType": "trial",
      "plan": "Starter",
      "planValue": 29,
      "currency": "USD"
    },
    "completedSteps": ["signed_up", "connect_repo"],
    "lastSeenAt": "2026-06-11T10:00:00.000Z",
    "lastEmailedAt": "2026-06-11T09:00:00.000Z",
    "automationsReceived": ["nudge_step1"],
    "createdAt": "2026-06-10T10:00:00.000Z",
    "status": "activated"
  }
}
```

## Code examples

### curl

```bash
curl -X POST https://www.dripmetric.com/api/v1/identify \
  -H "x-api-key: obf_live_your_api_key" \
  -H "content-type: application/json" \
  -d '{"userId":"user_123","email":"alex@example.com"}'

curl -X POST https://www.dripmetric.com/api/v1/track \
  -H "x-api-key: obf_live_your_api_key" \
  -H "content-type: application/json" \
  -d '{"userId":"user_123","stepId":"connect_repo"}'
```

### Python (`requests`)

Example after a Razorpay payment webhook, including the `properties` field:

```python
import requests

API_KEY = "obf_live_your_api_key"
BASE_URL = "https://www.dripmetric.com/api/v1"


def identify(user_id, email, payment):
    return requests.post(
        f"{BASE_URL}/identify",
        headers={"x-api-key": API_KEY},
        json={
            "userId": user_id,
            "email": email,
            "properties": {
                "customerType": "paying",
                "plan": payment["plan_name"],
                "planValue": payment["amount"] / 100,
                "currency": payment.get("currency", "INR"),
            },
        },
        timeout=10,
    )


def track(user_id, step_id):
    return requests.post(
        f"{BASE_URL}/track",
        headers={"x-api-key": API_KEY},
        json={"userId": user_id, "stepId": step_id},
        timeout=10,
    )
```

### Ruby (`net/http`)

```ruby
require "json"
require "net/http"
require "uri"

API_KEY = "obf_live_your_api_key"
BASE_URL = "https://www.dripmetric.com/api/v1"

def post_json(path, body)
  uri = URI("#{BASE_URL}#{path}")
  req = Net::HTTP::Post.new(uri)
  req["x-api-key"] = API_KEY
  req["content-type"] = "application/json"
  req.body = JSON.generate(body)
  Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |http| http.request(req) }
end

def identify(user_id, email)
  post_json("/identify", { userId: user_id, email: email })
end

def track(user_id, step_id)
  post_json("/track", { userId: user_id, stepId: step_id })
end
```

### Node.js (native `fetch`)

```js
const API_KEY = "obf_live_your_api_key";
const BASE_URL = "https://www.dripmetric.com/api/v1";

async function identify(userId, email) {
  const res = await fetch(`${BASE_URL}/identify`, {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({ userId, email }),
  });
  return res.json();
}

async function track(userId, stepId) {
  const res = await fetch(`${BASE_URL}/track`, {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({ userId, stepId }),
  });
  return res.json();
}
```

## Error reference

All API errors use this shape:

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
| `INVALID_API_KEY` | 401 | The `x-api-key` header is missing or invalid. |
| `MISSING_REQUIRED_FIELD` | 400 | A required request field is missing or invalid. |
| `USER_NOT_FOUND` | 404 | The requested end user does not exist for this tenant. |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests were sent in the current rate-limit window. |
| `INTERNAL_ERROR` | 500 | Dripmetric could not complete the request. |

## Rate limits

1000 requests per hour per API key. Returns 429 with `RATE_LIMIT_EXCEEDED` when exceeded.

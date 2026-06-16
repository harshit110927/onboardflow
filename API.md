# Dripmetric Public API

Works with any language capable of making HTTP requests.

Base URL: `https://www.dripmetric.com/api/public`

Authenticate server-side requests with `x-api-key: obf_live_your_api_key` or `Authorization: Bearer obf_live_your_api_key`.

## Health

```bash
curl https://www.dripmetric.com/api/public/health
```

## Version

```bash
curl https://www.dripmetric.com/api/public/version
```

## Identify

```bash
curl -X POST https://www.dripmetric.com/api/public/identify \
  -H "content-type: application/json" \
  -H "x-api-key: obf_live_your_api_key" \
  -d '{"userId":"user_123","email":"alice@example.com","metadata":{"plan":"startup"}}'
```


### Identify identity behavior

`userId` is the stable identity key for Dripmetric end users. Calling `identify` again with the same `userId` updates that user and is safe to retry. If the same email address is sent with a different `userId`, Dripmetric treats it as a different end-user record rather than merging records by email. This avoids accidentally combining two users who share, reuse, or change email addresses.

## Track

```bash
curl -X POST https://www.dripmetric.com/api/public/track \
  -H "content-type: application/json" \
  -H "x-api-key: obf_live_your_api_key" \
  -d '{"userId":"user_123","eventName":"created_project","properties":{"source":"app"},"timestamp":"2026-06-16T00:00:00.000Z"}'
```

Duplicate `track` calls for the same `userId` and `eventName` are retry-safe and return `duplicate: true` without storing the event twice.

## Node.js

```js
await fetch('https://www.dripmetric.com/api/public/identify', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': process.env.DRIPMETRIC_API_KEY }, body: JSON.stringify({ userId: 'user_123', email: 'alice@example.com', metadata: {} }) });
```

## Python

```python
import requests
requests.post('https://www.dripmetric.com/api/public/track', headers={'x-api-key': API_KEY}, json={'userId':'user_123','eventName':'created_project'})
```

## Go

```go
http.Post("https://www.dripmetric.com/api/public/health", "application/json", nil)
```

## PHP

```php
file_get_contents('https://www.dripmetric.com/api/public/version');
```

## Ruby

```ruby
Net::HTTP.get(URI('https://www.dripmetric.com/api/public/health'))
```

## Java

```java
HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("https://www.dripmetric.com/api/public/health")).build(), HttpResponse.BodyHandlers.ofString());
```

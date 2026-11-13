# CareerCompass Frontend Handoff

## Base URL

Development API base URL:

```text
http://localhost:4000/api/v1
```

Health endpoints are mounted outside the versioned API:

- `GET http://localhost:4000/health`
- `GET http://localhost:4000/ready`

Production must use HTTPS. Browser origins must be listed in the backend `ALLOWED_ORIGINS` environment variable.

## Authentication

1. Register with `POST /auth/register` using `email`, `password`, `displayName`, and `consentAccepted: true`.
2. Login with `POST /auth/login`.
3. Keep the returned short-lived `data.accessToken` in application memory where practical.
4. Send `Authorization: Bearer <accessToken>` on protected requests.
5. Send requests with credentials enabled so the HttpOnly refresh cookie is included.
6. When the access token expires, call `POST /auth/refresh`; the refresh cookie is rotated by the server.
7. Call `POST /auth/logout` to revoke the refresh session.

Example:

```js
const response = await fetch(`${API_BASE}/auth/login`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const { data } = await response.json();
```

All responses use `{ data, meta? }`. Errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the supplied fields.",
    "details": []
  }
}
```

## Endpoint summary

- **Authentication/profile:** `/auth/*`, `/users/me`
- **Assessments:** `/assessments`, `/assessments/:id/questions`, `/assessments/:id/attempts`, `/attempts/*`
- **Careers and saved careers:** `/careers/*`, `/skills`, `/pathways/*`, `/users/me/saved-careers/*`
- **Counsellors and bookings:** `/counsellors/*`, `/bookings/*`
- **Administration:** `/admin/users`, assessment/question management, career/skill/pathway management
- **Analytics:** `/analytics/overview`, `/analytics/career-interests`
- **AI guidance:** `/guidance/sessions` and `/guidance/sessions/:id/messages`
- **Operations:** `/health`, `/ready`

Use the authenticated student identity for student resources; do not send a substitute `studentId`. Counsellor and admin endpoints require their corresponding role. Pagination uses `page` and `limit`; collection responses include `meta`.

## Common request examples

Start and complete an assessment:

```js
const attempt = await fetch(`${API_BASE}/assessments/${assessmentId}/attempts`, {
  method: 'POST',
  headers: authHeaders(accessToken),
}).then(readData);

await fetch(`${API_BASE}/attempts/${attempt.id}/answers/${questionId}`, {
  method: 'PUT',
  headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
  body: JSON.stringify({ optionId }),
});

const result = await fetch(`${API_BASE}/attempts/${attempt.id}/submit`, {
  method: 'POST',
  headers: authHeaders(accessToken),
}).then(readData);
```

Explore and save careers:

```text
GET /careers?q=software&page=1&limit=20
GET /careers/:idOrSlug
PUT /users/me/saved-careers/:careerId
DELETE /users/me/saved-careers/:careerId
```

Create a guidance session from a completed owned attempt:

```json
POST /guidance/sessions
{
  "attemptId": "completed-attempt-uuid",
  "careerIds": ["published-career-uuid"]
}
```

If MongoDB is unavailable, guidance history returns `503 DB_UNAVAILABLE`. If no configured LLM provider is available, message generation returns `503 AI_UNAVAILABLE`; SQL-backed assessment, career, and booking APIs remain available.

## Frontend environment

The frontend needs only the API base URL, for example:

```text
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

Backend deployment also requires `DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS`, and, for guidance, `MONGODB_URI`, `MONGODB_DB`, `LLM_API_URL`, `LLM_API_KEY`, and `LLM_MODEL`. Never expose backend secrets through frontend environment variables.

## Integration checklist

- Configure `VITE_API_BASE_URL`.
- Use `credentials: 'include'` for authentication requests.
- Centralize bearer-token injection and refresh handling.
- Render `error.code` and validation `details` without exposing raw server errors.
- Hide admin/counsellor controls unless the authenticated role permits them.
- Treat `similarityScore` as a vector similarity, not a probability.
- Handle `401`, `403`, `404`, `409`, `422`, `429`, and `503` explicitly.
- Do not assume AI responses are available until the provider is configured.


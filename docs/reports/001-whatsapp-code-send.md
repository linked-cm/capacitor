---
summary: WhatsApp code sends request a 360dialog bearer token, then store the code and return `{ sent: true }` only after HTTP 2xx.
---

# WhatsApp code send

## Outcome

`generateOTPWhatsapp` asks the 360dialog hub for an access token, then posts the authentication template with both `Authorization: bearer <token>` and `D360-API-KEY`. The sign-in screen opens the code step only when the call returns `{ sent: true }`.

There was no plan document for this change. This report is the record.

## Request flow

1. Refuse the call when the request has no session.
2. Normalize the phone number to digits and require `WA_D360_API_KEY`.
3. Delete any code already stored on the session, so a failed resend cannot be used.
4. `POST https://hub.360dialog.io/api/v2/token` with `WA_D360_USERNAME` and `WA_D360_PASSWORD`. A missing token is a failed send.
5. `POST https://waba-v2.360dialog.io/messages` with the template namespace, template name, deterministic language policy, and the code in the body and URL button.
6. On HTTP 2xx, store the code and return `{ sent: true }`. The response body is not required to contain `messages[0].id`.
7. On any other failure, leave the session without a code and throw `Could not send the code. Please try again.`

`validateOTPWhatsapp` is unchanged. It still compares the submitted code with `session.otp`.

## Decisions

- The bearer token is added because the hub token endpoint is what the current 360dialog account uses. The API key header stays.
- HTTP 2xx is the acceptance signal. Requiring `messages[0].id` hid a delivered code from the sign-in screen when the provider omitted that id.
- The code is written to the session only after that 2xx. Writing it before the request let a rejected send leave a usable code behind.
- The screen keeps checking `response.sent`. A call that resolves without that flag, which non-2xx RPC responses can do, stays on the phone step and shows the inline error.
- `WA_D360_TEMPLATE_LANGUAGE` still overrides the language code. The default remains `en`. The policy is always `deterministic` because authentication templates are rejected without it.

## Public behavior

Callers of `generateOTPWhatsapp` receive `{ sent: true }` or a thrown error. They no longer receive the provider body. Required environment variables:

- `WA_D360_API_KEY`
- `WA_D360_USERNAME`
- `WA_D360_PASSWORD`
- `WA_D360_TEMPLATE_NAMESPACE`
- `WA_D360_TEMPLATE_NAME`
- `WA_D360_TEMPLATE_LANGUAGE` (optional)

## Files

- `src/backend.ts` — token request, template send, and session write.
- `src/components/SignInWithWhatsapp.tsx` — opens the code step only for `{ sent: true }`.
- `tests/whatsapp-otp.test.mjs` — token header, rejected resend, and 2xx without a message id.
- `readme.md` — documents the `{ sent: true }` result next to the environment variables.

## Tests

`npm test` builds `lib/esm` and runs `tests/*.test.mjs`. The WhatsApp send tests cover the bearer header, namespace, normalized recipient, successful store, rejected resend clearing the previous code, and a 2xx body without a message id.

## Limitations

The session is still `express-session` on the app server. This package does not create that session. If `req.session` is missing, the send fails before 360dialog is called.

The token is requested on every send and is not cached.

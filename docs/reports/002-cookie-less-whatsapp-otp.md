# Cookie-less WhatsApp OTP sign-in

## Scope

Support the existing WhatsApp OTP component when a native WebView cannot retain
the cross-origin session cookie required by the browser flow.

## Behavior

- Cookie-backed browser requests continue storing and validating the OTP in the
  server session.
- Cookie-less requests receive a ten-minute, phone-bound signed challenge after
  the provider accepts the code delivery.
- The client returns that opaque challenge with the entered OTP. The server
  rejects challenges with an invalid signature, a different phone number, or an
  expired timestamp.
- Successful session-backed codes are consumed; a mistyped code may still be
  retried, as before.

## Security considerations

The signed challenge deliberately contains no plaintext OTP. Its signature
covers the payload and entered OTP, and comparison is constant-time. It is not
server-stored, so it cannot be made single-use across multiple workers; its
validity is limited to ten minutes. Deployments should keep normal OTP attempt
rate limits at the application edge.

## Verification

The package test covers challenge issuance, valid verification, incorrect OTP,
and a challenge bound to another phone number. The application regression suite
also covers expired and modified challenges.

## Notes

This was a focused compatibility fix without a dedicated implementation plan.

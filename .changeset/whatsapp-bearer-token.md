---
'@linked.cm/capacitor': patch
---

WhatsApp code requests now obtain a 360dialog access token and send it as `Authorization: bearer` together with `D360-API-KEY`. The template payload includes `WA_D360_TEMPLATE_NAMESPACE` and a deterministic language policy.

`generateOTPWhatsapp` still returns `{ sent: true }` only after the provider answers HTTP 2xx. A 2xx response without `messages[0].id` is treated as delivered, and the code is stored on the session only then. A rejected send clears any previous code. `WA_D360_USERNAME` and `WA_D360_PASSWORD` are required.

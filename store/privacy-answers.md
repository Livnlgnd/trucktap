# Store privacy answers

Use these answers for Google Play Data safety and Apple App Privacy.

## Summary

- Local mode stores van, parts, and restock data only on the device.
- Team Sync is optional and sends the workspace data to TruckTap's hosted API
  when the user signs in.
- There is no advertising SDK, analytics SDK, or cross-app tracking.
- TruckTap does not sell personal data.

## Data stored on device

- Van names, parts, par levels, tap counts, restock lists, and settings.
- License key (stored locally; verified offline).
- Team Sync session token when the user signs in.

## Data sent to TruckTap (only with Team Sync)

- Account name, email address, and password hash.
- Workspace name, join code, members, and role.
- Van, part, restock, and pick-list records needed to sync the shared board.
- Device identifier used to make retries idempotent.

Purpose: app functionality and account management.
Transport: HTTPS. Retention: while the Team Sync workspace is active; the owner
can remove members. Disconnecting keeps a local copy on the device.

## Not collected

- Precise or coarse location
- Contacts
- Photos, camera, or microphone
- Health data
- Financial info (payments happen on the website, not in the app)
- Advertising identifiers
- Browsing history

## Tracking

No tracking across apps or websites.

## Third parties

- Team Sync hosting (Vercel/Neon) when enabled.
- No ad networks or analytics providers.

## Contact

support@trucktap.net

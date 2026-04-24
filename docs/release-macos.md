# macOS Release Checklist

This checklist is for distributing Eagle Markdown outside the Mac App Store without asking users to bypass Gatekeeper.

## What Apple Requires

Apple's public distribution path for apps downloaded from the web is:

1. Sign the app with a **Developer ID Application** certificate.
2. Submit the signed app to Apple's notarization service.
3. Staple the notarization ticket to the distributed artifact.
4. Publish only the signed and notarized `.dmg`.

Apple's notarization service checks Developer ID-signed software for malicious content and code-signing issues. Tauri also notes that Developer ID notarization requires paid Apple Developer credentials; ad-hoc signing is not enough for a smooth public install.

References:

- [Apple Developer ID](https://developer.apple.com/support/developer-id/)
- [Apple: Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- [Tauri: macOS Code Signing](https://tauri.app/distribute/sign/macos/)

## GitHub Secrets

Add these repository secrets before creating a public release tag:

| Secret | Value |
|--------|-------|
| `APPLE_CERTIFICATE` | Base64 text generated from the exported `.p12` certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password used when exporting the `.p12` |
| `APPLE_SIGNING_IDENTITY` | Example: `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID` | Apple ID email |
| `APPLE_PASSWORD` | App-specific password for the Apple ID |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

## Local Verification

After a release build downloads from GitHub, verify the macOS artifact before publishing the release broadly:

```bash
codesign --verify --deep --strict --verbose=2 "Eagle Markdown.app"
spctl --assess --type execute --verbose "Eagle Markdown.app"
```

Expected result:

- `codesign` exits successfully.
- `spctl` reports the app is accepted and identifies the Developer ID origin.

## Release Gate

Do not publish a public macOS release if any of these are true:

- The `.dmg` is unsigned.
- The app is signed with an Apple Development certificate instead of Developer ID Application.
- Notarization fails or is skipped.
- Gatekeeper still reports an unidentified developer warning after download.


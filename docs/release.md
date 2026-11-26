# Releasing TMC++

A release ships four things from one tag: the npm package, the browser extension (Chrome Web Store), and the VS Code extension (VS Code Marketplace and Open VSX).

## Every release

1. Raise `version` in `package.json`, `extension/manifest.json` and `vscode/package.json` (the same number in all three), and turn "Unreleased" in `CHANGELOG.md` into that version.
2. `npm test`, then `npm run pack` (writes `release/tmcpp-extension-<version>.zip`) and `npm run build:vscode`.
3. Commit, push, then create the GitHub release, which makes the tag:

   ```sh
   gh release create v0.3.0 release/tmcpp-extension-0.3.0.zip vscode/tmcpp-0.3.0.vsix --title "v3 (0.3.0)" --notes-file <notes>
   ```

   With the workflow below in place, publishing the release publishes everywhere else. Without it, publish by hand: `npm publish` (after `npm login`), the VS Code extension from `vscode/` as below, and the zip in the Chrome Web Store dashboard.

   Never type a token on the command line: it stays in your shell history. Both tools read it from an environment variable, which you can fill from the clipboard (PowerShell shown; in bash, `VSCE_PAT=$(pbpaste) npx @vscode/vsce publish` on a Mac):

   ```powershell
   cd vscode
   $env:VSCE_PAT = Get-Clipboard; npx @vscode/vsce publish; Remove-Item Env:VSCE_PAT
   $env:OVSX_PAT = Get-Clipboard; npx ovsx publish; Remove-Item Env:OVSX_PAT
   ```

Store images and icons: `node tools/store-assets.js` (after `npm run build:ext`). The listing text is in `store/listing.md`.

## The first Chrome Web Store upload (once, by hand)

The store API can only update an item that already exists, so the first version goes through the dashboard:

1. Register as a Chrome Web Store developer at https://chrome.google.com/webstore/devconsole (a one-time fee).
2. **New item**, upload `release/tmcpp-extension-0.3.0.zip`.
3. Fill in the Store listing and Privacy practices tabs from `store/listing.md`, and submit for review.
4. Note the item's ID (the 32 letters in its URL): that is `CWS_EXTENSION_ID` below.

## Publishing from CI

This is a draft of `.github/workflows/release.yml`. Copy it there yourself, then add the secrets in the repository's **Settings > Secrets and variables > Actions**:

| Secret | Where it comes from |
| --- | --- |
| `NPM_TOKEN` | npmjs.com > Access Tokens, a granular token that can publish `@ikeasourpatches/tmcpp` |
| `VSCE_PAT` | an Azure DevOps personal access token with Marketplace > Manage, for publisher `IkeaSourPatches` |
| `OVSX_PAT` | open-vsx.org > Settings > Access Tokens |
| `CWS_EXTENSION_ID` | the store item's ID |
| `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN` | a Google Cloud OAuth client with the Chrome Web Store API enabled; follow https://developer.chrome.com/docs/webstore/using-api |
| `CWS_PUBLISHER_ID` | your publisher ID from the dashboard's Account page (newer versions of the upload tool ask for it) |

```yaml
name: Release

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write   # attach the zip and .vsix to the release
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm test
      - name: Versions match the tag
        run: |
          v="${GITHUB_REF_NAME#v}"
          for f in package.json extension/manifest.json vscode/package.json; do
            test "$(node -p "require('./$f').version")" = "$v" || { echo "$f is not $v"; exit 1; }
          done
      - name: Build the extensions
        run: |
          npm run pack
          npm run build:vscode
          cd vscode && npx --yes @vscode/vsce package

      - name: npm
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: VS Code Marketplace and Open VSX
        working-directory: vscode
        run: |
          npx --yes @vscode/vsce publish --packagePath tmcpp-${GITHUB_REF_NAME#v}.vsix
          npx --yes ovsx publish tmcpp-${GITHUB_REF_NAME#v}.vsix
        env:
          VSCE_PAT: ${{ secrets.VSCE_PAT }}
          OVSX_PAT: ${{ secrets.OVSX_PAT }}

      - name: Chrome Web Store (uploads, then submits for review)
        run: |
          npx --yes chrome-webstore-upload-cli upload --source release/tmcpp-extension-${GITHUB_REF_NAME#v}.zip
          npx --yes chrome-webstore-upload-cli publish
        env:
          EXTENSION_ID: ${{ secrets.CWS_EXTENSION_ID }}
          CLIENT_ID: ${{ secrets.CWS_CLIENT_ID }}
          CLIENT_SECRET: ${{ secrets.CWS_CLIENT_SECRET }}
          REFRESH_TOKEN: ${{ secrets.CWS_REFRESH_TOKEN }}
          PUBLISHER_ID: ${{ secrets.CWS_PUBLISHER_ID }}

      - name: Attach the builds to the release
        run: gh release upload "$GITHUB_REF_NAME" release/*.zip vscode/*.vsix --clobber
        env:
          GH_TOKEN: ${{ github.token }}
```

Each store rejects a version it already has, so a failed run is rerun after fixing, not by publishing the same version twice. A Chrome Web Store update still goes through review; the new version reaches users once it's approved.

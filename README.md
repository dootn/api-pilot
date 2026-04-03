# API Pilot

**A powerful API debugging tool built right into VS Code — no browser, no separate app.**

![VS Code](https://img.shields.io/badge/VS%20Code-1.85+-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

---

![API Pilot Screenshot](resources/screenshot.png)

---

## Features

### HTTP Request

- **Methods**: GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD
- **Custom Methods**: Add additional HTTP methods (e.g. `PROPFIND`, `MKCOL`) via the `api-pilot.customHttpMethods` VS Code setting — they appear in the method dropdown alongside the standard methods
- **Custom Headers**: Add any request header as key-value pairs; toggle individual headers on/off without deleting them
- **Query Parameters**: Dedicated key-value editor for URL query params with per-row enable/disable toggles
- **Request Body**: Supports multiple body types:
  - **JSON** — syntax-highlighted editor
  - **Form Data** (multipart) — key-value fields with file upload support
  - **URL Encoded** (x-www-form-urlencoded)
  - **Raw** — free text with custom Content-Type
  - **Binary** — upload a local file as body
  - **GraphQL** — query + variables editor
- **Authentication**: Bearer Token, Basic Auth, API Key (header or query param)
- **SSL Verification**: Toggle SSL certificate verification per request
- **Scripts**: Write JavaScript pre-request and post-response scripts using a Postman-compatible `pm` API — modify the request, set variables, or assert response values

### Response Viewer

- **Status & Timing**: HTTP status code, status text, response time (ms), and body size — each labeled for clarity
- **Timing Breakdown**: Dedicated **Timing** tab shows a horizontal bar chart with three phases:
  - **DNS + Connect** — DNS resolution + TCP/TLS handshake time
  - **Wait (TTFB)** — server processing time until first byte received
  - **Download** — response body download time
  - Each phase displays milliseconds and percentage of total time
- **Body Rendering**:
  - JSON — pretty-printed with collapsible tree
  - XML, Markdown, HTML — rendered view
  - Images — inline preview
  - Raw text — plain output
- **Response Headers**: Full header list in a dedicated tab
- **Body Search**: Search within the response body
- **SSL Info**: For HTTPS requests — shows protocol (TLS version), cipher suite, certificate subject/issuer, validity dates, fingerprint, and full certificate chain
- **Test Results**: Pass/fail results from `pm.test()` assertions in the post-response script — shows test name, status (pass/fail), and error message on failure
- **Script Console**: Captured `console.log / warn / error` output from pre/post scripts, with source (pre/post) and log level indicated

### Collections

- Organize requests into collections with **nested folders**
- Full CRUD: create, rename, delete collections and folders
- Save the current request directly into any collection
- **Search / Filter**: Real-time search box filters requests by name or URL across all collections and folders; matching sections auto-expand

### Environment Variables

- Create multiple environments (e.g. dev, staging, prod) with key-value variable sets
- Use `{{variable_name}}` anywhere: URL, headers, params, body, auth fields
- Variables are resolved recursively (up to 5 levels) at send time and during cURL/code export
- Switch the active environment from the status bar; active environment persists across restarts
- A `Default` environment is always guaranteed to exist

### Request History

- Every sent request is automatically recorded, grouped by date (up to 1000 entries total), with one-click replay
- **Search / Filter**: Real-time search box filters history entries by URL, method, or request name; matching date groups auto-expand

### cURL / Fetch Import & Export

- Paste a **cURL** command (bash) or a **fetch()** snippet (Chrome DevTools / Node.js) to instantly import it as a request
- Export any request to cURL — environment variables are resolved in the output

### Code Snippets

- Generate ready-to-use code snippets for the current request (variables resolved)

### Editor Convenience

- **Header Autocomplete**: Intelligent suggestions for 58+ common HTTP header names and values
- **Multi-Tab Interface**: Work on multiple requests simultaneously; unsaved changes show a dirty-state marker
- **i18n**: Full English and Chinese (Simplified) UI
- **Theme Adaptation**: Integrates with your VS Code color theme

---

## Quick Start

1. Open VS Code and click the **API Pilot** icon in the Activity Bar.
2. Click `+` to create a new request.
3. Enter a URL, choose an HTTP method, and click **Send**.
4. View the formatted response below.

---

## Environment Variables

1. Click the environment name in the status bar to switch or manage environments.
2. Use `{{variable_name}}` anywhere in your request (URL, headers, params, body).
3. Variables are resolved automatically at send time and during export.

---

## Scripts

Pre-request and post-response scripts run in a sandboxed Node.js VM with a Postman-compatible `pm` object:

```js
// Pre-request: modify headers or set variables
pm.request.headers.add({ key: 'X-Timestamp', value: Date.now().toString() });
pm.environment.set('token', 'my-value');

// Post-response: run assertions
pm.test('Status is 200', () => pm.response.to.have.status(200));
pm.test('Body has id', () => pm.expect(pm.response.json().id).to.exist);

// Console output is captured and shown in the Script Console tab
console.log('response time:', pm.response.responseTime);
console.warn('large body detected');
```

Test results are shown per-test with pass ✓ / fail ✗ and error details. All `console.log/warn/error` calls are captured and displayed in the Script Console tab, labeled by source (pre/post) and log level.

---

## Data Storage

All data is stored locally in the workspace under `.api-pilot/`:

```
.api-pilot/
├── collections/     # Saved requests and folders
├── environments/    # Environment variable sets
└── history/         # Request history by date
```

> Add `.api-pilot/history/` to `.gitignore` to exclude history from version control.

---

## VS Code Settings

Open **Settings** (`Ctrl+,`) and search for `API Pilot`, or add to your `settings.json`:

| Setting | Type | Default | Description |
|---|---|---|---|
| `api-pilot.locale` | `"auto"` \| `"en"` \| `"zh-CN"` | `"auto"` | UI language. `auto` follows VS Code's language. |
| `api-pilot.requestTimeout` | number (ms) | `30000` | Global request timeout in milliseconds (1 000 – 300 000). |
| `api-pilot.maxHistory` | number | `1000` | Maximum total history entries to keep (10 – 10 000). |
| `api-pilot.customHttpMethods` | string[] | `[]` | Additional HTTP methods shown in the method selector (e.g. `["PROPFIND", "MKCOL"]`). |

---

## License

MIT

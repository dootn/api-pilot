# API Pilot

> 🚀 A powerful API debugging tool for VS Code — like Postman, built right into your editor.

![VS Code](https://img.shields.io/badge/VS%20Code-1.85+-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

---

## Features

### Core

- **HTTP Request Editor** — Support for GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD methods with full request configuration.

- **Response Viewer** — Pretty-printed JSON, raw text, headers view, status/time/size metadata.

- **Multi-Tab Interface** — Work on multiple requests simultaneously with a tabbed interface.

- **Collection Management** — Organize requests into collections with nested folders, persisted as JSON files.

- **Environment Variables** — Define `{{variable}}` placeholders resolved at request time. Switch between environments via status bar.

- **Request History** — Automatically records sent requests grouped by date, with quick replay.

- **cURL Import/Export** — Paste a cURL command to import, or export any request as cURL.

### Editor Features

- **Header Auto-Complete** — Intelligent autocomplete for 58+ common HTTP header names and their common values.

- **Auth Configuration** — Support for Bearer Token, Basic Auth, and API Key authentication.

- **Body Editor** — JSON, form-urlencoded, raw text body types with syntax indication.

- **Query Parameters** — Dedicated key-value editor for URL query parameters with enable/disable toggles.

---

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/dootn/api-pilot
cd api-pilot

# Install dependencies
npm install
cd webview-ui && npm install && cd ..

# Build
npm run build

# Press F5 in VS Code to launch Extension Development Host
```

### From VSIX

```bash
# Package the extension
npx vsce package

# Install the .vsix file
code --install-extension api-pilot-0.1.0.vsix
```

---

## Usage

### Quick Start

1. Click the **API Pilot** icon in the Activity Bar (left sidebar).
2. Click the `+` button or run `API Pilot: New Request` from the command palette.
3. Enter the URL, select the HTTP method, and click **Send**.
4. View the response in the bottom panel with status, time, and formatted body.

### Collections

- **Create**: Click the folder icon in the Collections tree header.
- **Add Folder**: Right-click a collection → "Add Folder".
- **Rename/Delete**: Right-click a collection to manage.

### Environment Variables

1. Run `API Pilot: Select Environment` from the command palette or click the status bar item.
2. Create a new environment or select an existing one.
3. Use `{{variable_name}}` in URLs, headers, and body. They'll be resolved at send time.

### cURL Import

1. Click the import icon in the History view, or run `API Pilot: Import cURL`.
2. Paste a cURL command — the request will be parsed and opened in a new tab.

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open Command Palette | `Ctrl+Shift+P` |
| New Request | Command Palette → `API Pilot: New Request` |

---

## Configuration

Data is stored in the workspace `.api-pilot/` directory:

```
.api-pilot/
├── collections/     # Collection JSON files
├── environments/    # Environment JSON files
└── history/         # History entries by date
```

> **Tip**: Add `.api-pilot/history/` to `.gitignore` if you don't want to track request history.

---

## Commands

| Command | Description |
|---------|-------------|
| `API Pilot: New Request` | Open a new request tab |
| `API Pilot: Open API Pilot` | Open the main panel |
| `API Pilot: New Collection` | Create a new collection |
| `API Pilot: Select Environment` | Select active environment |
| `API Pilot: Manage Environment Variables` | Edit environment variables |
| `API Pilot: Import cURL` | Import a cURL command |
| `API Pilot: Clear History` | Clear all request history |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension Host | TypeScript + VS Code Extension API |
| HTTP Client | [undici](https://github.com/nodejs/undici) |
| Webview UI | React 18 + TypeScript + Vite |
| State Management | [Zustand](https://github.com/pmndrs/zustand) |
| Build (Extension) | esbuild |
| Build (Webview) | Vite 5 |
| Testing | Vitest + React Testing Library |

---

## Project Structure

```
api-pilot/
├── src/                          # Extension source (Node.js)
│   ├── extension.ts              # Entry point
│   ├── handlers/
│   │   └── MessageHandler.ts     # Webview ↔ Extension message router
│   ├── providers/
│   │   ├── WebviewProvider.ts    # Webview panel management
│   │   ├── CollectionTreeProvider.ts  # Sidebar collection tree
│   │   ├── HistoryTreeProvider.ts     # Sidebar history tree
│   │   └── EnvStatusBarItem.ts   # Status bar environment display
│   ├── services/
│   │   ├── HttpClient.ts         # HTTP request engine
│   │   ├── StorageService.ts     # JSON file persistence
│   │   ├── CollectionService.ts  # Collection CRUD
│   │   ├── EnvService.ts         # Environment management
│   │   ├── HistoryService.ts     # Request history
│   │   ├── VariableResolver.ts   # {{var}} interpolation
│   │   ├── CurlParser.ts         # cURL → ApiRequest
│   │   └── CurlExporter.ts       # ApiRequest → cURL
│   └── types/
│       ├── index.ts              # Data models
│       └── messages.ts           # Message protocol
├── webview-ui/                   # React webview source
│   └── src/
│       ├── App.tsx               # Root component
│       ├── components/
│       │   ├── Layout/TabBar.tsx           # Multi-tab bar
│       │   ├── RequestPanel/              # Request editing
│       │   ├── ResponsePanel/             # Response display
│       │   └── shared/                    # Reusable components
│       ├── stores/
│       │   ├── tabStore.ts       # Multi-tab state
│       │   └── requestStore.ts   # Request state types
│       └── data/
│           └── httpHeaders.ts    # Header autocomplete data
├── dist/                         # Built extension
├── dist-webview/                 # Built webview
└── .api-pilot/                   # Workspace data (runtime)
```

---

## Testing

```bash
# Run all extension tests
npm test

# Run webview tests
cd webview-ui && npm test

# Watch mode
npm run test:watch
cd webview-ui && npm run test:watch
```

**Test Coverage**:
- Extension: 9 test suites, 139 tests (services, handlers, parsers)
- Webview: 5 test suites, 50 tests (stores, components, data)
- Total: **189 tests**

---

## License

MIT

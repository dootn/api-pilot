# API Pilot — Development Guide

---

## Setup

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

### Package as VSIX

```bash
npx vsce package
code --install-extension api-pilot-*.vsix
```

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

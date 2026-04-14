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
│   │   ├── MessageHandler.ts     # Webview ↔ Extension message router
│   │   ├── HandlerContext.ts     # Shared handler context type
│   │   ├── CollectionHandler.ts  # Collection operations handler
│   │   ├── EnvironmentHandler.ts # Environment operations handler
│   │   ├── HistoryHandler.ts     # History operations handler
│   │   ├── HttpRequestHandler.ts # HTTP/protocol request handler
│   │   └── SessionHandler.ts     # Session management handler
│   ├── providers/
│   │   ├── WebviewProvider.ts    # Webview panel management
│   │   ├── CollectionTreeProvider.ts  # Sidebar collection tree
│   │   ├── HistoryTreeProvider.ts     # Sidebar history tree
│   │   └── EnvStatusBarItem.ts   # Status bar environment display
│   ├── services/
│   │   ├── HttpClient.ts         # HTTP request engine
│   │   ├── WsClient.ts           # WebSocket client
│   │   ├── SseClient.ts          # SSE client
│   │   ├── MqttClient.ts         # MQTT client
│   │   ├── GrpcClient.ts         # gRPC client
│   │   ├── BaseConnectionClient.ts # Shared connection client base
│   │   ├── StorageService.ts     # JSON file persistence
│   │   ├── CollectionService.ts  # Collection CRUD
│   │   ├── EnvService.ts         # Environment management
│   │   ├── HistoryService.ts     # Request history
│   │   ├── VariableResolver.ts   # {{var}} interpolation
│   │   ├── ScriptRunner.ts       # Pre/post request scripts
│   │   ├── CurlParser.ts         # cURL → ApiRequest
│   │   ├── CurlExporter.ts       # ApiRequest → cURL
│   │   ├── UniversalParser.ts    # Multi-format import parser
│   │   └── contentTypeUtils.ts   # Content-Type helpers
│   └── types/
│       ├── index.ts              # Data models
│       └── messages.ts           # Message protocol
├── webview-ui/                   # React webview source
│   └── src/
│       ├── App.tsx               # Root component
│       ├── main.tsx              # React entry point
│       ├── vscode.ts             # VS Code API bridge
│       ├── components/
│       │   ├── Layout/
│       │   │   ├── TabBar.tsx             # Multi-tab bar
│       │   │   ├── TabContextMenu.tsx     # Tab right-click menu
│       │   │   ├── useTabDnD.ts           # Tab drag-and-drop
│       │   │   └── useTabScroll.ts        # Tab scroll overflow
│       │   ├── RequestPanel/
│       │   │   ├── RequestPanel.tsx        # Main request editor
│       │   │   ├── RequestTitle.tsx        # Editable request title
│       │   │   ├── RequestTabs.tsx         # Params/Headers/Body tabs
│       │   │   ├── UrlBar.tsx             # URL input + method selector
│       │   │   ├── ProtocolSelector.tsx   # HTTP/WS/SSE/MQTT/gRPC switch
│       │   │   ├── HeadersEditor.tsx      # Headers key-value editor
│       │   │   ├── AuthEditor.tsx         # Auth configuration
│       │   │   ├── BodyEditor.tsx         # Request body editor
│       │   │   ├── ScriptEditor.tsx       # Pre/post script editor
│       │   │   ├── ScriptDocs.tsx         # Script API documentation
│       │   │   ├── scriptExamples.ts      # Script example snippets
│       │   │   ├── SaveDialog.tsx         # Save to collection dialog
│       │   │   ├── CodeModal.tsx          # Code generation modal
│       │   │   ├── WsConversation.tsx     # WebSocket message view (virtualized)
│       │   │   ├── SseConversation.tsx    # SSE event stream view (virtualized)
│       │   │   ├── MqttPanel.tsx          # MQTT pub/sub panel (virtualized)
│       │   │   ├── MqttOptions.tsx        # MQTT connection options
│       │   │   ├── GrpcPanel.tsx          # gRPC streaming panel (virtualized)
│       │   │   ├── GrpcOptions.tsx        # gRPC service/method selector
│       │   │   ├── GrpcTemplateModal.tsx  # gRPC request template
│       │   │   ├── grpcUtils.ts           # gRPC helper utilities
│       │   │   └── useProtocolHandlers.ts # Protocol-specific send handlers
│       │   ├── ResponsePanel/
│       │   │   ├── ResponsePanel.tsx      # Response viewer container
│       │   │   ├── BodyViewer/            # Response body renderers (JSON, HTML, XML, Image, Markdown, Text)
│       │   │   ├── ConsoleTab.tsx         # Script console output
│       │   │   ├── SslTab.tsx             # TLS certificate info
│       │   │   ├── SyntaxHighlighter.tsx  # Code highlighting
│       │   │   ├── TestResultsTab.tsx     # Test assertion results
│       │   │   └── TimingTab.tsx          # Request timing breakdown
│       │   ├── Sidebar/
│       │   │   ├── CollectionsSidebar.tsx  # Collection tree browser
│       │   │   ├── CollectionContextMenu.tsx # Collection right-click menu
│       │   │   ├── HistorySidebar.tsx     # Request history browser
│       │   │   └── useCollectionDnD.ts    # Collection drag-and-drop
│       │   ├── EnvManager/
│       │   │   └── EnvManager.tsx         # Environment variable editor
│       │   └── shared/
│       │       ├── AutoComplete.tsx       # Autocomplete dropdown
│       │       ├── EmptyState.tsx         # Empty state placeholder
│       │       ├── FormDataEditor.tsx     # Form/multipart editor
│       │       ├── KeyValueEditor.tsx     # Generic key-value editor
│       │       ├── Modal.tsx              # Modal dialog
│       │       ├── TruncatedText.tsx      # Expandable truncated text
│       │       ├── bulkEditUtils.ts       # Bulk edit parsing
│       │       ├── useBulkEdit.ts         # Bulk edit hook
│       │       ├── ui.tsx                 # Legacy UI exports
│       │       └── ui/                    # UI component library (Button, Input, Select, Textarea, ToggleGroup)
│       ├── hooks/
│       │   ├── useAutoScroll.ts           # Auto-scroll hook (legacy)
│       │   ├── useClickOutside.ts         # Click-outside detection
│       │   ├── useCopyToClipboard.ts      # Copy to clipboard
│       │   ├── useEnvironments.ts         # Environment data hook
│       │   ├── useMessageHandler.ts       # Webview message handler
│       │   ├── useProtocolMode.ts         # Protocol mode detection
│       │   └── useVscodeMessage.ts        # VS Code message bridge
│       ├── stores/
│       │   ├── tabStore.ts       # Multi-tab state + useActiveTab
│       │   ├── requestStore.ts   # Request state types
│       │   ├── settingsStore.ts  # User settings state
│       │   └── localeStore.ts    # Locale/i18n state
│       ├── i18n/
│       │   └── index.ts          # Internationalization (en, zh-CN)
│       ├── utils/
│       │   ├── codeGenerators.ts # Code snippet generation
│       │   ├── constants.ts      # Shared constants
│       │   ├── formatters.ts     # Display formatters
│       │   ├── protocolColors.ts # Protocol color definitions
│       │   └── varHighlight.tsx  # Variable syntax highlighting
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

---

## NPM Scripts

### Extension Development

| Command | Description |
|---------|-------------|
| `npm run build` | Build extension and webview (production) |
| `npm run build:extension` | Build extension only (esbuild) |
| `npm run build:webview` | Build webview only (Vite) |
| `npm run watch` | Watch extension source and auto-recompile |
| `npm run dev:webview` | Start webview dev server (Vite HMR) |
| `npm test` | Run all extension tests |
| `npm run test:watch` | Extension tests watch mode |
| `npm run test:coverage` | Generate test coverage report |
| `npm run lint` | ESLint code linting |

### Webview Development

Same script commands are available in `webview-ui/` directory:
```bash
cd webview-ui
npm run dev              # Vite dev server
npm test                 # Run webview tests
npm run test:watch       # Test watch mode
npm run test:coverage    # Test coverage report
npm run build            # Production build
```

---

## Development Workflow

### 1. Extension Development

```bash
# Start extension watch compilation (one terminal)
npm run watch

# Meanwhile, start webview HMR dev server (another terminal)
cd webview-ui && npm run dev

# Press F5 in VS Code to launch extension debug host
# Code changes automatically hot-reload
```

### 2. Webview Development

During local development, webview connects to Vite dev server. Code changes automatically hot-reload (HMR) without manual refresh.

### 3. Running Tests

```bash
# Run tests in watch mode
npm run test:watch
cd webview-ui && npm run test:watch

# Check test coverage
npm run test:coverage
```

### 4. Debugging

- **Extension debugging**: Set breakpoints in VS Code debug view, press F5 to launch
- **Webview debugging**: Inspect and debug in dev tools (Ctrl+Shift+I in opened webview)

---

## Test Details

### Test Architecture

| Category | Framework | Environment |
|----------|-----------|-------------|
| Extension Unit Tests | Vitest | Node.js |
| Webview Unit Tests | Vitest + React Testing Library | jsdom |
| Integration Tests | Embedded in unit tests | Multi-env |

### Test File Structure

```
src/
  services/__tests__/
    - CurlParser.test.ts           - cURL parsing logic
    - HttpClient.test.ts           - HTTP request engine
    - CurlExporter.test.ts         - cURL export logic
    - CollectionService.test.ts    - Collection management
    - EnvService.test.ts           - Environment management
    - VariableResolver.test.ts     - Variable interpolation engine
    - StorageService.test.ts       - JSON persistence
    - HistoryService.test.ts       - History management

  handlers/__tests__/
    - MessageHandler.test.ts       - Webview ↔ Extension message routing

webview-ui/src/
  stores/__tests__/
    - tabStore.test.tsx
    - requestStore.test.tsx
    - settingsStore.test.tsx
    - localeStore.test.tsx
  
  components/__tests__/
    - Component unit tests
    - BodyViewer.test.tsx
    - Other component tests

  data/__tests__/
    - Data-related tests
```

### Running Specific Tests

```bash
# Run tests from specific file
npm test -- CurlParser.test.ts

# Run tests matching pattern
npm test -- --grep "should parse URL"

# Same for webview tests
cd webview-ui && npm test -- storeTests
```

---

## Troubleshooting & FAQ

### Issue: Webview Not Updating

**Solution**:
- Ensure `npm run dev:webview` is running
- Check browser console for errors
- Restart debug host (Ctrl+Shift+F5)

### Issue: TypeScript Errors

```bash
# Verify TypeScript configuration
npx tsc --noEmit                 # Extension
cd webview-ui && npx tsc --noEmit # Webview
```

### Issue: Some Tests Failing

- Ensure dependencies are properly installed: `npm install && cd webview-ui && npm install`
- Clear cache: `rm -rf node_modules package-lock.json && npm install`
- Some tests may fail intermittently due to timing or state sharing — re-run to confirm

### Issue: VSIX Packaging Failed

```bash
# Ensure vsce is installed
npm install -g @vscode/vsce

# Full build before packaging
npm run build
npx vsce package
```

### Issue: Keyboard Shortcut Conflicts

If F5 is occupied by other tools, customize debug launch key in `.vscode/launch.json`.

---

## License

MIT

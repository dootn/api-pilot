interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

class VsCodeWrapper {
  private readonly vsCodeApi: VsCodeApi;

  constructor() {
    if (typeof acquireVsCodeApi === 'function') {
      this.vsCodeApi = acquireVsCodeApi();
    } else {
      // Mock for development outside VS Code
      this.vsCodeApi = {
        postMessage: (msg) => console.log('postMessage:', msg),
        getState: () => undefined,
        setState: () => {},
      };
    }
  }

  postMessage(message: unknown): void {
    this.vsCodeApi.postMessage(message);
  }

  getState(): unknown {
    return this.vsCodeApi.getState();
  }

  setState(state: unknown): void {
    this.vsCodeApi.setState(state);
  }

  onMessage(callback: (message: MessageEvent) => void): () => void {
    window.addEventListener('message', callback);
    return () => window.removeEventListener('message', callback);
  }
}

export const vscode = new VsCodeWrapper();

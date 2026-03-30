import * as vscode from 'vscode';
import { EnvService } from '../services/EnvService';

export class EnvStatusBarItem {
  private statusBarItem: vscode.StatusBarItem;

  constructor(private envService: EnvService) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'apiPilot.selectEnvironment';
    this.update();
    this.statusBarItem.show();
  }

  update(): void {
    const activeId = this.envService.getActiveEnvId();
    if (activeId) {
      const env = this.envService.getById(activeId);
      this.statusBarItem.text = `$(globe) ${env?.name || 'Unknown'}`;
      this.statusBarItem.tooltip = 'API Pilot: Click to switch environment';
    } else {
      this.statusBarItem.text = '$(globe) No Environment';
      this.statusBarItem.tooltip = 'API Pilot: Click to select an environment';
    }
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}

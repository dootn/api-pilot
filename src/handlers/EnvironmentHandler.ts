import { HandlerContext } from './HandlerContext';
import { Environment } from '../types';

export class EnvironmentHandler {
  constructor(private ctx: HandlerContext) {}

  handleGetEnvironments(): void {
    if (!this.ctx.envService) {
      this.ctx.webview.postMessage({ type: 'environments', payload: [] });
      return;
    }
    const envs = this.ctx.envService.getAll();
    const activeId = this.ctx.envService.getActiveEnvId();
    this.ctx.webview.postMessage({
      type: 'environments',
      payload: { environments: envs, activeEnvId: activeId },
    });
  }

  handleSetActiveEnv(envId: string | null): void {
    if (!this.ctx.envService) return;
    this.ctx.envService.setActiveEnvId(envId);
    this.ctx.webview.postMessage({
      type: 'activeEnvChanged',
      payload: { activeEnvId: envId },
    });
  }

  handleCreateEnvironment(name: string): void {
    if (!this.ctx.envService) return;
    const env = this.ctx.envService.create(name.trim() || 'New Environment');
    this.ctx.envService.setActiveEnvId(env.id);
    this.broadcastEnvironments();
  }

  handleUpdateEnvironment(env: Environment): void {
    if (!this.ctx.envService) return;
    this.ctx.envService.update(env);
    this.broadcastEnvironments();
  }

  handleDeleteEnvironment(id: string): void {
    if (!this.ctx.envService) return;
    const activeId = this.ctx.envService.getActiveEnvId();
    this.ctx.envService.delete(id);
    if (activeId === id) {
      this.ctx.envService.setActiveEnvId(null);
    }
    this.broadcastEnvironments();
  }

  broadcastEnvironments(): void {
    if (!this.ctx.envService) return;
    const envs = this.ctx.envService.getAll();
    const activeId = this.ctx.envService.getActiveEnvId();
    this.ctx.webview.postMessage({
      type: 'environments',
      payload: { environments: envs, activeEnvId: activeId },
    });
  }
}

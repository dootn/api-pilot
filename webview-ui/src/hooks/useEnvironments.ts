import { useState, useEffect } from 'react';
import { vscode } from '../vscode';

export interface EnvInfo {
  id: string;
  name: string;
  variables: { key: string; value: string; enabled: boolean }[];
  createdAt: number;
  updatedAt: number;
}

export function useEnvironments() {
  const [environments, setEnvironments] = useState<EnvInfo[]>([]);
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'environments') {
        const { environments: envs, activeEnvId: aid } = msg.payload as {
          environments: EnvInfo[];
          activeEnvId: string | null;
        };
        setEnvironments(envs);
        setActiveEnvId(aid);
      } else if (msg.type === 'activeEnvChanged') {
        setActiveEnvId((msg.payload as { activeEnvId: string | null }).activeEnvId);
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ type: 'getEnvironments' });
    return () => window.removeEventListener('message', handler);
  }, []);

  const switchEnv = (id: string | null) => {
    setActiveEnvId(id);
    vscode.postMessage({ type: 'setActiveEnv', payload: id });
  };

  return { environments, activeEnvId, switchEnv };
}

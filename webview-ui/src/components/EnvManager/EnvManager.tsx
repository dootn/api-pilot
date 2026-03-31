import { useState, useEffect, useRef } from 'react';
import { vscode } from '../../vscode';
import { KeyValueEditor } from '../shared/KeyValueEditor';
import type { KeyValuePair } from '../../stores/requestStore';

interface Environment {
  id: string;
  name: string;
  variables: KeyValuePair[];
  createdAt: number;
  updatedAt: number;
}

interface Props {
  onClose: () => void;
}

export function EnvManager({ onClose }: Props) {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null);
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftVars, setDraftVars] = useState<KeyValuePair[]>([{ key: '', value: '', enabled: true }]);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Listen for environment updates from the extension
  useEffect(() => {
    const cleanup = vscode.onMessage((event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'environments') {
        const { environments: envs, activeEnvId: aid } = msg.payload as {
          environments: Environment[];
          activeEnvId: string | null;
        };
        setEnvironments(envs);
        setActiveEnvId(aid);
      }
    });
    // Request initial data
    vscode.postMessage({ type: 'getEnvironments' });
    return cleanup;
  }, []);

  // When environments load, select the active one (or first)
  useEffect(() => {
    if (environments.length === 0) {
      setSelectedEnvId(null);
      return;
    }
    const target = environments.find((e) => e.id === activeEnvId) ?? environments[0];
    if (!selectedEnvId || !environments.find((e) => e.id === selectedEnvId)) {
      selectEnv(target);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environments]);

  function selectEnv(env: Environment) {
    setSelectedEnvId(env.id);
    setDraftName(env.name);
    setDraftVars(
      env.variables.length > 0
        ? [...env.variables, { key: '', value: '', enabled: true }]
        : [{ key: '', value: '', enabled: true }]
    );
    setIsDirty(false);
    setConfirmDeleteId(null);
  }

  function handleCreate() {
    vscode.postMessage({ type: 'createEnvironment', payload: { name: 'New Environment' } });
  }

  function handleSave() {
    if (!selectedEnvId) return;
    const env = environments.find((e) => e.id === selectedEnvId);
    if (!env) return;
    const updated: Environment = {
      ...env,
      name: draftName.trim() || env.name,
      variables: draftVars.filter((v) => v.key.trim()),
    };
    vscode.postMessage({ type: 'updateEnvironment', payload: { env: updated } });
    setIsDirty(false);
  }

  function handleDelete(id: string) {
    vscode.postMessage({ type: 'deleteEnvironment', payload: { id } });
    setConfirmDeleteId(null);
    setSelectedEnvId(null);
  }

  function handleSetActive(envId: string) {
    const newId = activeEnvId === envId ? null : envId;
    setActiveEnvId(newId);
    vscode.postMessage({ type: 'setActiveEnv', payload: newId });
  }

  function startRename(env: Environment, e: React.MouseEvent) {
    e.stopPropagation();
    setRenamingId(env.id);
    setRenameValue(env.name);
  }

  function commitRename() {
    if (!renamingId) return;
    const env = environments.find((e) => e.id === renamingId);
    if (env && renameValue.trim() && renameValue.trim() !== env.name) {
      const updated = { ...env, name: renameValue.trim() };
      vscode.postMessage({ type: 'updateEnvironment', payload: { env: updated } });
      // Also update draftName if this env is currently selected
      if (selectedEnvId === renamingId) {
        setDraftName(renameValue.trim());
      }
    }
    setRenamingId(null);
  }

  function cancelRename() {
    setRenamingId(null);
  }

  const selectedEnv = environments.find((e) => e.id === selectedEnvId);

  return (
    <div
      className="env-manager-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="env-manager-panel">
        {/* Header */}
        <div className="env-manager-header">
          <span style={{ fontWeight: 600, fontSize: 13 }}>Environments</span>
          <button className="env-manager-close" onClick={onClose} title="Close">×</button>
        </div>

        <div className="env-manager-body">
          {/* Left: environment list */}
          <div className="env-list">
            <div className="env-list-header">
              <span style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase' }}>Environments</span>
              <button className="env-add-btn" onClick={handleCreate} title="New Environment">+ New</button>
            </div>
            {environments.length === 0 && (
              <div style={{ padding: '12px 8px', fontSize: 12, opacity: 0.5 }}>No environments yet</div>
            )}
            {environments.map((env) => (
              <div
                key={env.id}
                className={`env-list-item ${env.id === selectedEnvId ? 'selected' : ''}`}
                onClick={() => selectEnv(env)}
              >
                <button
                  className={`env-active-btn ${env.id === activeEnvId ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); handleSetActive(env.id); }}
                  title={env.id === activeEnvId ? 'Deactivate' : 'Set as active'}
                >
                  {env.id === activeEnvId ? '●' : '○'}
                </button>

                {renamingId === env.id ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      else if (e.key === 'Escape') cancelRename();
                      e.stopPropagation();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      flex: 1,
                      fontSize: 12,
                      background: 'var(--input-bg)',
                      color: 'var(--panel-fg)',
                      border: '1px solid var(--button-bg)',
                      borderRadius: 3,
                      padding: '1px 4px',
                      outline: 'none',
                      minWidth: 0,
                    }}
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => startRename(env, e)}
                    title="Double-click to rename"
                    style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}
                  >
                    {env.name}
                  </span>
                )}

                <span style={{ fontSize: 10, opacity: 0.5 }}>{env.variables.length}v</span>
              </div>
            ))}
          </div>

          {/* Right: variable editor */}
          <div className="env-editor">
            {!selectedEnv ? (
              <div className="empty-state" style={{ padding: 24 }}>
                Select or create an environment
              </div>
            ) : (
              <>
                <div className="env-editor-top">
                  <input
                    ref={nameInputRef}
                    className="env-name-input"
                    value={draftName}
                    onChange={(e) => { setDraftName(e.target.value); setIsDirty(true); }}
                    placeholder="Environment name"
                    spellCheck={false}
                  />
                  {isDirty && (
                    <span style={{ fontSize: 10, color: 'var(--warning-fg)', marginLeft: 6 }}>unsaved</span>
                  )}
                </div>

                <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
                  <KeyValueEditor
                    items={draftVars}
                    onChange={(vars) => { setDraftVars(vars); setIsDirty(true); }}
                    keyPlaceholder="Variable name"
                    valuePlaceholder="Value"
                  />
                </div>

                <div className="env-editor-footer">
                  {confirmDeleteId === selectedEnv.id ? (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--error-fg)', marginRight: 8 }}>Delete "{selectedEnv.name}"?</span>
                      <button className="env-btn env-btn-danger" onClick={() => handleDelete(selectedEnv.id)}>Delete</button>
                      <button className="env-btn" onClick={() => setConfirmDeleteId(null)} style={{ marginLeft: 4 }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button
                        className="env-btn"
                        onClick={() => setConfirmDeleteId(selectedEnv.id)}
                        style={{ color: 'var(--error-fg)', border: '1px solid var(--error-fg)', marginRight: 'auto' }}
                      >
                        🗑 Delete
                      </button>
                      <button className="env-btn" onClick={() => selectEnv(selectedEnv)} disabled={!isDirty}>
                        Discard
                      </button>
                      <button className="env-btn env-btn-primary" onClick={handleSave} disabled={!isDirty} style={{ marginLeft: 6 }}>
                        💾 Save
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

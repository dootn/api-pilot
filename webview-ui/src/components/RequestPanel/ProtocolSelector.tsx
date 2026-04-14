import type { HttpMethod, Protocol } from '../../stores/requestStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getProtocolColor } from '../../utils/protocolColors';
import { Select, Option } from '../shared/ui';

const DEFAULT_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

const METHOD_CLASSES: Record<string, string> = {
  GET: 'method-get',
  POST: 'method-post',
  PUT: 'method-put',
  DELETE: 'method-delete',
  PATCH: 'method-patch',
  OPTIONS: 'method-options',
  HEAD: 'method-head',
};

export function ProtocolSelector({
  protocol,
  onChange,
}: {
  protocol: Protocol | undefined;
  onChange: (p: Protocol) => void;
}) {
  return (
    <Select
      className="protocol-select"
      value={protocol ?? 'http'}
      onChange={(e) => onChange(e.target.value as Protocol)}
      style={{ color: getProtocolColor(protocol) }}
    >
      <Option value="http">HTTP</Option>
      <Option value="websocket">WS</Option>
      <Option value="sse">SSE</Option>
      <Option value="mqtt">MQTT</Option>
      <Option value="grpc">gRPC</Option>
    </Select>
  );
}

export function MethodSelector({
  method,
  onChange,
}: {
  method: HttpMethod;
  onChange: (m: HttpMethod) => void;
}) {
  const customHttpMethods = useSettingsStore((s) => s.customHttpMethods);

  return (
    <Select
      className={`method-select ${METHOD_CLASSES[method] || 'method-get'}`}
      value={method}
      onChange={(e) => onChange(e.target.value as HttpMethod)}
    >
      {DEFAULT_METHODS.map((m) => (
        <Option key={m} value={m}>{m}</Option>
      ))}
      {customHttpMethods.filter((m) => !DEFAULT_METHODS.includes(m as HttpMethod)).map((m) => (
        <Option key={m} value={m}>{m}</Option>
      ))}
      {!DEFAULT_METHODS.includes(method as any) &&
        !customHttpMethods.includes(method) &&
        (method as string) !== '__custom__' && (
        <Option key={method} value={method}>{method}</Option>
      )}
    </Select>
  );
}

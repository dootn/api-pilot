import { useMemo } from 'react';
import type { Protocol } from '../stores/requestStore';

export interface ProtocolMode {
  isHttp: boolean;
  isWs: boolean;
  isSse: boolean;
  isMqtt: boolean;
  isGrpc: boolean;
  isConnectionProtocol: boolean;
}

export function useProtocolMode(protocol?: Protocol): ProtocolMode {
  return useMemo(() => {
    const isWs = protocol === 'websocket';
    const isSse = protocol === 'sse';
    const isMqtt = protocol === 'mqtt';
    const isGrpc = protocol === 'grpc';
    return {
      isHttp: !isWs && !isSse && !isMqtt && !isGrpc,
      isWs,
      isSse,
      isMqtt,
      isGrpc,
      isConnectionProtocol: isWs || isSse || isMqtt || isGrpc,
    };
  }, [protocol]);
}

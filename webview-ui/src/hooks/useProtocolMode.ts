import { useMemo } from 'react';
import type { Protocol } from '../stores/requestStore';

export interface ProtocolMode {
  isHttp: boolean;
  isWs: boolean;
  isSse: boolean;
  isMqtt: boolean;
  isGrpc: boolean;
  isDns: boolean;
  isRedis: boolean;
  isConnectionProtocol: boolean;
}

export function useProtocolMode(protocol?: Protocol): ProtocolMode {
  return useMemo(() => {
    const isWs = protocol === 'websocket';
    const isSse = protocol === 'sse';
    const isMqtt = protocol === 'mqtt';
    const isGrpc = protocol === 'grpc';
    const isDns = protocol === 'dns';
    const isRedis = protocol === 'redis';
    return {
      isHttp: !isWs && !isSse && !isMqtt && !isGrpc && !isDns && !isRedis,
      isWs,
      isSse,
      isMqtt,
      isGrpc,
      isDns,
      isRedis,
      isConnectionProtocol: isWs || isSse || isMqtt || isGrpc || isRedis,
    };
  }, [protocol]);
}

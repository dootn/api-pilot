import type { GrpcMethodDef, GrpcMessageDef } from '../../stores/requestStore';
import type { TranslationKey } from '../../i18n';

export const SECTION_STYLE: React.CSSProperties = {
  marginBottom: 16,
};

export function callTypeLabel(m: GrpcMethodDef, t: (key: TranslationKey) => string): string {
  if (m.requestStream && m.responseStream) return t('grpcCallTypeBidi');
  if (m.requestStream) return t('grpcCallTypeClient');
  if (m.responseStream) return t('grpcCallTypeServer');
  return t('grpcCallTypeUnary');
}

export function generateTemplate(
  typeName: string,
  messageDefs: Record<string, GrpcMessageDef>,
  depth = 0
): unknown {
  if (depth > 5) return {};
  const cleanName = typeName.replace(/^\./, '');
  const def = messageDefs[cleanName];
  if (!def) return {};
  const obj: Record<string, unknown> = {};
  for (const field of def.fields) {
    const val = generateFieldValue(field.typeName, messageDefs, depth + 1);
    obj[field.name] = field.repeated ? [val] : val;
  }
  return obj;
}

function generateFieldValue(
  typeName: string,
  messageDefs: Record<string, GrpcMessageDef>,
  depth: number
): unknown {
  switch (typeName) {
    case 'string': return '';
    case 'bool': return false;
    case 'bytes': return '';
    case 'double': case 'float': return 0.0;
    case 'int32': case 'int64': case 'uint32': case 'uint64':
    case 'sint32': case 'sint64': case 'fixed32': case 'fixed64':
    case 'sfixed32': case 'sfixed64': return 0;
    default: return generateTemplate(typeName, messageDefs, depth);
  }
}

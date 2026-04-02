import type { StyleProps } from 'react-json-view-lite/dist/DataRenderer';

export const vscodeJsonStyle: Partial<StyleProps> = {
  container: 'json-vsc-container',
  basicChildStyle: 'json-vsc-child',
  label: 'json-vsc-label',
  clickableLabel: 'json-vsc-label-clickable',
  nullValue: 'json-vsc-null',
  undefinedValue: 'json-vsc-undef',
  numberValue: 'json-vsc-number',
  stringValue: 'json-vsc-string',
  booleanValue: 'json-vsc-boolean',
  otherValue: 'json-vsc-other',
  punctuation: 'json-vsc-punct',
  expandIcon: 'json-vsc-expand',
  collapseIcon: 'json-vsc-collapse',
  collapsedContent: 'json-vsc-collapsed',
  childFieldsContainer: 'json-vsc-children',
};

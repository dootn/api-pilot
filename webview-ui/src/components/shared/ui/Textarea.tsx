import { forwardRef } from 'react';
import { cls } from './utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Monospace code font */
  code?: boolean;
  /** Stretch to fill available width */
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, code, fullWidth, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cls(
        'ui-textarea',
        code && 'ui-textarea-code',
        fullWidth && 'ui-full-width',
        className,
      )}
      spellCheck={false}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

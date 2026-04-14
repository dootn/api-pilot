import { forwardRef } from 'react';
import { cls, type Size } from './utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** sm = compact (11px), md = default (12px), lg = larger (13px) */
  inputSize?: Size;
  /** Stretch to fill available width */
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, inputSize, fullWidth, ...props }, ref) => (
    <input
      ref={ref}
      className={cls(
        'ui-input',
        inputSize && `ui-input-${inputSize}`,
        fullWidth && 'ui-full-width',
        className,
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

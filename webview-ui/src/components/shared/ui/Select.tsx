import { forwardRef } from 'react';
import { cls, type Size } from './utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  inputSize?: Size;
  fullWidth?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, inputSize, fullWidth, ...props }, ref) => (
    <select
      ref={ref}
      className={cls(
        'ui-select',
        inputSize && `ui-select-${inputSize}`,
        fullWidth && 'ui-full-width',
        className,
      )}
      {...props}
    />
  )
);
Select.displayName = 'Select';

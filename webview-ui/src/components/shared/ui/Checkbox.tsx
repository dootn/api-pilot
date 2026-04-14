import { forwardRef } from 'react';
import { cls } from './utils';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cls('ui-checkbox', className)}
      {...props}
    />
  )
);
Checkbox.displayName = 'Checkbox';

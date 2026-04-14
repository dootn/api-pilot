import { forwardRef } from 'react';
import { cls, type Size } from './utils';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** sm = compact, md = default, lg = larger */
  btnSize?: Size;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', className, btnSize, fullWidth, ...props }, ref) => (
    <button
      ref={ref}
      className={cls(
        'ui-btn',
        `ui-btn-${variant}`,
        btnSize && `ui-btn-${btnSize}`,
        fullWidth && 'ui-full-width',
        className,
      )}
      {...props}
    />
  )
);
Button.displayName = 'Button';

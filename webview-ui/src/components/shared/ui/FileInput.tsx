import { forwardRef } from 'react';
import { cls } from './utils';

export interface FileInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {}

export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="file"
      className={cls('ui-file-input', className)}
      {...props}
    />
  )
);
FileInput.displayName = 'FileInput';

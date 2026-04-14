import { forwardRef } from 'react';

export interface OptionProps extends React.OptionHTMLAttributes<HTMLOptionElement> {}

export const Option = forwardRef<HTMLOptionElement, OptionProps>(
  (props, ref) => (
    <option ref={ref} {...props} />
  )
);
Option.displayName = 'Option';

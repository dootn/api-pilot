import { cls } from './utils';

interface ToggleOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface ToggleGroupProps<T extends string> {
  options: ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function ToggleGroup<T extends string>({ options, value, onChange, className }: ToggleGroupProps<T>) {
  return (
    <div className={cls('ui-toggle-group', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={cls('ui-toggle-btn', opt.value === value && 'active')}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

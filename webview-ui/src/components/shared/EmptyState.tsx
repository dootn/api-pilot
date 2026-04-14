interface EmptyStateProps {
  icon?: string;
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  padding?: string | number;
}

export function EmptyState({ icon, title, subtitle, children, padding }: EmptyStateProps) {
  return (
    <div className="empty-state" style={padding != null ? { padding } : undefined}>
      {icon && <div className="empty-state-icon">{icon}</div>}
      {title && <div className="empty-state-title">{title}</div>}
      {subtitle && <div className="empty-state-subtitle text-secondary">{subtitle}</div>}
      {children}
    </div>
  );
}

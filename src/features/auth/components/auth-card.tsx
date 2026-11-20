import type { ReactNode } from "react";

type AuthCardProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </header>
      {children}
      {footer ? <div className="text-center text-sm text-muted-foreground">{footer}</div> : null}
    </div>
  );
}

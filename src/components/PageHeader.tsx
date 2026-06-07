import type { ReactNode } from 'react';

type PageHeaderProps = {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export default function PageHeader({
  kicker,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        {kicker ? <p className="page-kicker">{kicker}</p> : null}
        <h1 className="page-title">{title}</h1>
        {description ? (
          <p className="page-description">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="table-actions">{actions}</div> : null}
    </div>
  );
}

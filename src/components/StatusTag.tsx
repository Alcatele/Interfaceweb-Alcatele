import { Badge, Tag } from 'antd';

type StatusTagProps = {
  status:
    | 'online'
    | 'offline'
    | 'warning'
    | 'active'
    | 'inactive'
    | 'registered'
    | 'failed';
  label?: string;
};

const statusMap: Record<StatusTagProps['status'], { color: string; text: string }> = {
  online: { color: 'success', text: 'Online' },
  offline: { color: 'default', text: 'Offline' },
  warning: { color: 'warning', text: 'Atenção' },
  active: { color: 'processing', text: 'Ativo' },
  inactive: { color: 'default', text: 'Inativo' },
  registered: { color: 'success', text: 'Registrado' },
  failed: { color: 'error', text: 'Falha' },
};

export default function StatusTag({ status, label }: StatusTagProps) {
  const config = statusMap[status];

  return (
    <Tag color={config.color}>
      <Badge status={config.color === 'default' ? 'default' : undefined} />
      {label ?? config.text}
    </Tag>
  );
}

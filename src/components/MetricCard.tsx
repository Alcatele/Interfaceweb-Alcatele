import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { Card, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';

type Trend = {
  value: string;
  direction: 'up' | 'down' | 'flat';
  tone?: 'success' | 'warning' | 'error' | 'default';
};

type MetricCardProps = {
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  trend?: Trend;
};

export default function MetricCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  trend,
}: MetricCardProps) {
  return (
    <Card className="metric-card soft-panel">
      <div className="metric-topline">
        <span
          className="metric-icon"
          style={{ background: iconBg, color: iconColor }}
        >
          {icon}
        </span>
        {trend ? (
          <Tag
            color={trend.tone === 'default' ? undefined : trend.tone}
            icon={
              trend.direction === 'up' ? (
                <ArrowUpOutlined />
              ) : trend.direction === 'down' ? (
                <ArrowDownOutlined />
              ) : undefined
            }
          >
            {trend.value}
          </Tag>
        ) : null}
      </div>
      <Typography.Paragraph className="metric-value">{value}</Typography.Paragraph>
      <Typography.Paragraph className="metric-label">{label}</Typography.Paragraph>
    </Card>
  );
}

import { SafetyCertificateOutlined, StopOutlined } from '@ant-design/icons';
import { Button, Card, Col, Row, Space, Switch, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import MetricCard from '../components/MetricCard';
import PageHeader from '../components/PageHeader';
import type { AuditEvent, SecurityRule } from '../services/mockData';
import { auditEvents, securityRules } from '../services/mockData';

const severityColor: Record<AuditEvent['severity'], string> = {
  info: 'processing',
  warning: 'warning',
  critical: 'error',
};

export default function SecurityAudit() {
  const [rules, setRules] = useState<SecurityRule[]>(securityRules);
  const [messageApi, contextHolder] = message.useMessage();

  function toggleRule(ruleId: string, enabled: boolean) {
    setRules((current) =>
      current.map((rule) =>
        rule.id === ruleId
          ? { ...rule, enabled, status: enabled ? 'ok' : 'attention' }
          : rule,
      ),
    );
    messageApi.success(enabled ? 'Regra ativada.' : 'Regra desativada.');
  }

  function blockIp(event: AuditEvent) {
    messageApi.success(`IP ${event.ip} enviado para bloqueio.`);
  }

  const ruleColumns: ColumnsType<SecurityRule> = [
    { title: 'Regra', dataIndex: 'name', key: 'name' },
    { title: 'Descrição', dataIndex: 'description', key: 'description' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: SecurityRule['status']) => (
        <Tag color={status === 'ok' ? 'success' : 'warning'}>
          {status === 'ok' ? 'OK' : 'Atenção'}
        </Tag>
      ),
    },
    {
      title: 'Ativa',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean, rule) => (
        <Switch checked={enabled} onChange={(checked) => toggleRule(rule.id, checked)} />
      ),
    },
  ];

  const auditColumns: ColumnsType<AuditEvent> = [
    { title: 'Data', dataIndex: 'date', key: 'date' },
    { title: 'Usuário', dataIndex: 'user', key: 'user' },
    { title: 'Módulo', dataIndex: 'module', key: 'module' },
    { title: 'Ação', dataIndex: 'action', key: 'action' },
    { title: 'IP', dataIndex: 'ip', key: 'ip' },
    {
      title: 'Severidade',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity: AuditEvent['severity']) => (
        <Tag color={severityColor[severity]}>
          {severity === 'info' ? 'Informação' : severity === 'warning' ? 'Atenção' : 'Crítica'}
        </Tag>
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, event) => (
        <Button
          disabled={event.severity === 'info'}
          icon={<StopOutlined />}
          onClick={() => blockIp(event)}
        >
          Bloquear IP
        </Button>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <PageHeader
        kicker="Proteção"
        title="Segurança e auditoria"
        description="Acompanhe eventos, políticas antifraude, MFA, criptografia e bloqueios por IP."
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <MetricCard
            icon={<SafetyCertificateOutlined />}
            iconBg="#dcfce7"
            iconColor="#15803d"
            label="Regras ativas"
            value={String(rules.filter((rule) => rule.enabled).length)}
          />
        </Col>
        <Col xs={24} md={8}>
          <MetricCard
            icon={<StopOutlined />}
            iconBg="#fee2e2"
            iconColor="#b91c1c"
            label="Eventos críticos"
            value={String(auditEvents.filter((event) => event.severity === 'critical').length)}
          />
        </Col>
        <Col xs={24} md={8}>
          <MetricCard
            icon={<StopOutlined />}
            iconBg="#fef3c7"
            iconColor="#b45309"
            label="IPs monitorados"
            value={String(auditEvents.length)}
          />
        </Col>
      </Row>

      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card className="soft-panel" title="Políticas de segurança">
          <Table columns={ruleColumns} dataSource={rules} pagination={false} rowKey="id" />
        </Card>

        <Card className="soft-panel" title="Auditoria">
          <Table columns={auditColumns} dataSource={auditEvents} pagination={false} rowKey="id" />
        </Card>
      </Space>
    </>
  );
}

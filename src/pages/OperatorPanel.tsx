import {
  AudioMutedOutlined,
  ExportOutlined,
  PhoneOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Row, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import MetricCard from '../components/MetricCard';
import PageHeader from '../components/PageHeader';
import type { ActiveCall, Extension } from '../services/mockData';
import { activeCalls, extensions } from '../services/mockData';

const callStatusColor: Record<ActiveCall['status'], string> = {
  Tocando: 'processing',
  'Em atendimento': 'success',
  'Em espera': 'warning',
  Estacionada: 'default',
};

const extensionStatusColor: Record<Extension['status'], string> = {
  online: 'success',
  offline: 'default',
  warning: 'warning',
};

export default function OperatorPanel() {
  const [messageApi, contextHolder] = message.useMessage();

  function operatorAction(action: string, target: string) {
    messageApi.success(`${action} aplicado em ${target}.`);
  }

  const callColumns: ColumnsType<ActiveCall> = [
    { title: 'Origem', dataIndex: 'caller', key: 'caller' },
    { title: 'Destino', dataIndex: 'callee', key: 'callee' },
    { title: 'Fila', dataIndex: 'queue', key: 'queue' },
    { title: 'Duração', dataIndex: 'duration', key: 'duration' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: ActiveCall['status']) => (
        <Tag color={callStatusColor[status]}>{status}</Tag>
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, call) => (
        <Space>
          <Button
            aria-label="Transferir"
            title="Transferir"
            icon={<SwapOutlined />}
            onClick={() => operatorAction('Transferência', call.caller)}
          />
          <Button
            aria-label="Estacionar"
            title="Estacionar"
            icon={<ExportOutlined />}
            onClick={() => operatorAction('Estacionamento', call.caller)}
          />
          <Button
            aria-label="Silenciar gravação"
            title="Silenciar gravação"
            icon={<AudioMutedOutlined />}
            onClick={() => operatorAction('Pausa de gravação', call.caller)}
          />
        </Space>
      ),
    },
  ];

  const extensionColumns: ColumnsType<Extension> = [
    { title: 'Ramal', dataIndex: 'number', key: 'number' },
    { title: 'Usuário', dataIndex: 'name', key: 'name' },
    { title: 'Departamento', dataIndex: 'department', key: 'department' },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (status: Extension['status']) => (
        <Tag color={extensionStatusColor[status]}>
          {status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Atenção'}
        </Tag>
      ),
    },
    {
      title: 'Ação rápida',
      key: 'actions',
      render: (_, extension) => (
        <Button
          icon={<PhoneOutlined />}
          onClick={() => operatorAction('Chamada', extension.number)}
          title={`Chamar ramal ${extension.number}`}
        >
          Chamar
        </Button>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <PageHeader
        kicker="Recepção"
        title="Painel de operador"
        description="Monitore ramais e chamadas ativas, transfira, estacione e acione usuários rapidamente."
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <MetricCard
            icon={<PhoneOutlined />}
            iconBg="#dcfce7"
            iconColor="#15803d"
            label="Chamadas ativas"
            value={String(activeCalls.length)}
          />
        </Col>
        <Col xs={24} md={8}>
          <MetricCard
            icon={<PhoneOutlined />}
            iconBg="#dbeafe"
            iconColor="#1d4ed8"
            label="Ramais online"
            value={String(extensions.filter((item) => item.status === 'online').length)}
          />
        </Col>
        <Col xs={24} md={8}>
          <MetricCard
            icon={<ExportOutlined />}
            iconBg="#fef3c7"
            iconColor="#b45309"
            label="Em espera"
            value={String(activeCalls.filter((item) => item.status === 'Em espera').length)}
          />
        </Col>
      </Row>

      <Card className="soft-panel" style={{ marginBottom: 16 }} title="Chamadas em curso">
        <Table columns={callColumns} dataSource={activeCalls} pagination={false} rowKey="id" />
      </Card>

      <Card className="soft-panel" title="Ramais e presença">
        <Typography.Paragraph type="secondary">
          Use esta visão para recepção, telefonista ou operação centralizada.
        </Typography.Paragraph>
        <Table columns={extensionColumns} dataSource={extensions} pagination={false} rowKey="id" />
      </Card>
    </>
  );
}

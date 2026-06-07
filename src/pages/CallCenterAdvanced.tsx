import {
  BarChartOutlined,
  CustomerServiceOutlined,
  PhoneOutlined,
  SoundOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Progress, Row, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import MetricCard from '../components/MetricCard';
import PageHeader from '../components/PageHeader';
import type { CallCenterMetric } from '../services/mockData';
import { callCenterMetrics } from '../services/mockData';

export default function CallCenterAdvanced() {
  const [messageApi, contextHolder] = message.useMessage();
  const totalWaiting = callCenterMetrics.reduce((sum, metric) => sum + metric.waiting, 0);
  const totalCallbacks = callCenterMetrics.reduce(
    (sum, metric) => sum + metric.callbackRequests,
    0,
  );
  const avgServiceLevel = Math.round(
    callCenterMetrics.reduce((sum, metric) => sum + metric.serviceLevel, 0) /
      callCenterMetrics.length,
  );

  function action(name: string, queue: string) {
    messageApi.success(`${name} ativado para a fila ${queue}.`);
  }

  const columns: ColumnsType<CallCenterMetric> = [
    { title: 'Fila', dataIndex: 'queue', key: 'queue' },
    {
      title: 'SLA',
      dataIndex: 'serviceLevel',
      key: 'serviceLevel',
      render: (value: number) => (
        <Progress percent={value} size="small" status={value >= 90 ? 'success' : 'active'} />
      ),
    },
    { title: 'Aguardando', dataIndex: 'waiting', key: 'waiting' },
    { title: 'Maior espera', dataIndex: 'longestWait', key: 'longestWait' },
    { title: 'Atendidas', dataIndex: 'answered', key: 'answered' },
    { title: 'Abandonadas', dataIndex: 'abandoned', key: 'abandoned' },
    { title: 'Callbacks', dataIndex: 'callbackRequests', key: 'callbackRequests' },
    { title: 'TMA', dataIndex: 'avgTalkTime', key: 'avgTalkTime' },
    { title: 'Pós-atendimento', dataIndex: 'avgWrapUp', key: 'avgWrapUp' },
    {
      title: 'Recursos',
      key: 'actions',
      render: (_, metric) => (
        <Space>
          <Button
            icon={<PhoneOutlined />}
            onClick={() => action('Callback automático', metric.queue)}
          >
            Callback
          </Button>
          <Button
            icon={<SoundOutlined />}
            onClick={() => action('Escuta assistida', metric.queue)}
          >
            Escutar
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <PageHeader
        kicker="Contact center"
        title="Central de atendimento"
        description="Acompanhe SLA, callbacks, abandono, espera e recursos de supervisão por fila."
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <MetricCard
            icon={<PhoneOutlined />}
            iconBg="#fef3c7"
            iconColor="#b45309"
            label="Chamadas aguardando"
            value={String(totalWaiting)}
          />
        </Col>
        <Col xs={24} md={8}>
          <MetricCard
            icon={<BarChartOutlined />}
            iconBg="#dbeafe"
            iconColor="#1d4ed8"
            label="SLA médio"
            value={`${avgServiceLevel}%`}
          />
        </Col>
        <Col xs={24} md={8}>
          <MetricCard
            icon={<CustomerServiceOutlined />}
            iconBg="#dcfce7"
            iconColor="#15803d"
            label="Callbacks pendentes"
            value={String(totalCallbacks)}
          />
        </Col>
      </Row>

      <Card className="soft-panel" title="Wallboard de filas">
        <Table
          columns={columns}
          dataSource={callCenterMetrics}
          pagination={false}
          rowKey="id"
        />
      </Card>

      <Card className="soft-panel" style={{ marginTop: 16 }} title="Recursos disponíveis">
        <Space wrap>
          <Tag color="processing">Callback de fila</Tag>
          <Tag color="processing">Escuta</Tag>
          <Tag color="processing">Sussurro</Tag>
          <Tag color="processing">Entrada forçada</Tag>
          <Tag color="processing">Pós-atendimento</Tag>
          <Tag color="processing">Pesquisa de satisfação</Tag>
        </Space>
      </Card>
    </>
  );
}

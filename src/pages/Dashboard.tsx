import {
  ApartmentOutlined,
  ApiOutlined,
  ClockCircleOutlined,
  PhoneOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import {
  Card,
  Button,
  Col,
  List,
  Progress,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ApexOptions } from 'apexcharts';
import ReactApexChart from 'react-apexcharts';
import { useState } from 'react';
import MetricCard from '../components/MetricCard';
import PageHeader from '../components/PageHeader';
import StatusTag from '../components/StatusTag';
import { useAuth } from '../contexts/useAuth';
import {
  callRecords,
  dashboardSeries,
  extensions,
  pickupGroups,
  queues,
  ringGroups,
  sipTrunks,
} from '../services/mockData';
import { listPublicUsers } from '../services/mockUsers';
import { listMockTenants } from '../services/mockTenants';

const callChartOptions: ApexOptions = {
  chart: {
    toolbar: { show: false },
    zoom: { enabled: false },
  },
  colors: ['#0f766e', '#dc2626'],
  dataLabels: { enabled: false },
  grid: {
    strokeDashArray: 4,
  },
  legend: {
    position: 'top',
    horizontalAlign: 'right',
  },
  stroke: {
    curve: 'smooth',
    width: 3,
  },
  xaxis: {
    categories: dashboardSeries.callsByHour.map((item) => item.hour),
  },
};

function SuperAdminDashboard() {
  const [tenantId, setTenantId] = useState('all');
  const tenants = listMockTenants();
  const filterByTenant = <T extends { tenantId: string }>(items: T[]) =>
    tenantId === 'all'
      ? items
      : items.filter((item) => item.tenantId === tenantId);
  const visibleExtensions = filterByTenant(extensions);
  const visibleTrunks = filterByTenant(sipTrunks);
  const visibleQueues = filterByTenant(queues);
  const visibleCalls = filterByTenant(callRecords);
  const tenantScale =
    tenantId === 'all'
      ? 1
      : tenantId === 'tenant-alcatele'
        ? 0.75
        : 0.25;
  const visibleCallsByHour = dashboardSeries.callsByHour.map((item) => ({
    ...item,
    answered: Math.round(item.answered * tenantScale),
    missed: Math.round(item.missed * tenantScale),
  }));
  const activeCalls = Math.max(1, Math.round(18 * tenantScale));
  const onlineExtensions = visibleExtensions.filter(
    (extension) => extension.status === 'online',
  ).length;
  const answeredCalls = visibleCallsByHour.reduce(
    (sum, item) => sum + item.answered,
    0,
  );
  const missedCalls = visibleCallsByHour.reduce(
    (sum, item) => sum + item.missed,
    0,
  );
  const visibleTrunkUsage = visibleTrunks.map((trunk) => {
    const index = sipTrunks.findIndex((item) => item.id === trunk.id);
    return dashboardSeries.trunkUsage[index] ?? 0;
  });
  const registeredTrunks = visibleTrunks.filter(
    (trunk) => trunk.status === 'registered',
  ).length;
  const selectedTenantName =
    tenantId === 'all'
      ? 'Todas as empresas'
      : tenants.find((tenant) => tenant.id === tenantId)?.name;
  const trunkChartOptions: ApexOptions = {
    chart: { sparkline: { enabled: true } },
    colors: ['#0f766e', '#2563eb', '#d97706'],
    labels: visibleTrunks.map((trunk) => trunk.name),
    legend: { show: false },
    plotOptions: {
      radialBar: {
        dataLabels: {
          name: { fontSize: '13px' },
          value: { fontSize: '18px' },
          total: {
            show: true,
            label: 'Uso medio',
            formatter: () =>
              visibleTrunkUsage.length
                ? `${Math.round(
                    visibleTrunkUsage.reduce((sum, value) => sum + value, 0) /
                      visibleTrunkUsage.length,
                  )}%`
                : '0%',
          },
        },
      },
    },
  };

  return (
    <>
      <PageHeader
        actions={
          <Select
            aria-label="Filtrar dashboard por empresa"
            title="Filtrar dashboard por empresa"
            onChange={setTenantId}
            options={[
              { label: 'Todas as empresas', value: 'all' },
              ...tenants.map((tenant) => ({
                label: tenant.name,
                value: tenant.id,
              })),
            ]}
            style={{ minWidth: 240 }}
            value={tenantId}
          />
        }
        kicker="Operação em tempo real"
        title="Dashboard"
        description={`Visao consolidada de ${selectedTenantName}: chamadas, ramais, troncos e filas.`}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            icon={<PhoneOutlined />}
            iconBg="rgba(15, 118, 110, 0.14)"
            iconColor="#0f766e"
            label="Chamadas ativas"
            trend={{ direction: 'up', tone: 'success', value: '+12%' }}
            value={String(activeCalls)}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            icon={<TeamOutlined />}
            iconBg="rgba(37, 99, 235, 0.14)"
            iconColor="#2563eb"
            label="Ramais online"
            trend={{ direction: 'flat', tone: 'default', value: `${onlineExtensions}/${visibleExtensions.length}` }}
            value={String(onlineExtensions)}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            icon={<ApiOutlined />}
            iconBg="rgba(217, 119, 6, 0.14)"
            iconColor="#d97706"
            label="Troncos registrados"
            trend={{
              direction: 'flat',
              tone:
                registeredTrunks === visibleTrunks.length
                  ? 'success'
                  : 'warning',
              value: `${registeredTrunks}/${visibleTrunks.length}`,
            }}
            value={String(registeredTrunks)}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            icon={<ClockCircleOutlined />}
            iconBg="rgba(220, 38, 38, 0.12)"
            iconColor="#dc2626"
            label="Chamadas perdidas"
            trend={{ direction: 'down', tone: 'success', value: '-8%' }}
            value={String(missedCalls)}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={15}>
          <Card className="soft-panel" title="Chamadas por hora">
            <ReactApexChart
              height={320}
              options={callChartOptions}
              series={[
                {
                  name: 'Atendidas',
                  data: visibleCallsByHour.map((item) => item.answered),
                },
                {
                  name: 'Perdidas',
                  data: visibleCallsByHour.map((item) => item.missed),
                },
              ]}
              type="area"
            />
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <Card className="soft-panel" title="Uso dos troncos">
            <ReactApexChart
              height={278}
              options={trunkChartOptions}
              series={visibleTrunkUsage}
              type="radialBar"
            />
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {visibleTrunks.map((trunk, index) => (
                <div className="metric-topline" key={trunk.id}>
                  <Typography.Text>{trunk.name}</Typography.Text>
                  <Tag>{visibleTrunkUsage[index]}%</Tag>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={14}>
          <Card className="soft-panel" title="Últimas chamadas">
            <Table
              columns={[
                { title: 'Horario', dataIndex: 'startedAt', key: 'startedAt' },
                { title: 'Origem', dataIndex: 'caller', key: 'caller' },
                { title: 'Destino', dataIndex: 'callee', key: 'callee' },
                { title: 'Duração', dataIndex: 'duration', key: 'duration' },
                {
                  title: 'Status',
                  dataIndex: 'disposition',
                  key: 'disposition',
                  render: (value: string) => (
                    <Tag color={value === 'Atendida' ? 'success' : 'error'}>{value}</Tag>
                  ),
                },
              ]}
              dataSource={visibleCalls.slice(0, 4)}
              pagination={false}
              rowKey="id"
              size="middle"
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card className="soft-panel" title="Saúde das filas">
            <List
              dataSource={visibleQueues}
              renderItem={(queue) => (
                <List.Item>
                  <List.Item.Meta
                    description={`${queue.agents} agentes | ${queue.waiting} aguardando`}
                    title={queue.name}
                  />
                  <Progress
                    percent={queue.sla}
                    size="small"
                    status={queue.sla < 90 ? 'active' : 'success'}
                    style={{ maxWidth: 150 }}
                  />
                </List.Item>
              )}
            />
          </Card>
          <Card className="soft-panel" style={{ marginTop: 16 }} title="Presença SIP">
            <List
              dataSource={visibleExtensions.slice(0, 4)}
              renderItem={(extension) => (
                <List.Item>
                  <List.Item.Meta
                    description={extension.department}
                    title={`${extension.number} - ${extension.name}`}
                  />
                  <StatusTag status={extension.status} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Typography.Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
        Total de chamadas atendidas hoje: {answeredCalls}
      </Typography.Text>
    </>
  );
}

function AdminDashboard() {
  const onlineExtensions = extensions.filter(
    (extension) => extension.status === 'online',
  ).length;
  const registeredTrunks = sipTrunks.filter(
    (trunk) => trunk.status === 'registered',
  ).length;

  return (
    <>
      <PageHeader
        description="Visao administrativa de ramais, conectividade SIP e grupos de chamadas da empresa."
        kicker="Administração do PABX"
        title="Dashboard"
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            icon={<PhoneOutlined />}
            iconBg="rgba(15, 118, 110, 0.14)"
            iconColor="#0f766e"
            label="Ramais online"
            trend={{ direction: 'flat', value: `${onlineExtensions}/${extensions.length}` }}
            value={String(onlineExtensions)}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            icon={<ApiOutlined />}
            iconBg="rgba(37, 99, 235, 0.14)"
            iconColor="#2563eb"
            label="Troncos registrados"
            trend={{ direction: 'flat', value: `${registeredTrunks}/${sipTrunks.length}` }}
            value={String(registeredTrunks)}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            icon={<UsergroupAddOutlined />}
            iconBg="rgba(217, 119, 6, 0.14)"
            iconColor="#d97706"
            label="Grupos de captura"
            value={String(pickupGroups.length)}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            icon={<TeamOutlined />}
            iconBg="rgba(22, 163, 74, 0.14)"
            iconColor="#16a34a"
            label="Grupos de toque"
            value={String(ringGroups.length)}
          />
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={12}>
          <Card className="soft-panel" title="Ramais">
            <List
              dataSource={extensions}
              renderItem={(extension) => (
                <List.Item>
                  <List.Item.Meta
                    description={`${extension.department} | ${extension.device}`}
                    title={`${extension.number} - ${extension.name}`}
                  />
                  <StatusTag status={extension.status} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card className="soft-panel" title="Troncos SIP">
            <List
              dataSource={sipTrunks}
              renderItem={(trunk) => (
                <List.Item>
                  <List.Item.Meta
                    description={`${trunk.host} | ${trunk.channels} canais`}
                    title={trunk.name}
                  />
                  <StatusTag status={trunk.status} />
                </List.Item>
              )}
            />
          </Card>
          <Card className="soft-panel" style={{ marginTop: 16 }} title="Grupos de chamadas">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {ringGroups.map((group) => (
                <div className="metric-topline" key={group.id}>
                  <Typography.Text>{group.name}</Typography.Text>
                  <Tag>{group.number} | {group.members.length} ramais</Tag>
                </div>
              ))}
              {pickupGroups.map((group) => (
                <div className="metric-topline" key={group.id}>
                  <Typography.Text>Captura: {group.name}</Typography.Text>
                  <Tag color="blue">{group.code}</Tag>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>
    </>
  );
}

function OperationsDashboard({ agentView = false }: { agentView?: boolean }) {
  const { currentUser } = useAuth();
  const agents = listPublicUsers().filter((user) => user.role === 'agent');
  const pausedAgents = agents.filter(
    (agent) => agent.agentStatus === 'paused',
  ).length;
  const waiting = queues.reduce((total, queue) => total + queue.waiting, 0);
  const visibleQueues = agentView
    ? queues.filter((queue) => queue.id === currentUser?.workQueueId)
    : queues;
  const queueList = visibleQueues.length > 0 ? visibleQueues : queues;

  return (
    <>
      <PageHeader
        description={
          agentView
            ? 'Acompanhe sua fila de trabalho, disponibilidade da equipe e chamadas aguardando.'
            : 'Acompanhe filas, agentes, pausas e indicadores de atendimento em tempo real.'
        }
        kicker={agentView ? 'Minha operação' : 'Supervisão de atendimento'}
        title="Dashboard"
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            icon={<ApartmentOutlined />}
            iconBg="rgba(15, 118, 110, 0.14)"
            iconColor="#0f766e"
            label={agentView ? 'Minha fila' : 'Filas monitoradas'}
            value={String(queueList.length)}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            icon={<TeamOutlined />}
            iconBg="rgba(37, 99, 235, 0.14)"
            iconColor="#2563eb"
            label="Agentes"
            value={String(agents.length)}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            icon={<ClockCircleOutlined />}
            iconBg="rgba(217, 119, 6, 0.14)"
            iconColor="#d97706"
            label="Chamadas aguardando"
            value={String(waiting)}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            icon={<TeamOutlined />}
            iconBg="rgba(220, 38, 38, 0.12)"
            iconColor="#dc2626"
            label="Agentes em pausa"
            value={String(pausedAgents)}
          />
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={12}>
          <Card className="soft-panel" title="Filas">
            <List
              dataSource={queueList}
              renderItem={(queue) => (
                <List.Item>
                  <List.Item.Meta
                    description={`${queue.agents} agentes | ${queue.waiting} aguardando`}
                    title={`${queue.name} (${queue.number})`}
                  />
                  <Progress
                    percent={queue.sla}
                    size="small"
                    status={queue.sla < 90 ? 'active' : 'success'}
                    style={{ maxWidth: 150 }}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card className="soft-panel" title="Agentes">
            <List
              dataSource={agents}
              renderItem={(agent) => (
                <List.Item>
                  <List.Item.Meta
                    description={`Ramal ${agent.extension}`}
                    title={agent.name}
                  />
                  <Tag
                    color={agent.agentStatus === 'paused' ? 'warning' : 'success'}
                  >
                    {agent.agentStatus === 'paused' ? 'Em pausa' : 'Disponível'}
                  </Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}

function UserDashboard() {
  const { currentUser } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();
  const ownExtension = extensions.find(
    (extension) => extension.number === currentUser?.extension,
  );

  function callGroup(destination: string, label: string) {
    messageApi.success(`Chamando ${label} (${destination}).`);
  }

  return (
    <>
      {contextHolder}
      <PageHeader
        description="Consulte os ramais disponíveis e os grupos de chamadas configurados na empresa."
        kicker="Diretorio da empresa"
        title="Dashboard"
      />
      {ownExtension ? (
        <Card className="soft-panel" style={{ marginBottom: 16 }}>
          <Space size={16}>
            <span
              className="metric-icon"
              style={{ background: 'rgba(15, 118, 110, 0.14)', color: '#0f766e' }}
            >
              <PhoneOutlined />
            </span>
            <div>
              <Typography.Text type="secondary">Meu ramal</Typography.Text>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {ownExtension.number} - {ownExtension.name}
              </Typography.Title>
            </div>
            <StatusTag status={ownExtension.status} />
          </Space>
        </Card>
      ) : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card className="soft-panel" title="Ramais">
            <List
              dataSource={extensions}
              renderItem={(extension) => (
                <List.Item>
                  <List.Item.Meta
                    description={extension.department}
                    title={`${extension.number} - ${extension.name}`}
                  />
                  <StatusTag status={extension.status} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card className="soft-panel" title="Grupos de toque">
            <List
              dataSource={ringGroups}
              renderItem={(group) => (
                <List.Item>
                  <List.Item.Meta
                    description={`${group.members.length} ramais | ${group.timeout}s`}
                    title={`${group.number} - ${group.name}`}
                  />
                  <Button
                    icon={<PhoneOutlined />}
                    onClick={() => callGroup(group.number, group.name)}
                    size="small"
                    type="primary"
                  >
                    Chamar
                  </Button>
                </List.Item>
              )}
            />
          </Card>
          <Card className="soft-panel" style={{ marginTop: 16 }} title="Grupos de captura">
            <List
              dataSource={pickupGroups}
              renderItem={(group) => (
                <List.Item>
                  <List.Item.Meta
                    description={`Ramais ${group.members.join(', ')}`}
                    title={group.name}
                  />
                  <Button
                    icon={<PhoneOutlined />}
                    onClick={() => callGroup(group.code, group.name)}
                    size="small"
                  >
                    Capturar
                  </Button>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}

export default function Dashboard() {
  const { role } = useAuth();

  if (role === 'super_admin') {
    return <SuperAdminDashboard />;
  }

  if (role === 'admin') {
    return <AdminDashboard />;
  }

  if (role === 'supervisor') {
    return <OperationsDashboard />;
  }

  if (role === 'agent') {
    return <OperationsDashboard agentView />;
  }

  return <UserDashboard />;
}


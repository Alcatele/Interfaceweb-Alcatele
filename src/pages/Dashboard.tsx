import {
  ApiOutlined,
  BranchesOutlined,
  CheckCircleFilled,
  CloudServerOutlined,
  PhoneOutlined,
  SyncOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import MetricCard from '../components/MetricCard';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/useAuth';
import {
  mvpApi,
  type DashboardSummary,
  type FusionPbxStatus,
} from '../services/mvpApi';

export default function Dashboard() {
  const { activeTenant, hasPermission } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [fusion, setFusion] = useState<FusionPbxStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextSummary, nextFusion] = await Promise.all([
        mvpApi.dashboard(),
        mvpApi.fusionPbxStatus(),
      ]);
      setSummary(nextSummary);
      setFusion(nextFusion);
    } catch {
      messageApi.error('Não foi possível carregar o dashboard.');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void load();
  }, [activeTenant?.id, load]);

  async function synchronize() {
    setSyncing(true);
    try {
      const result = await mvpApi.syncFusionPbx();
      messageApi.success(
        `${result.synchronized} de ${result.total} recursos sincronizados.`,
      );
      await load();
    } catch {
      messageApi.error('Falha ao sincronizar com o FusionPBX.');
    } finally {
      setSyncing(false);
    }
  }

  if (loading || !summary) {
    return <Spin size="large" />;
  }

  const metrics = summary.metrics;

  return (
    <>
      {contextHolder}
      <PageHeader
        actions={
          hasPermission('pbx.configure') ? (
            <Button
              icon={<SyncOutlined />}
              loading={syncing}
              onClick={() => void synchronize()}
              type="primary"
            >
              Sincronizar FusionPBX
            </Button>
          ) : undefined
        }
        kicker="MVP operacional"
        title="Visão geral"
        description="Acompanhe os principais recursos de comunicação e o estado do ambiente."
      />

      <Card className="dashboard-overview soft-panel">
        <div className="dashboard-overview-main">
          <span className="dashboard-overview-icon">
            <CloudServerOutlined />
          </span>
          <div>
            <span className="dashboard-overview-eyebrow">Workspace ativo</span>
            <Typography.Title level={3}>{summary.tenant.name}</Typography.Title>
            <Typography.Text type="secondary">
              Telefonia, usuários e configurações em um único ambiente.
            </Typography.Text>
          </div>
        </div>
        <div className="dashboard-overview-meta">
          <div>
            <span>Integração FusionPBX</span>
            <strong
              className={
                fusion?.status === 'active' ? 'status-online' : 'status-waiting'
              }
            >
              <CheckCircleFilled />
              {fusion?.status === 'active'
                ? 'Conectada'
                : 'Aguardando configuração'}
            </strong>
          </div>
          <div>
            <span>Última sincronização</span>
            <strong>
              {fusion?.lastSyncAt
                ? new Date(fusion.lastSyncAt).toLocaleString('pt-BR')
                : 'Ainda não executada'}
            </strong>
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            icon={<PhoneOutlined />}
            iconBg="rgba(59, 111, 245, 0.12)"
            iconColor="#3b6ff5"
            label="Ramais"
            trend={{
              direction: 'flat',
              tone: 'success',
              value: `${metrics.extensionsOnline} online`,
            }}
            value={String(metrics.extensionsTotal)}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            icon={<ApiOutlined />}
            iconBg="rgba(20, 184, 166, 0.12)"
            iconColor="#0f9f8f"
            label="Troncos"
            trend={{
              direction: 'flat',
              tone:
                metrics.trunksRegistered === metrics.trunksTotal
                  ? 'success'
                  : 'warning',
              value: `${metrics.trunksRegistered} registrados`,
            }}
            value={String(metrics.trunksTotal)}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            icon={<BranchesOutlined />}
            iconBg="rgba(245, 158, 11, 0.13)"
            iconColor="#d98b08"
            label="Rotas ativas"
            trend={{ direction: 'flat', tone: 'default', value: 'Entrada + saída' }}
            value={String(metrics.inboundRoutes + metrics.outboundRoutes)}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            icon={<TeamOutlined />}
            iconBg="rgba(139, 92, 246, 0.12)"
            iconColor="#7c4fe0"
            label="Usuários"
            trend={{ direction: 'flat', tone: 'default', value: 'Ativos' }}
            value={String(metrics.usersTotal)}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            className="dashboard-panel soft-panel"
            title="Integração FusionPBX"
          >
            <Space direction="vertical" size={12}>
              <Space>
                <Typography.Text>Status</Typography.Text>
                <Tag color={fusion?.status === 'active' ? 'success' : 'warning'}>
                  {fusion?.status ?? 'não configurado'}
                </Tag>
              </Space>
              <Typography.Text>
                Modo: <strong>{fusion?.mode ?? 'mock'}</strong>
              </Typography.Text>
              <Typography.Text>
                Última sincronização:{' '}
                {fusion?.lastSyncAt
                  ? new Date(fusion.lastSyncAt).toLocaleString('pt-BR')
                  : 'Ainda não executada'}
              </Typography.Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            className="dashboard-panel soft-panel"
            title="Fila de provisionamento"
          >
            {metrics.pendingSync > 0 ? (
              <Alert
                description="Execute a sincronização para aplicar as alterações no FusionPBX."
                message={`${metrics.pendingSync} recursos pendentes`}
                showIcon
                type="warning"
              />
            ) : (
              <Alert
                message="Configuração sincronizada"
                showIcon
                type="success"
              />
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}

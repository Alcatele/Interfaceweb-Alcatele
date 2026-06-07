import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Tabs,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import PageHeader from '../components/PageHeader';
import SmtpSettingsPanel from '../components/SmtpSettingsPanel';
import UserManagementPanel from '../components/UserManagementPanel';
import { useAuth } from '../contexts/useAuth';
import { routeItems } from '../routes/menuItems';
import {
  permissions,
  roleHasPermission,
  roleProfiles,
  roleRouteAccess,
  type PermissionKey,
  type UserRole,
  userRoles,
} from '../services/accessControl';

const routeLabelByKey = Object.fromEntries(
  routeItems.map((route) => [route.key, route.label]),
);

export default function Settings() {
  const {
    adminCanViewRecordings,
    role,
    setAdminCanViewRecordings,
  } = useAuth();
  const isSuperAdmin = role === 'super_admin';
  const [messageApi, contextHolder] = message.useMessage();
  const roleCanAccess = (targetRole: UserRole, permission: PermissionKey) =>
    !(
      targetRole === 'admin' &&
      permission === 'recordings.view' &&
      !adminCanViewRecordings
    ) && roleHasPermission(targetRole, permission);
  const roleRows = userRoles.map((targetRole) => ({
    key: targetRole,
    role: targetRole,
    description: roleProfiles[targetRole].description,
    routes: roleRouteAccess[targetRole]
      .filter(
        (routeKey) =>
          !(
            targetRole === 'admin' &&
            routeKey === 'recordings' &&
            !adminCanViewRecordings
          ),
      )
      .map((routeKey) => routeLabelByKey[routeKey]),
  }));
  const permissionColumns = [
    {
      title: 'Permissao',
      dataIndex: 'label',
      key: 'label',
      render: (_: string, record: (typeof permissions)[number]) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.label}</Typography.Text>
          <Typography.Text type="secondary">
            {record.description}
          </Typography.Text>
        </Space>
      ),
    },
    ...userRoles.map((targetRole) => ({
      align: 'center' as const,
      key: targetRole,
      title: roleProfiles[targetRole].shortLabel,
      render: (_: unknown, record: (typeof permissions)[number]) =>
        roleCanAccess(targetRole, record.key) ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Sim
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />}>Não</Tag>
        ),
    })),
  ];

  return (
    <>
      {contextHolder}
      <PageHeader
        actions={
          <Button
            icon={<SaveOutlined />}
            onClick={() => messageApi.success('Configurações salvas.')}
            type="primary"
          >
            Salvar
          </Button>
        }
        kicker="Tenant e segurança"
        title="Configurações"
        description="Parâmetros iniciais do tenant, regras SIP, segurança, gravação e notificações administrativas."
      />
      <Card className="soft-panel">
        <Tabs
          items={[
            {
              key: 'general',
              label: 'Geral',
              children: (
                <Form layout="vertical">
                  <Row gutter={16}>
                    <Col xs={24} lg={12}>
                      <Form.Item label="Nome do tenant">
                        <Input defaultValue="Alcatele Tecnologia" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Form.Item label="Dominio SIP">
                        <Input defaultValue="pbx.alcatele.cloud" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} lg={8}>
                      <Form.Item label="Fuso horário">
                        <Select
                          defaultValue="America/Sao_Paulo"
                          options={[
                            {
                              label: 'America/Sao_Paulo',
                              value: 'America/Sao_Paulo',
                            },
                            { label: 'UTC', value: 'UTC' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} lg={8}>
                      <Form.Item label="Idioma">
                        <Select
                          defaultValue="pt-BR"
                          options={[
                            { label: 'Portugues Brasil', value: 'pt-BR' },
                            { label: 'English', value: 'en-US' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} lg={8}>
                      <Form.Item label="Limite de canais">
                        <InputNumber defaultValue={60} min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              ),
            },
            {
              key: 'security',
              label: 'Seguranca',
              children: (
                <Form layout="vertical">
                  <Row gutter={16}>
                    <Col xs={24} lg={8}>
                      <Form.Item label="Bloqueio por tentativas SIP">
                        <Switch defaultChecked />
                      </Form.Item>
                    </Col>
                    <Col xs={24} lg={8}>
                      <Form.Item label="Forcar TLS em WebRTC">
                        <Switch defaultChecked />
                      </Form.Item>
                    </Col>
                    <Col xs={24} lg={8}>
                      <Form.Item label="Gravar chamadas externas">
                        <Switch defaultChecked />
                      </Form.Item>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Form.Item label="Redes permitidas">
                        <Input.TextArea
                          defaultValue={'10.24.0.0/16\n192.168.15.0/24'}
                          rows={4}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              ),
            },
            {
              key: 'users',
              label: 'Usuários',
              children: <UserManagementPanel />,
            },
            {
              key: 'access',
              label: 'Acessos',
              children: (
                <Space direction="vertical" size={18} style={{ width: '100%' }}>
                  {isSuperAdmin ? (
                    <Card size="small" title="Permissões delegadas ao Admin">
                      <Space
                        align="center"
                        style={{ justifyContent: 'space-between', width: '100%' }}
                      >
                        <div>
                          <Typography.Text strong>
                            Permitir acesso a Gravações
                          </Typography.Text>
                          <Typography.Text
                            style={{ display: 'block' }}
                            type="secondary"
                          >
                            Exibe ou oculta a página de gravações para todos os
                            administradores.
                          </Typography.Text>
                        </div>
                        <Switch
                          checked={adminCanViewRecordings}
                          onChange={setAdminCanViewRecordings}
                        />
                      </Space>
                    </Card>
                  ) : null}
                  <Table
                    columns={[
                      {
                        title: 'Perfil',
                        dataIndex: 'role',
                        key: 'role',
                        render: (role: (typeof userRoles)[number]) => (
                          <Tag color={roleProfiles[role].color}>
                            {roleProfiles[role].label}
                          </Tag>
                        ),
                      },
                      {
                        title: 'Descricao',
                        dataIndex: 'description',
                        key: 'description',
                      },
                      {
                        title: 'Areas liberadas',
                        dataIndex: 'routes',
                        key: 'routes',
                        render: (routes: string[]) => (
                          <Space size={[4, 4]} wrap>
                            {routes.map((route) => (
                              <Tag key={route}>{route}</Tag>
                            ))}
                          </Space>
                        ),
                      },
                    ]}
                    dataSource={roleRows}
                    pagination={false}
                    rowKey="key"
                    size="small"
                  />
                  <Table
                    columns={permissionColumns}
                    dataSource={permissions}
                    pagination={false}
                    rowKey="key"
                    size="small"
                  />
                </Space>
              ),
            },
            {
              key: 'notifications',
              label: 'Notificações',
              children: <SmtpSettingsPanel />,
            },
          ]}
        />
      </Card>
    </>
  );
}


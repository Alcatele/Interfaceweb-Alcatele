import {
  BankOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/useAuth';
import { getApiErrorMessage } from '../services/api';
import {
  mvpApi,
  type SessionTenant,
  type TenantLimits,
} from '../services/mvpApi';

type TenantFormValues = {
  name: string;
  slug: string;
  domain: string;
  limits: TenantLimits;
};

const defaultLimits: TenantLimits = {
  users: 10,
  extensions: 10,
  trunks: 2,
  inboundRoutes: 5,
  outboundRoutes: 5,
  pickupGroups: 3,
  ringGroups: 3,
  voicemailBoxes: 10,
};

const resourceFields: Array<{
  key: keyof TenantLimits;
  label: string;
  shortLabel: string;
}> = [
  { key: 'users', label: 'Usuários', shortLabel: 'Usuários' },
  { key: 'extensions', label: 'Ramais', shortLabel: 'Ramais' },
  { key: 'trunks', label: 'Troncos SIP', shortLabel: 'Troncos' },
  {
    key: 'inboundRoutes',
    label: 'Rotas de entrada',
    shortLabel: 'Entrada',
  },
  {
    key: 'outboundRoutes',
    label: 'Rotas de saída',
    shortLabel: 'Saída',
  },
  {
    key: 'pickupGroups',
    label: 'Grupos de captura',
    shortLabel: 'Captura',
  },
  {
    key: 'ringGroups',
    label: 'Grupos de chamada',
    shortLabel: 'Chamada',
  },
  {
    key: 'voicemailBoxes',
    label: 'Caixas de correio de voz',
    shortLabel: 'Correio de voz',
  },
];

function LimitsFields() {
  return (
    <Row gutter={12}>
      {resourceFields.map((resource) => (
        <Col key={resource.key} xs={24} sm={12}>
          <Form.Item
            label={resource.label}
            name={['limits', resource.key]}
            rules={[{ required: true, message: 'Informe a quantidade.' }]}
          >
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      ))}
    </Row>
  );
}

export default function Tenants() {
  const [form] = Form.useForm<TenantFormValues>();
  const [limitsForm] = Form.useForm<{ limits: TenantLimits }>();
  const { activeTenant, refreshSession } = useAuth();
  const [items, setItems] = useState<SessionTenant[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLimits, setEditingLimits] = useState<SessionTenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await mvpApi.listTenants());
    } catch (error) {
      messageApi.error(
        getApiErrorMessage(error, 'Não foi possível carregar as empresas.'),
      );
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    form.resetFields();
    form.setFieldsValue({ limits: defaultLimits });
    setModalOpen(true);
  }

  async function createTenant(values: TenantFormValues) {
    try {
      await mvpApi.createTenant(values);
      messageApi.success(`Empresa ${values.name} criada.`);
      form.resetFields();
      setModalOpen(false);
      await refreshSession();
      await load();
    } catch (error) {
      messageApi.error(
        getApiErrorMessage(error, 'Não foi possível criar a empresa.'),
      );
    }
  }

  function openLimits(tenant: SessionTenant) {
    setEditingLimits(tenant);
    limitsForm.setFieldsValue({
      limits: tenant.limits ?? defaultLimits,
    });
  }

  async function updateLimits(values: { limits: TenantLimits }) {
    if (!editingLimits) {
      return;
    }

    try {
      await mvpApi.updateTenantLimits(editingLimits.id, values.limits);
      messageApi.success('Recursos contratados atualizados.');
      setEditingLimits(null);
      await load();
    } catch (error) {
      messageApi.error(
        getApiErrorMessage(error, 'Não foi possível atualizar os limites.'),
      );
    }
  }

  async function toggleStatus(tenant: SessionTenant, checked: boolean) {
    try {
      await mvpApi.setTenantStatus(
        tenant.id,
        checked ? 'active' : 'suspended',
      );
      messageApi.success('Status atualizado.');
      await load();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error));
    }
  }

  async function closeTenant(tenant: SessionTenant) {
    try {
      await mvpApi.closeTenant(tenant.id);
      messageApi.success(`Empresa ${tenant.name} encerrada.`);
      await refreshSession();
      await load();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error));
    }
  }

  const columns: ColumnsType<SessionTenant> = [
    {
      title: 'Empresa',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, tenant) => (
        <Space direction="vertical" size={2}>
          <Space>
            <Tag color="blue" icon={<BankOutlined />}>
              {name}
            </Tag>
            {tenant.id === activeTenant?.id ? (
              <Tag color="success">Ativa na sessão</Tag>
            ) : null}
          </Space>
          <Typography.Text type="secondary">{tenant.domain}</Typography.Text>
        </Space>
      ),
    },
    { title: 'Slug', dataIndex: 'slug', key: 'slug' },
    {
      title: 'Recursos contratados',
      key: 'limits',
      width: 420,
      render: (_, tenant) => (
        <Space size={[4, 5]} wrap>
          {resourceFields.map((resource) => {
            const limit = tenant.limits?.[resource.key] ?? 0;
            const used = tenant.usage?.[resource.key] ?? 0;
            const full = limit === 0 || used >= limit;

            return (
              <Tag color={full ? 'warning' : 'default'} key={resource.key}>
                {resource.shortLabel}: {used}/{limit}
              </Tag>
            );
          })}
        </Space>
      ),
    },
    {
      title: 'Habilitada',
      key: 'status',
      render: (_, tenant) => (
        <Switch
          checked={tenant.status !== 'suspended'}
          disabled={tenant.id === activeTenant?.id}
          onChange={(checked) => void toggleStatus(tenant, checked)}
        />
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 110,
      render: (_, tenant) => (
        <Space>
          <Button
            aria-label={`Editar recursos de ${tenant.name}`}
            icon={<EditOutlined />}
            onClick={() => openLimits(tenant)}
            size="small"
            title="Editar recursos contratados"
          />
          <Popconfirm
            cancelText="Cancelar"
            disabled={tenant.id === activeTenant?.id}
            okButtonProps={{ danger: true }}
            okText="Encerrar"
            onConfirm={() => void closeTenant(tenant)}
            title={`Encerrar a empresa ${tenant.name}?`}
          >
            <Button
              danger
              disabled={tenant.id === activeTenant?.id}
              icon={<DeleteOutlined />}
              size="small"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <PageHeader
        actions={
          <Button icon={<PlusOutlined />} onClick={openCreate} type="primary">
            Nova empresa
          </Button>
        }
        kicker="Multiempresa"
        title="Empresas"
        description="Cadastre empresas e controle os recursos contratados de cada operação."
      />
      <Card className="soft-panel">
        <Table
          columns={columns}
          dataSource={items}
          loading={loading}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1150 }}
        />
      </Card>

      <Modal
        footer={null}
        onCancel={() => setModalOpen(false)}
        open={modalOpen}
        title="Nova empresa"
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={createTenant}>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Nome"
                name="name"
                rules={[{ required: true, message: 'Informe o nome.' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Slug"
                name="slug"
                rules={[
                  { required: true, message: 'Informe o slug.' },
                  {
                    pattern: /^[a-z0-9][a-z0-9-]{1,62}$/,
                    message: 'Use letras minúsculas, números e hífen.',
                  },
                ]}
              >
                <Input placeholder="empresa-exemplo" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="Domínio SIP"
            name="domain"
            rules={[{ required: true, message: 'Informe o domínio.' }]}
          >
            <Input placeholder="pbx.empresa.com.br" />
          </Form.Item>
          <Divider orientation="left">Recursos contratados</Divider>
          <LimitsFields />
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button htmlType="submit" type="primary">
              Criar empresa
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        footer={null}
        onCancel={() => setEditingLimits(null)}
        open={editingLimits !== null}
        title={`Recursos contratados · ${editingLimits?.name ?? ''}`}
        width={680}
      >
        <Form form={limitsForm} layout="vertical" onFinish={updateLimits}>
          <Typography.Paragraph type="secondary">
            O limite não pode ser reduzido para um valor menor que o consumo
            atual da empresa.
          </Typography.Paragraph>
          <LimitsFields />
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => setEditingLimits(null)}>Cancelar</Button>
            <Button htmlType="submit" type="primary">
              Salvar limites
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}

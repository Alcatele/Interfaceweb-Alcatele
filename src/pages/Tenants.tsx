import {
  BankOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/useAuth';
import { mvpApi, type SessionTenant } from '../services/mvpApi';

type TenantFormValues = {
  name: string;
  slug: string;
  domain: string;
};

export default function Tenants() {
  const [form] = Form.useForm<TenantFormValues>();
  const { activeTenant, refreshSession } = useAuth();
  const [items, setItems] = useState<SessionTenant[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await mvpApi.listTenants());
    } catch {
      messageApi.error('Não foi possível carregar as empresas.');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTenant(values: TenantFormValues) {
    try {
      await mvpApi.createTenant(values);
      messageApi.success(`Empresa ${values.name} criada.`);
      form.resetFields();
      setModalOpen(false);
      await refreshSession();
      await load();
    } catch {
      messageApi.error('Slug ou domínio já está em uso.');
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
    } catch {
      messageApi.error('Não foi possível alterar o status.');
    }
  }

  async function closeTenant(tenant: SessionTenant) {
    try {
      await mvpApi.closeTenant(tenant.id);
      messageApi.success(`Empresa ${tenant.name} encerrada.`);
      await refreshSession();
      await load();
    } catch {
      messageApi.error('Não foi possível encerrar a empresa.');
    }
  }

  const columns: ColumnsType<SessionTenant> = [
    {
      title: 'Empresa',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, tenant) => (
        <Space>
          <Tag color="blue" icon={<BankOutlined />}>
            {name}
          </Tag>
          {tenant.id === activeTenant?.id ? (
            <Tag color="success">Ativa na sessão</Tag>
          ) : null}
        </Space>
      ),
    },
    { title: 'Slug', dataIndex: 'slug', key: 'slug' },
    { title: 'Domínio SIP', dataIndex: 'domain', key: 'domain' },
    { title: 'Perfil', dataIndex: 'role', key: 'role' },
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
      width: 80,
      render: (_, tenant) => (
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
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <PageHeader
        actions={
          <Button
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
            type="primary"
          >
            Nova empresa
          </Button>
        }
        kicker="Multiempresa"
        title="Empresas"
        description="Cadastre tenants e alterne a empresa ativa pelo seletor no topo."
      />
      <Card className="soft-panel">
        <Table
          columns={columns}
          dataSource={items}
          loading={loading}
          pagination={false}
          rowKey="id"
        />
      </Card>
      <Modal
        footer={null}
        onCancel={() => setModalOpen(false)}
        open={modalOpen}
        title="Nova empresa"
      >
        <Form form={form} layout="vertical" onFinish={createTenant}>
          <Form.Item
            label="Nome"
            name="name"
            rules={[{ required: true, message: 'Informe o nome.' }]}
          >
            <Input />
          </Form.Item>
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
          <Form.Item
            label="Domínio SIP"
            name="domain"
            rules={[{ required: true, message: 'Informe o domínio.' }]}
          >
            <Input placeholder="pbx.empresa.com.br" />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button htmlType="submit" type="primary">
              Criar empresa
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}

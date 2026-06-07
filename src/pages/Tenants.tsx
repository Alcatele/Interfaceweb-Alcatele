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
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import {
  createMockTenant,
  createDefaultTenantResources,
  deleteMockTenant,
  listMockTenants,
  tenantResourceCatalog,
  updateMockTenant,
  updateMockTenantStatus,
  type CreateTenantInput,
  type MockTenant,
  type TenantResource,
} from '../services/mockTenants';

const defaultResources = createDefaultTenantResources(40);

function resourceLabel(resource: TenantResource) {
  const catalogItem = tenantResourceCatalog.find(
    (item) => item.key === resource.key,
  );

  return catalogItem
    ? `${catalogItem.label}: ${resource.quantity} ${catalogItem.unit}`
    : `${resource.key}: ${resource.quantity}`;
}

export default function Tenants() {
  const [form] = Form.useForm<CreateTenantInput>();
  const [items, setItems] = useState(listMockTenants);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<MockTenant | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  function refresh() {
    setItems(listMockTenants());
  }

  function createTenant(values: CreateTenantInput) {
    if (editingTenant) {
      const result = updateMockTenant(editingTenant.id, values);

      if (!result.success) {
        messageApi.error(result.error);
        return;
      }

      messageApi.success(`Empresa ${values.name} atualizada.`);
      closeModal();
      refresh();
      return;
    }

    const result = createMockTenant(values);

    if (!result.success) {
      messageApi.error(result.error);
      return;
    }

    messageApi.success(`Empresa ${values.name} criada.`);
    closeModal();
    refresh();
  }

  function openCreate() {
    setEditingTenant(null);
    form.setFieldsValue({
      extensionLimit: 40,
      plan: 'Business',
      resources: defaultResources,
    });
    setModalOpen(true);
  }

  function openEdit(tenant: MockTenant) {
    setEditingTenant(tenant);
    form.setFieldsValue(tenant);
    setModalOpen(true);
  }

  function closeModal() {
    form.resetFields();
    setEditingTenant(null);
    setModalOpen(false);
  }

  function removeTenant(tenant: MockTenant) {
    if (!deleteMockTenant(tenant.id)) {
      messageApi.error('Não foi possível apagar a empresa.');
      return;
    }

    messageApi.success(`Empresa ${tenant.name} apagada.`);
    refresh();
  }

  function toggleStatus(tenant: MockTenant, active: boolean) {
    updateMockTenantStatus(tenant.id, active ? 'active' : 'suspended');
    refresh();
  }

  const columns: ColumnsType<MockTenant> = [
    {
      title: 'Empresa',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Tag color="blue" icon={<BankOutlined />}>
          {name}
        </Tag>
      ),
    },
    { title: 'CNPJ / Documento', dataIndex: 'document', key: 'document' },
    { title: 'Dominio', dataIndex: 'domain', key: 'domain' },
    { title: 'Plano', dataIndex: 'plan', key: 'plan' },
    {
      title: 'Entregaveis',
      dataIndex: 'resources',
      key: 'resources',
      render: (resources: TenantResource[]) => (
        <Space size={[4, 4]} wrap>
          {resources
            .filter((resource) => resource.enabled)
            .slice(0, 5)
            .map((resource) => (
              <Tag key={resource.key}>{resourceLabel(resource)}</Tag>
            ))}
          {resources.filter((resource) => resource.enabled).length > 5 ? (
            <Tag>
              +{resources.filter((resource) => resource.enabled).length - 5}
            </Tag>
          ) : null}
        </Space>
      ),
    },
    { title: 'Criada em', dataIndex: 'createdAt', key: 'createdAt' },
    {
      title: 'Ativa',
      dataIndex: 'status',
      key: 'status',
      render: (status: MockTenant['status'], tenant) => (
        <Switch
          checked={status === 'active'}
          onChange={(checked) => toggleStatus(tenant, checked)}
        />
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 80,
      render: (_, tenant) => (
        <Space>
          <Button
            aria-label={`Editar empresa ${tenant.name}`}
            title={`Editar empresa ${tenant.name}`}
            icon={<EditOutlined />}
            onClick={() => openEdit(tenant)}
            size="small"
          />
          <Popconfirm
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
            okText="Apagar"
            onConfirm={() => removeTenant(tenant)}
            title={`Apagar a empresa ${tenant.name}?`}
          >
            <Button
              aria-label={`Apagar empresa ${tenant.name}`}
              title={`Apagar empresa ${tenant.name}`}
              danger
              icon={<DeleteOutlined />}
              size="small"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const activeTenants = items.filter((tenant) => tenant.status === 'active').length;
  const extensionCapacity = items.reduce(
    (total, tenant) =>
      total +
      (tenant.resources.find((resource) => resource.key === 'extensions')
        ?.quantity ?? tenant.extensionLimit),
    0,
  );

  return (
    <>
      {contextHolder}
      <PageHeader
        actions={
          <Button
            icon={<PlusOutlined />}
            onClick={openCreate}
            type="primary"
          >
            Nova empresa
          </Button>
        }
        description="Crie e administre empresas, domínios, planos e capacidade contratada da plataforma."
        kicker="Gestão multi-tenant"
        title="Empresas"
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card className="soft-panel">
            <Statistic title="Empresas cadastradas" value={items.length} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="soft-panel">
            <Statistic title="Empresas ativas" value={activeTenants} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="soft-panel">
            <Statistic title="Capacidade de ramais" value={extensionCapacity} />
          </Card>
        </Col>
      </Row>
      <Card className="soft-panel" style={{ marginTop: 16 }}>
        <Table
          columns={columns}
          dataSource={items}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1050 }}
        />
      </Card>

      <Modal
        footer={null}
        onCancel={closeModal}
        open={modalOpen}
        title={editingTenant ? 'Editar empresa' : 'Nova empresa'}
      >
        <Form
          form={form}
          initialValues={{
            extensionLimit: 40,
            plan: 'Business',
            resources: defaultResources,
          }}
          layout="vertical"
          onFinish={createTenant}
          requiredMark={false}
        >
          <Form.Item
            label="Razao social / Nome"
            name="name"
            rules={[{ required: true, message: 'Informe o nome da empresa.' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="CNPJ / Documento"
            name="document"
            rules={[{ required: true, message: 'Informe o documento.' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Dominio SIP"
            name="domain"
            rules={[{ required: true, message: 'Informe o domínio.' }]}
          >
            <Input placeholder="empresa.alcatele.cloud" />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Plano" name="plan" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: 'Start', value: 'Start' },
                    { label: 'Business', value: 'Business' },
                    { label: 'Enterprise', value: 'Enterprise' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Limite de ramais"
                name="extensionLimit"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={10000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Card size="small" title="O que será entregue">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {tenantResourceCatalog.map((resource, index) => (
                <Row align="middle" gutter={12} key={resource.key}>
                  <Col xs={24} md={9}>
                    <Form.Item
                      name={['resources', index, 'enabled']}
                      style={{ marginBottom: 0 }}
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                    <Form.Item
                      hidden
                      initialValue={resource.key}
                      name={['resources', index, 'key']}
                    >
                      <Input />
                    </Form.Item>
                    <span style={{ marginLeft: 8 }}>{resource.label}</span>
                  </Col>
                  <Col xs={16} md={9}>
                    <Form.Item
                      name={['resources', index, 'quantity']}
                      rules={[
                        {
                          required: true,
                          message: 'Informe a quantidade.',
                        },
                      ]}
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber min={0} max={100000} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={8} md={6}>
                    <Tag>{resource.unit}</Tag>
                  </Col>
                </Row>
              ))}
            </Space>
          </Card>
          <Row gutter={12} justify="end">
            <Col>
              <Button onClick={closeModal}>Cancelar</Button>
            </Col>
            <Col>
              <Button htmlType="submit" type="primary">
                {editingTenant ? 'Salvar empresa' : 'Criar empresa'}
              </Button>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
}


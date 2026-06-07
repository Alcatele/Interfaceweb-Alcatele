import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SwapRightOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import { OutboundRoute, outboundRoutes } from '../services/mockData';

type OutboundRouteFormValues = Omit<OutboundRoute, 'id'>;

export default function OutboundRoutes() {
  const [form] = Form.useForm<OutboundRouteFormValues>();
  const [items, setItems] = useState(outboundRoutes);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OutboundRoute | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  function openCreate() {
    setEditing(null);
    form.setFieldsValue({ priority: items.length + 1, enabled: true });
    setModalOpen(true);
  }

  function openEdit(route: OutboundRoute) {
    setEditing(route);
    form.setFieldsValue(route);
    setModalOpen(true);
  }

  function closeModal() {
    form.resetFields();
    setEditing(null);
    setModalOpen(false);
  }

  function saveRoute(values: OutboundRouteFormValues) {
    if (editing) {
      setItems((current) =>
        current.map((item) =>
          item.id === editing.id ? { ...values, id: editing.id } : item,
        ),
      );
      messageApi.success(`Rota ${values.name} atualizada.`);
    } else {
      setItems((current) => [
        ...current,
        { ...values, id: `out-${Date.now()}` },
      ]);
      messageApi.success(`Rota ${values.name} criada.`);
    }

    closeModal();
  }

  function removeRoute(route: OutboundRoute) {
    setItems((current) => current.filter((item) => item.id !== route.id));
    messageApi.success(`Rota ${route.name} apagada.`);
  }

  const columns: ColumnsType<OutboundRoute> = [
    { title: 'Prioridade', dataIndex: 'priority', key: 'priority', width: 110 },
    { title: 'Nome', dataIndex: 'name', key: 'name' },
    {
      title: 'Padrao discado',
      dataIndex: 'pattern',
      key: 'pattern',
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: 'Fluxo',
      key: 'flow',
      render: (_, record) => (
        <div className="route-flow">
          <Tag>Discagem</Tag>
          <SwapRightOutlined />
          <Tag color="blue">{record.pattern}</Tag>
          <SwapRightOutlined />
          <Tag color="green">{record.trunk}</Tag>
        </div>
      ),
    },
    {
      title: 'Ativa',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => <Switch checked={enabled} />,
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 80,
      render: (_, route) => (
        <Space>
          <Button
            aria-label={`Editar rota ${route.name}`}
            title={`Editar rota ${route.name}`}
            icon={<EditOutlined />}
            onClick={() => openEdit(route)}
            size="small"
          />
          <Popconfirm
          cancelText="Cancelar"
          okButtonProps={{ danger: true }}
          okText="Apagar"
          onConfirm={() => removeRoute(route)}
          title={`Apagar a rota ${route.name}?`}
        >
          <Button
            aria-label={`Apagar rota ${route.name}`}
            title={`Apagar rota ${route.name}`}
            danger
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
            Nova rota
          </Button>
        }
        kicker="Politicas de discagem"
        title="Rotas de saída"
        description="Defina padrões de discagem, precedencia e troncos usados para chamadas locais, nacionais e internacionais."
      />
      <Card className="soft-panel">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Table
            columns={columns}
            dataSource={items}
            pagination={false}
            rowKey="id"
          />
        </Space>
      </Card>
      <Modal
        footer={null}
        onCancel={closeModal}
        open={modalOpen}
        title={editing ? 'Editar rota de saída' : 'Nova rota de saída'}
      >
        <Form form={form} layout="vertical" onFinish={saveRoute}>
          <Form.Item label="Nome" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Padrao discado" name="pattern" rules={[{ required: true }]}>
            <Input placeholder="0XX[1-9]XXXXXXXX" />
          </Form.Item>
          <Form.Item label="Tronco" name="trunk" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Prioridade" name="priority" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Ativa" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={closeModal}>Cancelar</Button>
            <Button htmlType="submit" type="primary">
              {editing ? 'Salvar rota' : 'Criar rota'}
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}


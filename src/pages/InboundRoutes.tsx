import {
  DeleteOutlined,
  EditOutlined,
  LoginOutlined,
  PlusOutlined,
  SwapRightOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import DestinationPicker from '../components/DestinationPicker';
import PageHeader from '../components/PageHeader';
import { callCalendars, InboundRoute, inboundRoutes } from '../services/mockData';

type InboundRouteFormValues = Omit<InboundRoute, 'id'>;

export default function InboundRoutes() {
  const [form] = Form.useForm<InboundRouteFormValues>();
  const [items, setItems] = useState(inboundRoutes);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InboundRoute | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  function openCreate() {
    setEditing(null);
    form.setFieldsValue({ enabled: true, schedule: callCalendars[0]?.name ?? 'Comercial' });
    setModalOpen(true);
  }

  function openEdit(route: InboundRoute) {
    setEditing(route);
    form.setFieldsValue(route);
    setModalOpen(true);
  }

  function closeModal() {
    form.resetFields();
    setEditing(null);
    setModalOpen(false);
  }

  function saveRoute(values: InboundRouteFormValues) {
    if (editing) {
      setItems((current) =>
        current.map((item) =>
          item.id === editing.id ? { ...values, id: editing.id } : item,
        ),
      );
      messageApi.success(`Rota do DID ${values.did} atualizada.`);
    } else {
      setItems((current) => [
        ...current,
        { ...values, id: `in-${Date.now()}` },
      ]);
      messageApi.success(`Rota do DID ${values.did} criada.`);
    }

    closeModal();
  }

  function removeRoute(route: InboundRoute) {
    setItems((current) => current.filter((item) => item.id !== route.id));
    messageApi.success(`Rota do DID ${route.did} apagada.`);
  }

  const columns: ColumnsType<InboundRoute> = [
    {
      title: 'DID',
      dataIndex: 'did',
      key: 'did',
      render: (value: string) => <Tag icon={<LoginOutlined />}>{value}</Tag>,
    },
    { title: 'Descricao', dataIndex: 'description', key: 'description' },
    {
      title: 'Destino',
      key: 'destination',
      render: (_, record) => (
        <div className="route-flow">
          <Tag>{record.did}</Tag>
          <SwapRightOutlined />
          <Tag color="green">{record.destination}</Tag>
        </div>
      ),
    },
    { title: 'Horario', dataIndex: 'schedule', key: 'schedule' },
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
            aria-label={`Editar rota do DID ${route.did}`}
            title={`Editar rota do DID ${route.did}`}
            icon={<EditOutlined />}
            onClick={() => openEdit(route)}
            size="small"
          />
          <Popconfirm
          cancelText="Cancelar"
          okButtonProps={{ danger: true }}
          okText="Apagar"
          onConfirm={() => removeRoute(route)}
          title={`Apagar a rota do DID ${route.did}?`}
        >
          <Button
            aria-label={`Apagar rota do DID ${route.did}`}
            title={`Apagar rota do DID ${route.did}`}
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
        kicker="DIDs e destinos"
        title="Rotas de entrada"
        description="Controle números publicados, horários de atendimento e destinos como URA, filas ou ramais."
      />
      <Card className="soft-panel">
        <Table
          columns={columns}
          dataSource={items}
          pagination={false}
          rowKey="id"
        />
      </Card>
      <Modal
        footer={null}
        onCancel={closeModal}
        open={modalOpen}
        title={editing ? 'Editar rota de entrada' : 'Nova rota de entrada'}
      >
        <Form form={form} layout="vertical" onFinish={saveRoute}>
          <Form.Item label="DID" name="did" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Descricao" name="description" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Destino" name="destination" rules={[{ required: true }]}>
            <DestinationPicker />
          </Form.Item>
          <Form.Item label="Calendário / horário" name="schedule" rules={[{ required: true }]}>
            <Select
              options={callCalendars.map((calendar) => ({
                label: calendar.name,
                value: calendar.name,
              }))}
            />
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


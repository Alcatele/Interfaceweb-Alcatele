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
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import DestinationPicker from '../components/DestinationPicker';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/useAuth';
import { getApiErrorMessage } from '../services/api';
import { mvpApi } from '../services/mvpApi';
import type { InboundRoute } from '../services/mockData';

type FormValues = Omit<InboundRoute, 'id'>;

export default function InboundRoutes() {
  const [form] = Form.useForm<FormValues>();
  const { activeTenant, hasPermission } = useAuth();
  const [items, setItems] = useState<InboundRoute[]>([]);
  const [editing, setEditing] = useState<InboundRoute | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();
  const canManage = hasPermission('pbx.configure');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await mvpApi.listInboundRoutes());
    } catch {
      messageApi.error('Não foi possível carregar as rotas.');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void load();
  }, [activeTenant?.id, load]);

  async function save(values: FormValues) {
    try {
      if (editing) {
        await mvpApi.updateInboundRoute(editing.id, values);
      } else {
        await mvpApi.createInboundRoute(values);
      }
      messageApi.success('Rota enviada para provisionamento.');
      setOpen(false);
      setEditing(null);
      form.resetFields();
      await load();
    } catch (error) {
      messageApi.error(
        getApiErrorMessage(error, 'Não foi possível salvar a rota.'),
      );
    }
  }

  async function remove(route: InboundRoute) {
    try {
      await mvpApi.removeInboundRoute(route.id);
      await load();
    } catch {
      messageApi.error('Não foi possível remover a rota.');
    }
  }

  const columns: ColumnsType<InboundRoute> = [
    {
      title: 'DID',
      dataIndex: 'did',
      key: 'did',
      render: (value: string) => <Tag icon={<LoginOutlined />}>{value}</Tag>,
    },
    { title: 'Descrição', dataIndex: 'description', key: 'description' },
    {
      title: 'Destino',
      key: 'destination',
      render: (_, route) => (
        <div className="route-flow">
          <Tag>{route.did}</Tag>
          <SwapRightOutlined />
          <Tag color="green">{route.destination}</Tag>
        </div>
      ),
    },
    { title: 'Horário', dataIndex: 'schedule', key: 'schedule' },
    {
      title: 'Ativa',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => <Switch checked={enabled} disabled />,
    },
    {
      title: 'Sincronização',
      dataIndex: 'syncStatus',
      key: 'syncStatus',
      render: (status: string) => (
        <Tag color={status === 'synced' ? 'success' : 'warning'}>
          {status ?? 'pending'}
        </Tag>
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, route) =>
        canManage ? (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(route);
                form.setFieldsValue(route);
                setOpen(true);
              }}
              size="small"
            />
            <Popconfirm
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
              okText="Apagar"
              onConfirm={() => void remove(route)}
              title={`Apagar a rota ${route.did}?`}
            >
              <Button danger icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          </Space>
        ) : null,
    },
  ];

  return (
    <>
      {contextHolder}
      <PageHeader
        actions={
          canManage ? (
            <Button
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                form.setFieldsValue({ enabled: true, schedule: 'Sempre' });
                setOpen(true);
              }}
              type="primary"
            >
              Nova rota
            </Button>
          ) : undefined
        }
        kicker="DIDs"
        title="Rotas de entrada"
        description="Associe números publicados a destinos do FusionPBX."
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
        onCancel={() => setOpen(false)}
        open={open}
        title={editing ? 'Editar rota' : 'Nova rota'}
      >
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item label="DID" name="did" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="Descrição"
            name="description"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Destino"
            name="destination"
            rules={[{ required: true }]}
          >
            <DestinationPicker />
          </Form.Item>
          <Form.Item
            label="Horário"
            name="schedule"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Ativa" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button htmlType="submit" type="primary">
              Salvar
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}

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
  Select,
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
import { getApiErrorMessage } from '../services/api';
import { mvpApi } from '../services/mvpApi';
import type { OutboundRoute, SipTrunk } from '../services/mockData';

type RouteRow = OutboundRoute & { trunkId: string };
type FormValues = Omit<OutboundRoute, 'id' | 'trunk'> & { trunkId: string };

export default function OutboundRoutes() {
  const [form] = Form.useForm<FormValues>();
  const { activeTenant, hasPermission } = useAuth();
  const [items, setItems] = useState<RouteRow[]>([]);
  const [trunks, setTrunks] = useState<SipTrunk[]>([]);
  const [editing, setEditing] = useState<RouteRow | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();
  const canManage = hasPermission('pbx.configure');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [routes, nextTrunks] = await Promise.all([
        mvpApi.listOutboundRoutes(),
        mvpApi.listTrunks(),
      ]);
      setItems(routes);
      setTrunks(nextTrunks);
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
        await mvpApi.updateOutboundRoute(editing.id, values);
      } else {
        await mvpApi.createOutboundRoute(values);
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

  async function remove(route: RouteRow) {
    try {
      await mvpApi.removeOutboundRoute(route.id);
      await load();
    } catch {
      messageApi.error('Não foi possível remover a rota.');
    }
  }

  const columns: ColumnsType<RouteRow> = [
    { title: 'Prioridade', dataIndex: 'priority', key: 'priority' },
    { title: 'Nome', dataIndex: 'name', key: 'name' },
    {
      title: 'Padrão',
      dataIndex: 'pattern',
      key: 'pattern',
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: 'Fluxo',
      key: 'flow',
      render: (_, route) => (
        <div className="route-flow">
          <Tag>Discagem</Tag>
          <SwapRightOutlined />
          <Tag color="blue">{route.pattern}</Tag>
          <SwapRightOutlined />
          <Tag color="green">{route.trunk}</Tag>
        </div>
      ),
    },
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
              title={`Apagar a rota ${route.name}?`}
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
              disabled={trunks.length === 0}
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                form.setFieldsValue({
                  enabled: true,
                  priority: items.length + 1,
                  trunkId: trunks[0]?.id,
                });
                setOpen(true);
              }}
              type="primary"
            >
              Nova rota
            </Button>
          ) : undefined
        }
        kicker="Discagem"
        title="Rotas de saída"
        description="Defina padrões e o tronco utilizado em cada tipo de chamada."
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
          <Form.Item label="Nome" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Padrão" name="pattern" rules={[{ required: true }]}>
            <Input placeholder="^0?[1-9][0-9]{9,10}$" />
          </Form.Item>
          <Form.Item label="Tronco" name="trunkId" rules={[{ required: true }]}>
            <Select
              options={trunks.map((trunk) => ({
                label: trunk.name,
                value: trunk.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            label="Prioridade"
            name="priority"
            rules={[{ required: true }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
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

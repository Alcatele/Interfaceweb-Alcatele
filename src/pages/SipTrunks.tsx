import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SyncOutlined,
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
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import StatusTag from '../components/StatusTag';
import { useAuth } from '../contexts/useAuth';
import { mvpApi } from '../services/mvpApi';
import type { SipTrunk } from '../services/mockData';

type TrunkFormValues = Pick<
  SipTrunk,
  'name' | 'provider' | 'host' | 'channels' | 'status'
>;

export default function SipTrunks() {
  const [form] = Form.useForm<TrunkFormValues>();
  const { activeTenant, hasPermission } = useAuth();
  const [items, setItems] = useState<SipTrunk[]>([]);
  const [editing, setEditing] = useState<SipTrunk | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const canManage = hasPermission('pbx.configure');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await mvpApi.listTrunks());
    } catch {
      messageApi.error('Não foi possível carregar os troncos.');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void load();
  }, [activeTenant?.id, load]);

  async function save(values: TrunkFormValues) {
    try {
      if (editing) {
        await mvpApi.updateTrunk(editing.id, values);
      } else {
        await mvpApi.createTrunk(values);
      }
      messageApi.success('Tronco salvo e enviado para provisionamento.');
      form.resetFields();
      setEditing(null);
      setModalOpen(false);
      await load();
    } catch {
      messageApi.error('Não foi possível salvar o tronco.');
    }
  }

  async function remove(trunk: SipTrunk) {
    try {
      await mvpApi.removeTrunk(trunk.id);
      await load();
    } catch {
      messageApi.error('Não foi possível remover o tronco.');
    }
  }

  async function synchronize() {
    setSyncing(true);
    try {
      const result = await mvpApi.syncFusionPbx();
      messageApi.success(`${result.synchronized} recursos sincronizados.`);
      await load();
    } catch {
      messageApi.error('Falha na sincronização.');
    } finally {
      setSyncing(false);
    }
  }

  const columns: ColumnsType<SipTrunk> = [
    { title: 'Nome', dataIndex: 'name', key: 'name' },
    { title: 'Operadora', dataIndex: 'provider', key: 'provider' },
    { title: 'Host', dataIndex: 'host', key: 'host' },
    { title: 'Canais', dataIndex: 'channels', key: 'channels' },
    {
      title: 'Latência',
      dataIndex: 'latency',
      key: 'latency',
      render: (value: number) => <Tag>{value} ms</Tag>,
    },
    {
      title: 'Registro',
      dataIndex: 'status',
      key: 'status',
      render: (_, record) => <StatusTag status={record.status} />,
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
      render: (_, trunk) =>
        canManage ? (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(trunk);
                form.setFieldsValue(trunk);
                setModalOpen(true);
              }}
              size="small"
            />
            <Popconfirm
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
              okText="Apagar"
              onConfirm={() => void remove(trunk)}
              title={`Apagar o tronco ${trunk.name}?`}
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
            <>
              <Button
                icon={<SyncOutlined />}
                loading={syncing}
                onClick={() => void synchronize()}
              >
                Sincronizar
              </Button>
              <Button
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditing(null);
                  form.setFieldsValue({
                    channels: 10,
                    status: 'warning',
                  });
                  setModalOpen(true);
                }}
                type="primary"
              >
                Novo tronco
              </Button>
            </>
          ) : undefined
        }
        kicker="Conectividade SIP"
        title="Troncos SIP"
        description="Troncos do tenant e estado observado pelo FusionPBX."
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
        title={editing ? 'Editar tronco' : 'Novo tronco'}
      >
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item label="Nome" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="Operadora"
            name="provider"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Host" name="host" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="Canais"
            name="channels"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item hidden name="status">
            <Input />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button htmlType="submit" type="primary">
              Salvar
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}

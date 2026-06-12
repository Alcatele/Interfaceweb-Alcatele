import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
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
import type { Extension } from '../services/mockData';

type ExtensionFormValues = Pick<
  Extension,
  'number' | 'name' | 'department' | 'device' | 'status'
>;

export default function Extensions() {
  const [form] = Form.useForm<ExtensionFormValues>();
  const { activeTenant, hasPermission } = useAuth();
  const [items, setItems] = useState<Extension[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Extension | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();
  const canManage = hasPermission('pbx.configure');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await mvpApi.listExtensions());
    } catch {
      messageApi.error('Não foi possível carregar os ramais.');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void load();
  }, [activeTenant?.id, load]);

  function openCreate() {
    setEditing(null);
    form.setFieldsValue({
      department: 'Geral',
      device: 'Webphone',
      status: 'offline',
    });
    setModalOpen(true);
  }

  function openEdit(extension: Extension) {
    setEditing(extension);
    form.setFieldsValue(extension);
    setModalOpen(true);
  }

  async function save(values: ExtensionFormValues) {
    try {
      if (editing) {
        await mvpApi.updateExtension(editing.id, values);
      } else {
        await mvpApi.createExtension(values);
      }
      messageApi.success('Ramal salvo e enviado para provisionamento.');
      form.resetFields();
      setEditing(null);
      setModalOpen(false);
      await load();
    } catch {
      messageApi.error('Não foi possível salvar o ramal.');
    }
  }

  async function remove(extension: Extension) {
    try {
      await mvpApi.removeExtension(extension.id);
      messageApi.success('Exclusão enviada para o FusionPBX.');
      await load();
    } catch {
      messageApi.error('Não foi possível remover o ramal.');
    }
  }

  const columns: ColumnsType<Extension> = [
    { title: 'Ramal', dataIndex: 'number', key: 'number' },
    { title: 'Usuário', dataIndex: 'name', key: 'name' },
    { title: 'Departamento', dataIndex: 'department', key: 'department' },
    { title: 'Dispositivo', dataIndex: 'device', key: 'device' },
    { title: 'IP', dataIndex: 'ip', key: 'ip' },
    {
      title: 'Presença',
      dataIndex: 'status',
      key: 'status',
      render: (_, record) => <StatusTag status={record.status} />,
    },
    { title: 'Última atividade', dataIndex: 'lastSeen', key: 'lastSeen' },
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
      render: (_, extension) =>
        canManage ? (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => openEdit(extension)}
              size="small"
            />
            <Popconfirm
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
              okText="Apagar"
              onConfirm={() => void remove(extension)}
              title={`Apagar o ramal ${extension.number}?`}
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
              <Button icon={<ReloadOutlined />} onClick={() => void load()}>
                Atualizar
              </Button>
              <Button icon={<PlusOutlined />} onClick={openCreate} type="primary">
                Novo ramal
              </Button>
            </>
          ) : undefined
        }
        kicker="FusionPBX"
        title="Ramais"
        description="Inventário de ramais do tenant ativo e estado de provisionamento."
      />
      <Card className="soft-panel">
        <Table
          columns={columns}
          dataSource={items}
          loading={loading}
          pagination={{ pageSize: 10 }}
          rowKey="id"
        />
      </Card>
      <Modal
        footer={null}
        onCancel={() => setModalOpen(false)}
        open={modalOpen}
        title={editing ? 'Editar ramal' : 'Novo ramal'}
      >
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item label="Ramal" name="number" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Usuário" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="Departamento"
            name="department"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Dispositivo"
            name="device"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Status" name="status" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'Online', value: 'online' },
                { label: 'Offline', value: 'offline' },
                { label: 'Atenção', value: 'warning' },
              ]}
            />
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

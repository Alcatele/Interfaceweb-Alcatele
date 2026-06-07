import {
  DeleteOutlined,
  EditOutlined,
  PhoneOutlined,
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
import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import StatusTag from '../components/StatusTag';
import { useAuth } from '../contexts/useAuth';
import { Extension, extensions } from '../services/mockData';

type ExtensionFormValues = Omit<Extension, 'id'>;

export default function Extensions() {
  const [form] = Form.useForm<ExtensionFormValues>();
  const { hasPermission } = useAuth();
  const [items, setItems] = useState(extensions);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Extension | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const canManageExtensions = hasPermission('pbx.configure');

  function openCreate() {
    setEditing(null);
    form.setFieldsValue({
      tenantId: 'tenant-alcatele',
      status: 'online',
      lastSeen: 'Agora',
    });
    setModalOpen(true);
  }

  function openEdit(extension: Extension) {
    setEditing(extension);
    form.setFieldsValue(extension);
    setModalOpen(true);
  }

  function closeModal() {
    form.resetFields();
    setEditing(null);
    setModalOpen(false);
  }

  function saveExtension(values: ExtensionFormValues) {
    if (editing) {
      setItems((current) =>
        current.map((item) =>
          item.id === editing.id ? { ...values, id: editing.id } : item,
        ),
      );
      messageApi.success(`Ramal ${values.number} atualizado.`);
    } else {
      setItems((current) => [
        ...current,
        { ...values, id: `ext-${values.number || Date.now()}` },
      ]);
      messageApi.success(`Ramal ${values.number} criado.`);
    }

    closeModal();
  }

  function removeExtension(extension: Extension) {
    setItems((current) => current.filter((item) => item.id !== extension.id));
    messageApi.success(`Ramal ${extension.number} apagado.`);
  }

  function callExtension(extension: Extension) {
    messageApi.success(`Chamando ramal ${extension.number} - ${extension.name}.`);
  }

  const columns: ColumnsType<Extension> = [
    {
      title: 'Ramal',
      dataIndex: 'number',
      key: 'number',
      sorter: (a, b) => a.number.localeCompare(b.number),
    },
    { title: 'Usuário', dataIndex: 'name', key: 'name' },
    {
      title: 'Departamento',
      dataIndex: 'department',
      key: 'department',
      filters: [
        { text: 'Comercial', value: 'Comercial' },
        { text: 'Suporte', value: 'Suporte' },
        { text: 'Financeiro', value: 'Financeiro' },
        { text: 'Operações', value: 'Operações' },
      ],
      onFilter: (value, record) => record.department === value,
    },
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
      title: 'Perfil',
      key: 'profile',
      render: () => <Tag color="blue">Standard</Tag>,
    },
    {
      title: 'Ações',
      key: 'actions',
      width: canManageExtensions ? 132 : 70,
      render: (_, extension) => (
        <Space>
          <Button
            aria-label={`Chamar ramal ${extension.number}`}
            title={`Chamar ramal ${extension.number}`}
            icon={<PhoneOutlined />}
            onClick={() => callExtension(extension)}
            size="small"
          />
          {canManageExtensions ? (
            <>
              <Button
                aria-label={`Editar ramal ${extension.number}`}
                title={`Editar ramal ${extension.number}`}
                icon={<EditOutlined />}
                onClick={() => openEdit(extension)}
                size="small"
              />
              <Popconfirm
                cancelText="Cancelar"
                okButtonProps={{ danger: true }}
                okText="Apagar"
                onConfirm={() => removeExtension(extension)}
                title={`Apagar o ramal ${extension.number}?`}
              >
                <Button
                  aria-label={`Apagar ramal ${extension.number}`}
                  title={`Apagar ramal ${extension.number}`}
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                />
              </Popconfirm>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  const headerActions = canManageExtensions ? (
    <>
      <Button
        icon={<ReloadOutlined />}
        onClick={() => messageApi.success('Ramais sincronizados.')}
      >
        Sincronizar
      </Button>
      <Button icon={<PlusOutlined />} onClick={openCreate} type="primary">
        Novo ramal
      </Button>
    </>
  ) : undefined;

  return (
    <>
      {contextHolder}
      <PageHeader
        actions={headerActions}
        kicker="Usuários e dispositivos"
        title="Ramais"
        description="Consulte ramais, presença SIP, aparelhos, departamentos e perfis de chamada."
      />
      <Card className="soft-panel">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Input.Search
            allowClear
            placeholder="Buscar por ramal, usuário, departamento ou IP"
            style={{ maxWidth: 440 }}
          />
          <Table
            columns={columns}
            dataSource={items}
            pagination={{ pageSize: 8 }}
            rowKey="id"
          />
        </Space>
      </Card>
      {canManageExtensions ? (
        <Modal
          footer={null}
          onCancel={closeModal}
          open={modalOpen}
          title={editing ? 'Editar ramal' : 'Novo ramal'}
        >
          <Form form={form} layout="vertical" onFinish={saveExtension}>
            <Space align="start" size={12} style={{ width: '100%' }}>
              <Form.Item
                label="Ramal"
                name="number"
                rules={[{ required: true, message: 'Informe o ramal.' }]}
                style={{ width: 130 }}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Usuário"
                name="name"
                rules={[{ required: true, message: 'Informe o usuário.' }]}
                style={{ flex: 1 }}
              >
                <Input />
              </Form.Item>
            </Space>
            <Form.Item hidden name="tenantId">
              <Input />
            </Form.Item>
            <Form.Item label="Departamento" name="department" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Dispositivo" name="device" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="IP" name="ip" rules={[{ required: true }]}>
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
            <Form.Item label="Última atividade" name="lastSeen" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
              <Button onClick={closeModal}>Cancelar</Button>
              <Button htmlType="submit" type="primary">
                {editing ? 'Salvar ramal' : 'Criar ramal'}
              </Button>
            </Space>
          </Form>
        </Modal>
      ) : null}
    </>
  );
}


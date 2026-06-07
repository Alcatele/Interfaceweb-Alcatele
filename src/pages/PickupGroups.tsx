import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  TeamOutlined,
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
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/useAuth';
import {
  extensions,
  pickupGroups,
  type PickupGroup,
} from '../services/mockData';

type PickupGroupValues = Omit<PickupGroup, 'id' | 'tenantId' | 'enabled'>;

const extensionOptions = extensions.map((extension) => ({
  label: `${extension.number} - ${extension.name}`,
  value: extension.number,
}));

export default function PickupGroups() {
  const [form] = Form.useForm<PickupGroupValues>();
  const [items, setItems] = useState(pickupGroups);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PickupGroup | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('call-groups.manage');

  function openCreate() {
    setEditingGroup(null);
    form.resetFields();
    setModalOpen(true);
  }

  function openEdit(group: PickupGroup) {
    setEditingGroup(group);
    form.setFieldsValue(group);
    setModalOpen(true);
  }

  function closeModal() {
    form.resetFields();
    setEditingGroup(null);
    setModalOpen(false);
  }

  function createGroup(values: PickupGroupValues) {
    if (editingGroup) {
      setItems((current) =>
        current.map((item) =>
          item.id === editingGroup.id ? { ...item, ...values } : item,
        ),
      );
      messageApi.success(`Grupo ${values.name} atualizado.`);
      closeModal();
      return;
    }

    setItems((current) => [
      ...current,
      {
        ...values,
        id: `pickup-${Date.now()}`,
        tenantId: 'tenant-alcatele',
        enabled: true,
      },
    ]);
    closeModal();
    messageApi.success(`Grupo ${values.name} criado.`);
  }

  function removeGroup(group: PickupGroup) {
    setItems((current) => current.filter((item) => item.id !== group.id));
    messageApi.success(`Grupo ${group.name} apagado.`);
  }

  function toggleGroup(groupId: string, enabled: boolean) {
    setItems((current) =>
      current.map((item) =>
        item.id === groupId ? { ...item, enabled } : item,
      ),
    );
  }

  const columns: ColumnsType<PickupGroup> = [
    { title: 'Grupo', dataIndex: 'name', key: 'name' },
    {
      title: 'Codigo de captura',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: 'Ramais membros',
      dataIndex: 'members',
      key: 'members',
      render: (members: string[]) => (
        <Space size={[4, 4]} wrap>
          {members.map((member) => (
            <Tag icon={<TeamOutlined />} key={member}>
              {member}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Ativo',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean, group) => (
        <Switch
          checked={enabled}
          disabled={!canManage}
          onChange={(checked) => toggleGroup(group.id, checked)}
        />
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 80,
      render: (_, group) => (
        canManage ? (
          <Space>
            <Button
              aria-label={`Editar grupo ${group.name}`}
              title={`Editar grupo ${group.name}`}
              icon={<EditOutlined />}
              onClick={() => openEdit(group)}
              size="small"
            />
            <Popconfirm
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
              okText="Apagar"
              onConfirm={() => removeGroup(group)}
              title={`Apagar o grupo ${group.name}?`}
            >
              <Button
                aria-label={`Apagar grupo ${group.name}`}
                title={`Apagar grupo ${group.name}`}
                danger
                icon={<DeleteOutlined />}
                size="small"
              />
            </Popconfirm>
          </Space>
        ) : null
      ),
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
              onClick={openCreate}
              type="primary"
            >
              Novo grupo
            </Button>
          ) : null
        }
        description="Organize ramais que podem capturar chamadas entre si usando um código de facilidade."
        kicker="Captura de chamadas"
        title="Grupos de captura"
      />
      <Card className="soft-panel">
        <Table columns={columns} dataSource={items} pagination={false} rowKey="id" />
      </Card>

      <Modal
        footer={null}
        onCancel={closeModal}
        open={modalOpen}
        title={editingGroup ? 'Editar grupo de captura' : 'Novo grupo de captura'}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={createGroup}
          requiredMark={false}
        >
          <Form.Item
            label="Nome do grupo"
            name="name"
            rules={[{ required: true, message: 'Informe o nome do grupo.' }]}
          >
            <Input placeholder="Ex.: Comercial" />
          </Form.Item>
          <Form.Item
            label="Codigo de captura"
            name="code"
            rules={[{ required: true, message: 'Informe o código de captura.' }]}
          >
            <Input placeholder="Ex.: *81" />
          </Form.Item>
          <Form.Item
            label="Ramais membros"
            name="members"
            rules={[{ required: true, message: 'Selecione ao menos um ramal.' }]}
          >
            <Select mode="multiple" options={extensionOptions} />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={closeModal}>Cancelar</Button>
            <Button htmlType="submit" type="primary">
              {editingGroup ? 'Salvar grupo' : 'Criar grupo'}
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}


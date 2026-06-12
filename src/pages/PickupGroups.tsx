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
import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/useAuth';
import { getApiErrorMessage } from '../services/api';
import { mvpApi, type TenantResources } from '../services/mvpApi';
import type { Extension, PickupGroup } from '../services/mockData';

type PickupGroupValues = Omit<PickupGroup, 'id' | 'tenantId' | 'syncStatus'>;

export default function PickupGroups() {
  const [form] = Form.useForm<PickupGroupValues>();
  const [items, setItems] = useState<PickupGroup[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [resources, setResources] = useState<TenantResources | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PickupGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();
  const { activeTenant, hasPermission } = useAuth();
  const canManage = hasPermission('pbx.configure');
  const limit = resources?.limits.pickupGroups ?? 0;
  const used = resources?.usage.pickupGroups ?? items.length;
  const limitReached = used >= limit;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [groups, nextExtensions, nextResources] = await Promise.all([
        mvpApi.listPickupGroups(),
        mvpApi.listExtensions(),
        mvpApi.tenantResources(),
      ]);
      setItems(groups);
      setExtensions(nextExtensions);
      setResources(nextResources);
    } catch (error) {
      messageApi.error(
        getApiErrorMessage(
          error,
          'Não foi possível carregar os grupos de captura.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void load();
  }, [activeTenant?.id, load]);

  function openCreate() {
    setEditingGroup(null);
    form.setFieldsValue({ enabled: true, members: [] });
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

  async function save(values: PickupGroupValues) {
    try {
      if (editingGroup) {
        await mvpApi.updatePickupGroup(editingGroup.id, values);
      } else {
        await mvpApi.createPickupGroup(values);
      }
      messageApi.success('Grupo enviado para provisionamento.');
      closeModal();
      await load();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error));
    }
  }

  async function removeGroup(group: PickupGroup) {
    try {
      await mvpApi.removePickupGroup(group.id);
      messageApi.success(`Grupo ${group.name} removido.`);
      await load();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error));
    }
  }

  async function toggleGroup(group: PickupGroup, enabled: boolean) {
    try {
      await mvpApi.updatePickupGroup(group.id, { ...group, enabled });
      await load();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error));
    }
  }

  const extensionOptions = extensions.map((extension) => ({
    label: `${extension.number} - ${extension.name}`,
    value: extension.number,
  }));

  const columns: ColumnsType<PickupGroup> = [
    { title: 'Grupo', dataIndex: 'name', key: 'name' },
    {
      title: 'Código de captura',
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
      title: 'Ativo',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean, group) => (
        <Switch
          checked={enabled}
          disabled={!canManage}
          onChange={(checked) => void toggleGroup(group, checked)}
        />
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 100,
      render: (_, group) =>
        canManage ? (
          <Space>
            <Button
              aria-label={`Editar grupo ${group.name}`}
              icon={<EditOutlined />}
              onClick={() => openEdit(group)}
              size="small"
            />
            <Popconfirm
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
              okText="Apagar"
              onConfirm={() => void removeGroup(group)}
              title={`Apagar o grupo ${group.name}?`}
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
          <>
            <Tag color={limitReached ? 'warning' : 'blue'}>
              Contratado: {used}/{limit}
            </Tag>
            {canManage ? (
              <Button
                disabled={limitReached}
                icon={<PlusOutlined />}
                onClick={openCreate}
                type="primary"
              >
                Novo grupo
              </Button>
            ) : null}
          </>
        }
        description="Organize ramais que podem capturar chamadas entre si usando um código de facilidade."
        kicker="Captura de chamadas"
        title="Grupos de captura"
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
        onCancel={closeModal}
        open={modalOpen}
        title={editingGroup ? 'Editar grupo de captura' : 'Novo grupo de captura'}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={save}
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
            label="Código de captura"
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
          <Form.Item label="Ativo" name="enabled" valuePropName="checked">
            <Switch />
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

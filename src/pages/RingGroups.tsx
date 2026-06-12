import {
  DeleteOutlined,
  EditOutlined,
  PhoneOutlined,
  PlusOutlined,
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
import DestinationPicker from '../components/DestinationPicker';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/useAuth';
import { getApiErrorMessage } from '../services/api';
import { mvpApi, type TenantResources } from '../services/mvpApi';
import type { Extension, RingGroup } from '../services/mockData';

type RingGroupValues = Omit<RingGroup, 'id' | 'tenantId' | 'syncStatus'>;

const strategyLabels: Record<RingGroup['strategy'], string> = {
  simultaneous: 'Tocar todos',
  sequential: 'Sequencial',
  random: 'Aleatório',
};

export default function RingGroups() {
  const [form] = Form.useForm<RingGroupValues>();
  const [items, setItems] = useState<RingGroup[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [resources, setResources] = useState<TenantResources | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<RingGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();
  const { activeTenant, hasPermission } = useAuth();
  const canManage = hasPermission('pbx.configure');
  const limit = resources?.limits.ringGroups ?? 0;
  const used = resources?.usage.ringGroups ?? items.length;
  const limitReached = used >= limit;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [groups, nextExtensions, nextResources] = await Promise.all([
        mvpApi.listRingGroups(),
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
          'Não foi possível carregar os grupos de chamada.',
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
    form.setFieldsValue({
      strategy: 'simultaneous',
      timeout: 25,
      enabled: true,
      members: [],
    });
    setModalOpen(true);
  }

  function openEdit(group: RingGroup) {
    setEditingGroup(group);
    form.setFieldsValue(group);
    setModalOpen(true);
  }

  function closeModal() {
    form.resetFields();
    setEditingGroup(null);
    setModalOpen(false);
  }

  async function save(values: RingGroupValues) {
    try {
      if (editingGroup) {
        await mvpApi.updateRingGroup(editingGroup.id, values);
      } else {
        await mvpApi.createRingGroup(values);
      }
      messageApi.success('Grupo enviado para provisionamento.');
      closeModal();
      await load();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error));
    }
  }

  async function removeGroup(group: RingGroup) {
    try {
      await mvpApi.removeRingGroup(group.id);
      messageApi.success(`Grupo ${group.name} removido.`);
      await load();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error));
    }
  }

  async function toggleGroup(group: RingGroup, enabled: boolean) {
    try {
      await mvpApi.updateRingGroup(group.id, { ...group, enabled });
      await load();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error));
    }
  }

  const extensionOptions = extensions.map((extension) => ({
    label: `${extension.number} - ${extension.name}`,
    value: extension.number,
  }));

  const columns: ColumnsType<RingGroup> = [
    { title: 'Grupo', dataIndex: 'name', key: 'name' },
    {
      title: 'Número',
      dataIndex: 'number',
      key: 'number',
      render: (number: string) => <Tag color="blue">{number}</Tag>,
    },
    {
      title: 'Estratégia',
      dataIndex: 'strategy',
      key: 'strategy',
      render: (strategy: RingGroup['strategy']) => strategyLabels[strategy],
    },
    {
      title: 'Ramais',
      dataIndex: 'members',
      key: 'members',
      render: (members: string[]) => (
        <Space size={[4, 4]} wrap>
          {members.map((member) => (
            <Tag icon={<PhoneOutlined />} key={member}>
              {member}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Tempo',
      dataIndex: 'timeout',
      key: 'timeout',
      render: (timeout: number) => `${timeout}s`,
    },
    { title: 'Destino sem resposta', dataIndex: 'fallback', key: 'fallback' },
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
        description="Distribua chamadas entre vários ramais e defina estratégia, tempo de toque e destino alternativo."
        kicker="Distribuição de chamadas"
        title="Grupos de chamada"
      />
      <Card className="soft-panel">
        <Table
          columns={columns}
          dataSource={items}
          loading={loading}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1180 }}
        />
      </Card>

      <Modal
        footer={null}
        onCancel={closeModal}
        open={modalOpen}
        title={editingGroup ? 'Editar grupo de chamada' : 'Novo grupo de chamada'}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={save}
          requiredMark={false}
        >
          <Space align="start" size={12} style={{ width: '100%' }}>
            <Form.Item
              label="Nome do grupo"
              name="name"
              rules={[{ required: true, message: 'Informe o nome.' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="Ex.: Recepção" />
            </Form.Item>
            <Form.Item
              label="Número"
              name="number"
              rules={[{ required: true, message: 'Informe o número.' }]}
              style={{ width: 130 }}
            >
              <Input placeholder="7001" />
            </Form.Item>
          </Space>
          <Form.Item
            label="Estratégia de toque"
            name="strategy"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { label: 'Tocar todos', value: 'simultaneous' },
                { label: 'Sequencial', value: 'sequential' },
                { label: 'Aleatório', value: 'random' },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="Ramais membros"
            name="members"
            rules={[{ required: true, message: 'Selecione ao menos um ramal.' }]}
          >
            <Select mode="multiple" options={extensionOptions} />
          </Form.Item>
          <Form.Item
            label="Tempo de toque"
            name="timeout"
            rules={[{ required: true }]}
          >
            <InputNumber
              addonAfter="segundos"
              min={5}
              max={120}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item
            label="Destino quando não atendido"
            name="fallback"
            rules={[{ required: true, message: 'Informe o destino alternativo.' }]}
          >
            <DestinationPicker />
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

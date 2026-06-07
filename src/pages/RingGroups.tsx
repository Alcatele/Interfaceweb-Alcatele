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
import { useState } from 'react';
import DestinationPicker from '../components/DestinationPicker';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/useAuth';
import { extensions, ringGroups, type RingGroup } from '../services/mockData';

type RingGroupValues = Omit<RingGroup, 'id' | 'tenantId' | 'enabled'>;

const extensionOptions = extensions.map((extension) => ({
  label: `${extension.number} - ${extension.name}`,
  value: extension.number,
}));

const strategyLabels: Record<RingGroup['strategy'], string> = {
  simultaneous: 'Tocar todos',
  sequential: 'Sequencial',
  random: 'Aleatorio',
};

export default function RingGroups() {
  const [form] = Form.useForm<RingGroupValues>();
  const [items, setItems] = useState(ringGroups);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<RingGroup | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('call-groups.manage');

  function openCreate() {
    setEditingGroup(null);
    form.setFieldsValue({ strategy: 'simultaneous', timeout: 25 });
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

  function createGroup(values: RingGroupValues) {
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
        id: `ring-${Date.now()}`,
        tenantId: 'tenant-alcatele',
        enabled: true,
      },
    ]);
    closeModal();
    messageApi.success(`Grupo ${values.name} criado.`);
  }

  function removeGroup(group: RingGroup) {
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

  const columns: ColumnsType<RingGroup> = [
    { title: 'Grupo', dataIndex: 'name', key: 'name' },
    {
      title: 'Numero',
      dataIndex: 'number',
      key: 'number',
      render: (number: string) => <Tag color="blue">{number}</Tag>,
    },
    {
      title: 'Estrategia',
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
        description="Distribua chamadas entre vários ramais e defina estratégia, tempo de toque e destino alternativo."
        kicker="Distribuição de chamadas"
        title="Grupos de toque"
      />
      <Card className="soft-panel">
        <Table
          columns={columns}
          dataSource={items}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1050 }}
        />
      </Card>

      <Modal
        footer={null}
        onCancel={closeModal}
        open={modalOpen}
        title={editingGroup ? 'Editar grupo de toque' : 'Novo grupo de toque'}
      >
        <Form
          form={form}
          initialValues={{ strategy: 'simultaneous', timeout: 25 }}
          layout="vertical"
          onFinish={createGroup}
          requiredMark={false}
        >
          <Space align="start" size={12} style={{ width: '100%' }}>
            <Form.Item
              label="Nome do grupo"
              name="name"
              rules={[{ required: true, message: 'Informe o nome.' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="Ex.: Recepcao" />
            </Form.Item>
            <Form.Item
              label="Numero"
              name="number"
              rules={[{ required: true, message: 'Informe o número.' }]}
              style={{ width: 130 }}
            >
              <Input placeholder="7001" />
            </Form.Item>
          </Space>
          <Form.Item
            label="Estrategia de toque"
            name="strategy"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { label: 'Tocar todos', value: 'simultaneous' },
                { label: 'Sequencial', value: 'sequential' },
                { label: 'Aleatorio', value: 'random' },
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
            <InputNumber addonAfter="segundos" min={5} max={120} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="Destino quando não atendido"
            name="fallback"
            rules={[{ required: true, message: 'Informe o destino alternativo.' }]}
          >
            <DestinationPicker />
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


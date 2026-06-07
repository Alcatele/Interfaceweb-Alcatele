import {
  DeleteOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/useAuth';
import { queues } from '../services/mockData';
import {
  agentPauseOptions,
  createMockUser,
  deleteMockUser,
  listPublicUsers,
  updateMockAgentWorkState,
  type AgentPauseReason,
  type PublicUser,
} from '../services/mockUsers';

type NewAgentValues = {
  name: string;
  username: string;
  email: string;
  extension: string;
  workQueueId: string;
  password: string;
  confirmPassword: string;
};

const queueOptions = queues.map((queue) => ({
  label: `${queue.name} (${queue.number})`,
  value: queue.id,
}));

export default function Agents() {
  const [form] = Form.useForm<NewAgentValues>();
  const [agents, setAgents] = useState<PublicUser[]>(() =>
    listPublicUsers().filter((user) => user.role === 'agent'),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const { currentUser, hasPermission } = useAuth();
  const canManage = hasPermission('agents.manage');

  function refreshAgents() {
    setAgents(listPublicUsers().filter((user) => user.role === 'agent'));
  }

  function closeModal() {
    form.resetFields();
    setModalOpen(false);
  }

  async function createAgent(values: NewAgentValues) {
    setSaving(true);
    const result = await createMockUser({ ...values, role: 'agent' });
    setSaving(false);

    if (!result.success) {
      messageApi.error(result.error);
      return;
    }

    messageApi.success(`Agente ${values.name} criado.`);
    refreshAgents();
    closeModal();
  }

  function updateQueue(userId: string, workQueueId: string) {
    const updated = updateMockAgentWorkState(userId, { workQueueId });

    if (!updated) {
      messageApi.error('Não foi possível alterar a fila.');
      return;
    }

    refreshAgents();
  }

  function updateStatus(userId: string, agentStatus: 'available' | 'paused') {
    const updated = updateMockAgentWorkState(userId, {
      agentStatus,
      pauseReason: agentStatus === 'paused' ? 'quick_break' : undefined,
    });

    if (!updated) {
      messageApi.error('Não foi possível alterar o status.');
      return;
    }

    refreshAgents();
  }

  function updatePauseReason(userId: string, pauseReason: AgentPauseReason) {
    const updated = updateMockAgentWorkState(userId, {
      agentStatus: 'paused',
      pauseReason,
    });

    if (!updated) {
      messageApi.error('Não foi possível alterar o tipo de pausa.');
      return;
    }

    refreshAgents();
  }

  function removeAgent(agent: PublicUser) {
    if (!currentUser) {
      return;
    }

    const result = deleteMockUser(agent.id, currentUser.id);

    if (!result.success) {
      messageApi.error(result.error);
      return;
    }

    messageApi.success(`Agente ${agent.name} apagado.`);
    refreshAgents();
  }

  const columns: ColumnsType<PublicUser> = [
    {
      title: 'Agente',
      key: 'agent',
      render: (_, agent) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{agent.name}</Typography.Text>
          <Typography.Text type="secondary">{agent.email}</Typography.Text>
        </Space>
      ),
    },
    { title: 'Login', dataIndex: 'username', key: 'username' },
    { title: 'Ramal', dataIndex: 'extension', key: 'extension' },
    {
      title: 'Fila de trabalho',
      dataIndex: 'workQueueId',
      key: 'workQueueId',
      render: (value: string | undefined, agent) => (
        <Select
          disabled={!canManage}
          onChange={(workQueueId) => updateQueue(agent.id, workQueueId)}
          options={queueOptions}
          style={{ minWidth: 180 }}
          value={value ?? 'queue-2'}
        />
      ),
    },
    {
      title: 'Atendimento',
      dataIndex: 'agentStatus',
      key: 'agentStatus',
      render: (value: PublicUser['agentStatus'], agent) => (
        <Segmented
          disabled={!canManage}
          onChange={(status) =>
            updateStatus(agent.id, status as 'available' | 'paused')
          }
          options={[
            {
              icon: <PlayCircleOutlined />,
              label: 'Disponível',
              value: 'available',
            },
            {
              icon: <PauseCircleOutlined />,
              label: 'Pausado',
              value: 'paused',
            },
          ]}
          size="small"
          value={value ?? 'available'}
        />
      ),
    },
    {
      title: 'Conta',
      dataIndex: 'status',
      key: 'status',
      render: (status: PublicUser['status']) => (
        <Tag color={status === 'active' ? 'success' : 'default'}>
          {status === 'active' ? 'Ativa' : 'Inativa'}
        </Tag>
      ),
    },
    {
      title: 'Tipo de pausa',
      dataIndex: 'pauseReason',
      key: 'pauseReason',
      render: (value: PublicUser['pauseReason'], agent) => (
        <Select
          disabled={!canManage || agent.agentStatus !== 'paused'}
          onChange={(reason) =>
            updatePauseReason(agent.id, reason as AgentPauseReason)
          }
          options={agentPauseOptions}
          placeholder="Sem pausa"
          style={{ minWidth: 150 }}
          value={agent.agentStatus === 'paused' ? value ?? 'quick_break' : undefined}
        />
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, agent) =>
        canManage ? (
          <Popconfirm
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
            okText="Apagar"
            onConfirm={() => removeAgent(agent)}
            title={`Apagar ${agent.name}?`}
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              size="small"
              title={`Apagar ${agent.name}`}
            />
          </Popconfirm>
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
              onClick={() => setModalOpen(true)}
              type="primary"
            >
              Novo agente
            </Button>
          ) : null
        }
        kicker="Equipe de atendimento"
        title="Agentes"
        description="Administre contas de atendimento, fila de trabalho e disponibilidade operacional."
      />
      <Card className="soft-panel">
        <Table
          columns={columns}
          dataSource={agents}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1080 }}
        />
      </Card>

      <Modal
        forceRender
        footer={null}
        onCancel={closeModal}
        open={modalOpen}
        title="Novo agente"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={createAgent}
          requiredMark={false}
        >
          <Form.Item
            label="Nome completo"
            name="name"
            rules={[{ required: true, message: 'Informe o nome do agente.' }]}
          >
            <Input autoComplete="name" />
          </Form.Item>
          <Space align="start" size={12} style={{ width: '100%' }}>
            <Form.Item
              label="Login"
              name="username"
              rules={[{ required: true, message: 'Informe o login.' }]}
              style={{ flex: 1 }}
            >
              <Input autoComplete="username" />
            </Form.Item>
            <Form.Item
              label="Ramal"
              name="extension"
              rules={[{ required: true, message: 'Informe o ramal.' }]}
              style={{ width: 130 }}
            >
              <Input />
            </Form.Item>
          </Space>
          <Form.Item
            label="E-mail"
            name="email"
            rules={[
              { required: true, message: 'Informe o e-mail.' },
              { type: 'email', message: 'Informe um e-mail valido.' },
            ]}
          >
            <Input autoComplete="email" />
          </Form.Item>
          <Form.Item
            label="Fila inicial"
            name="workQueueId"
            rules={[{ required: true, message: 'Selecione a fila.' }]}
          >
            <Select options={queueOptions} />
          </Form.Item>
          <Form.Item
            label="Senha inicial"
            name="password"
            rules={[
              { required: true, message: 'Informe a senha.' },
              { min: 8, message: 'Use pelo menos 8 caracteres.' },
              {
                pattern: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/,
                message: 'Inclua letras, números e um simbolo.',
              },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            dependencies={['password']}
            label="Confirmar senha"
            name="confirmPassword"
            rules={[
              { required: true, message: 'Confirme a senha.' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue('password') === value
                    ? Promise.resolve()
                    : Promise.reject(new Error('As senhas não coincidem.'));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={closeModal}>Cancelar</Button>
            <Button htmlType="submit" loading={saving} type="primary">
              Criar agente
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}


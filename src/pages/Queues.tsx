import {
  DeleteOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import DestinationPicker from '../components/DestinationPicker';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/useAuth';
import { Queue, queues } from '../services/mockData';
import {
  agentPauseOptions,
  updateMockAgentWorkState,
  type AgentPauseReason,
} from '../services/mockUsers';

type NewQueueFormValues = {
  name: string;
  number: string;
  strategy: string;
  welcomeMessage: string;
  maxWaiting: number;
  overflowAfter: number;
  overflowDestination: string;
};

export default function Queues() {
  const [queueForm] = Form.useForm<NewQueueFormValues>();
  const { currentUser, hasPermission, role } = useAuth();
  const [newQueueOpen, setNewQueueOpen] = useState(false);
  const [editingQueue, setEditingQueue] = useState<Queue | null>(null);
  const [queueItems, setQueueItems] = useState(queues);
  const [messageApi, contextHolder] = message.useMessage();
  const [selectedQueueId, setSelectedQueueId] = useState(
    currentUser?.workQueueId ?? 'queue-2',
  );
  const [agentStatus, setAgentStatus] = useState<'available' | 'paused'>(
    currentUser?.agentStatus ?? 'available',
  );
  const [pauseReason, setPauseReason] = useState<AgentPauseReason>(
    currentUser?.pauseReason ?? 'quick_break',
  );
  const waiting = queueItems.reduce((sum, queue) => sum + queue.waiting, 0);
  const agents = queueItems.reduce((sum, queue) => sum + queue.agents, 0);
  const canManageQueues = hasPermission('queues.manage');
  const isAgent = role === 'agent';
  const queueOptions = queueItems.map((queue) => ({
    label: `${queue.name} (${queue.number})`,
    value: queue.id,
  }));

  function closeQueueModal() {
    queueForm.resetFields();
    setNewQueueOpen(false);
    setEditingQueue(null);
  }

  function openCreateQueue() {
    setEditingQueue(null);
    queueForm.setFieldsValue({
      strategy: 'Tocar todos',
      maxWaiting: 20,
      overflowAfter: 120,
    });
    setNewQueueOpen(true);
  }

  function openEditQueue(queue: Queue) {
    setEditingQueue(queue);
    queueForm.setFieldsValue(queue);
    setNewQueueOpen(true);
  }

  function handleCreateQueue(values: NewQueueFormValues) {
    if (editingQueue) {
      setQueueItems((current) =>
        current.map((queue) =>
          queue.id === editingQueue.id ? { ...queue, ...values } : queue,
        ),
      );
      messageApi.success(`Fila ${values.name} atualizada com sucesso.`);
      closeQueueModal();
      return;
    }

    setQueueItems((current) => [
      ...current,
      {
        id: `queue-${Date.now()}`,
        tenantId: 'tenant-alcatele',
        ...values,
        agents: 0,
        waiting: 0,
        sla: 100,
      },
    ]);
    messageApi.success(`Fila ${values.name} criada com sucesso.`);
    closeQueueModal();
  }

  function handleQueueChange(workQueueId: string) {
    if (!currentUser) {
      return;
    }

    const updated = updateMockAgentWorkState(currentUser.id, { workQueueId });

    if (!updated) {
      messageApi.error('Não foi possível alterar a fila.');
      return;
    }

    setSelectedQueueId(workQueueId);
    messageApi.success('Fila de trabalho atualizada.');
  }

  function handleAgentStatusChange(value: string | number) {
    if (!currentUser) {
      return;
    }

    const nextStatus = value as 'available' | 'paused';
    const updated = updateMockAgentWorkState(currentUser.id, {
      agentStatus: nextStatus,
      pauseReason: nextStatus === 'paused' ? pauseReason : undefined,
    });

    if (!updated) {
      messageApi.error('Não foi possível alterar seu status.');
      return;
    }

    setAgentStatus(nextStatus);
    messageApi.success(
      nextStatus === 'paused'
        ? 'Atendimento pausado.'
        : 'Você está disponível para chamadas.',
    );
  }

  function handlePauseReasonChange(nextReason: AgentPauseReason) {
    if (!currentUser) {
      return;
    }

    const updated = updateMockAgentWorkState(currentUser.id, {
      agentStatus: 'paused',
      pauseReason: nextReason,
    });

    if (!updated) {
      messageApi.error('Não foi possível alterar o tipo de pausa.');
      return;
    }

    setPauseReason(nextReason);
    setAgentStatus('paused');
    messageApi.success('Tipo de pausa atualizado.');
  }

  function removeQueue(queue: Queue) {
    setQueueItems((current) => current.filter((item) => item.id !== queue.id));
    messageApi.success(`Fila ${queue.name} apagada.`);
  }

  const columns: ColumnsType<Queue> = [
    { title: 'Fila', dataIndex: 'name', key: 'name' },
    { title: 'Numero', dataIndex: 'number', key: 'number' },
    { title: 'Estrategia', dataIndex: 'strategy', key: 'strategy' },
    {
      title: 'Agentes',
      dataIndex: 'agents',
      key: 'agents',
      render: (value: number) => (
        <Tag icon={<UserSwitchOutlined />}>{value}</Tag>
      ),
    },
    {
      title: 'Aguardando',
      dataIndex: 'waiting',
      key: 'waiting',
      render: (value: number) => (
        <Tag color={value > 0 ? 'warning' : 'success'}>{value}</Tag>
      ),
    },
    {
      title: 'SLA',
      dataIndex: 'sla',
      key: 'sla',
      render: (value: number) => (
        <Progress
          percent={value}
          size="small"
          status={value < 90 ? 'active' : 'success'}
        />
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 80,
      render: (_, queue) =>
        canManageQueues ? (
          <Space>
            <Button
              aria-label={`Editar fila ${queue.name}`}
              title={`Editar fila ${queue.name}`}
              icon={<EditOutlined />}
              onClick={() => openEditQueue(queue)}
              size="small"
            />
            <Popconfirm
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
              okText="Apagar"
              onConfirm={() => removeQueue(queue)}
              title={`Apagar a fila ${queue.name}?`}
            >
              <Button
                aria-label={`Apagar fila ${queue.name}`}
                title={`Apagar fila ${queue.name}`}
                danger
                icon={<DeleteOutlined />}
                size="small"
              />
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
            {canManageQueues ? (
              <Button
                icon={<PlusOutlined />}
                onClick={openCreateQueue}
                type="primary"
              >
                Nova fila
              </Button>
            ) : null}
          </>
        }
        kicker="Atendimento em grupo"
        title="Filas"
        description="Acompanhe agentes, espera, estratégia de distribuicao e SLA de cada equipe."
      />
      {isAgent ? (
        <Card className="soft-panel" style={{ marginBottom: 16 }}>
          <Row align="middle" gutter={[20, 16]}>
            <Col xs={24} lg={6}>
              <Typography.Text type="secondary">
                Status de atendimento
              </Typography.Text>
              <Segmented
                block
                onChange={handleAgentStatusChange}
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
                style={{ marginTop: 8 }}
                value={agentStatus}
              />
            </Col>
            <Col xs={24} lg={6}>
              <Typography.Text type="secondary">
                Fila de trabalho
              </Typography.Text>
              <Select
                onChange={handleQueueChange}
                options={queueOptions}
                style={{ marginTop: 8, width: '100%' }}
                value={selectedQueueId}
              />
            </Col>
            <Col xs={24} lg={6}>
              <Typography.Text type="secondary">Tipo de pausa</Typography.Text>
              <Select
                disabled={agentStatus !== 'paused'}
                onChange={handlePauseReasonChange}
                options={agentPauseOptions}
                style={{ marginTop: 8, width: '100%' }}
                value={pauseReason}
              />
            </Col>
            <Col xs={24} lg={6}>
              <Typography.Text type="secondary">Sessão</Typography.Text>
              <div style={{ marginTop: 10 }}>
                <Tag color={agentStatus === 'available' ? 'success' : 'warning'}>
                  {agentStatus === 'available'
                    ? 'Recebendo chamadas'
                    : `Em pausa: ${
                        agentPauseOptions.find(
                          (option) => option.value === pauseReason,
                        )?.label ?? 'Pausa rapida'
                      }`}
                </Tag>
              </div>
            </Col>
          </Row>
        </Card>
      ) : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card className="soft-panel">
            <Statistic title="Filas ativas" value={queueItems.length} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="soft-panel">
            <Statistic title="Agentes logados" value={agents} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="soft-panel">
            <Statistic title="Chamadas aguardando" value={waiting} />
          </Card>
        </Col>
      </Row>
      <Card className="soft-panel" style={{ marginTop: 16 }}>
        <Table
          columns={columns}
          dataSource={queueItems}
          pagination={false}
          rowKey="id"
        />
      </Card>

      <Modal
        forceRender
        footer={null}
        onCancel={closeQueueModal}
        open={newQueueOpen}
        title={editingQueue ? 'Editar fila' : 'Nova fila'}
      >
        <Form
          form={queueForm}
          initialValues={{
            strategy: 'Tocar todos',
            maxWaiting: 20,
            overflowAfter: 120,
          }}
          layout="vertical"
          onFinish={handleCreateQueue}
          requiredMark={false}
        >
          <Space align="start" size={12} style={{ width: '100%' }}>
            <Form.Item
              label="Nome da fila"
              name="name"
              rules={[{ required: true, message: 'Informe o nome da fila.' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="Ex.: Atendimento Comercial" />
            </Form.Item>
            <Form.Item
              label="Numero"
              name="number"
              rules={[{ required: true, message: 'Informe o número da fila.' }]}
              style={{ width: 130 }}
            >
              <Input placeholder="6004" />
            </Form.Item>
          </Space>
          <Form.Item
            label="Estrategia de distribuicao"
            name="strategy"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { label: 'Tocar todos', value: 'Tocar todos' },
                { label: 'Menor uso', value: 'Menor uso' },
                { label: 'Round robin', value: 'Round robin' },
                { label: 'Sequencial', value: 'Sequencial' },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="Mensagem de atendimento"
            name="welcomeMessage"
            rules={[{ required: true, message: 'Informe a mensagem inicial.' }]}
          >
            <Input.TextArea
              placeholder="Mensagem reproduzida quando a chamada entrar na fila."
              rows={3}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Quantidade maxima em espera"
                name="maxWaiting"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={500} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Transbordar depois de"
                name="overflowAfter"
                rules={[{ required: true }]}
              >
                <InputNumber
                  addonAfter="segundos"
                  min={10}
                  max={3600}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="Destino do transbordo"
            name="overflowDestination"
            rules={[{ required: true, message: 'Informe o destino.' }]}
          >
            <DestinationPicker />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={closeQueueModal}>Cancelar</Button>
            <Button htmlType="submit" type="primary">
              {editingQueue ? 'Salvar fila' : 'Criar fila'}
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}


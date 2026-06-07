import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Row,
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
import { SipTrunk, sipTrunks } from '../services/mockData';

type SipTrunkFormValues = Omit<SipTrunk, 'id'>;

export default function SipTrunks() {
  const [form] = Form.useForm<SipTrunkFormValues>();
  const [items, setItems] = useState(sipTrunks);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SipTrunk | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  function openCreate() {
    setEditing(null);
    form.setFieldsValue({
      tenantId: 'tenant-alcatele',
      channels: 10,
      latency: 35,
      status: 'registered',
    });
    setModalOpen(true);
  }

  function openEdit(trunk: SipTrunk) {
    setEditing(trunk);
    form.setFieldsValue(trunk);
    setModalOpen(true);
  }

  function closeModal() {
    form.resetFields();
    setEditing(null);
    setModalOpen(false);
  }

  function saveTrunk(values: SipTrunkFormValues) {
    if (editing) {
      setItems((current) =>
        current.map((item) =>
          item.id === editing.id ? { ...values, id: editing.id } : item,
        ),
      );
      messageApi.success(`Tronco ${values.name} atualizado.`);
    } else {
      setItems((current) => [
        ...current,
        { ...values, id: `trk-${Date.now()}` },
      ]);
      messageApi.success(`Tronco ${values.name} criado.`);
    }

    closeModal();
  }

  function removeTrunk(trunk: SipTrunk) {
    setItems((current) => current.filter((item) => item.id !== trunk.id));
    messageApi.success(`Tronco ${trunk.name} apagado.`);
  }

  const columns: ColumnsType<SipTrunk> = [
    { title: 'Nome', dataIndex: 'name', key: 'name' },
    { title: 'Operadora', dataIndex: 'provider', key: 'provider' },
    { title: 'Host', dataIndex: 'host', key: 'host' },
    {
      title: 'Canais',
      dataIndex: 'channels',
      key: 'channels',
      render: (value: number) => <Tag>{value} canais</Tag>,
    },
    {
      title: 'Latencia',
      dataIndex: 'latency',
      key: 'latency',
      render: (value: number) => (
        <Tag color={value > 100 ? 'warning' : 'success'}>{value} ms</Tag>
      ),
    },
    {
      title: 'Registro',
      dataIndex: 'status',
      key: 'status',
      render: (_, record) => <StatusTag status={record.status} />,
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 80,
      render: (_, trunk) => (
        <Space>
          <Button
            aria-label={`Editar tronco ${trunk.name}`}
            title={`Editar tronco ${trunk.name}`}
            icon={<EditOutlined />}
            onClick={() => openEdit(trunk)}
            size="small"
          />
          <Popconfirm
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
            okText="Apagar"
            onConfirm={() => removeTrunk(trunk)}
            title={`Apagar o tronco ${trunk.name}?`}
          >
            <Button
              aria-label={`Apagar tronco ${trunk.name}`}
              title={`Apagar tronco ${trunk.name}`}
              danger
              icon={<DeleteOutlined />}
              size="small"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <PageHeader
        actions={
          <>
            <Button
              icon={<ThunderboltOutlined />}
              onClick={() => messageApi.success('Teste de registro concluido.')}
            >
              Testar registro
            </Button>
            <Button icon={<PlusOutlined />} onClick={openCreate} type="primary">
              Novo tronco
            </Button>
          </>
        }
        kicker="Conectividade SIP"
        title="Troncos SIP"
        description="Monitore registros, capacidade de canais, latência e provedores usados pelas rotas."
      />

      <Row gutter={[16, 16]}>
        {items.map((trunk) => (
          <Col key={trunk.id} xs={24} lg={8}>
            <Card className="soft-panel" title={trunk.name}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Operadora">
                  {trunk.provider}
                </Descriptions.Item>
                <Descriptions.Item label="Host">{trunk.host}</Descriptions.Item>
                <Descriptions.Item label="Status">
                  <StatusTag status={trunk.status} />
                </Descriptions.Item>
              </Descriptions>
              <Progress
                percent={Math.min(100, Math.round((trunk.latency / 160) * 100))}
                showInfo={false}
                status={trunk.latency > 100 ? 'exception' : 'success'}
                style={{ marginTop: 16 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card className="soft-panel" style={{ marginTop: 16 }} title="Inventário de troncos">
        <Table columns={columns} dataSource={items} pagination={false} rowKey="id" />
      </Card>
      <Modal
        footer={null}
        onCancel={closeModal}
        open={modalOpen}
        title={editing ? 'Editar tronco' : 'Novo tronco'}
      >
        <Form form={form} layout="vertical" onFinish={saveTrunk}>
          <Form.Item hidden name="tenantId">
            <Input />
          </Form.Item>
          <Form.Item label="Nome" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Operadora" name="provider" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Host" name="host" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Canais" name="channels" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Latencia" name="latency" rules={[{ required: true }]}>
            <InputNumber addonAfter="ms" min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Status" name="status" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'Registrado', value: 'registered' },
                { label: 'Falha', value: 'failed' },
                { label: 'Atenção', value: 'warning' },
              ]}
            />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={closeModal}>Cancelar</Button>
            <Button htmlType="submit" type="primary">
              {editing ? 'Salvar tronco' : 'Criar tronco'}
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}


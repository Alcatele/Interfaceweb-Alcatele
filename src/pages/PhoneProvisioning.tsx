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
import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import type { ProvisionedPhone } from '../services/mockData';
import { extensions, provisionedPhones } from '../services/mockData';

type PhoneFormValues = Omit<ProvisionedPhone, 'id' | 'tenantId' | 'lastProvisioning'>;

const statusOptions = [
  { label: 'Provisionado', value: 'provisioned' },
  { label: 'Pendente', value: 'pending' },
  { label: 'Falhou', value: 'failed' },
];

const statusColor = {
  provisioned: 'success',
  pending: 'processing',
  failed: 'error',
};

export default function PhoneProvisioning() {
  const [form] = Form.useForm<PhoneFormValues>();
  const [items, setItems] = useState<ProvisionedPhone[]>(provisionedPhones);
  const [editing, setEditing] = useState<ProvisionedPhone | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  }

  function openEdit(phone: ProvisionedPhone) {
    setEditing(phone);
    form.setFieldsValue(phone);
    setModalOpen(true);
  }

  function save(values: PhoneFormValues) {
    if (editing) {
      setItems((current) =>
        current.map((item) => (item.id === editing.id ? { ...item, ...values } : item)),
      );
      messageApi.success('Telefone atualizado.');
    } else {
      setItems((current) => [
        ...current,
        {
          ...values,
          id: `phone-${Date.now()}`,
          tenantId: 'tenant-alcatele',
          lastProvisioning: 'Ainda não provisionado',
        },
      ]);
      messageApi.success('Telefone cadastrado para provisionamento.');
    }

    setModalOpen(false);
  }

  function deletePhone(phoneId: string) {
    setItems((current) => current.filter((item) => item.id !== phoneId));
    messageApi.success('Telefone apagado.');
  }

  function reprovision(phone: ProvisionedPhone) {
    setItems((current) =>
      current.map((item) =>
        item.id === phone.id
          ? { ...item, status: 'provisioned', lastProvisioning: 'Agora' }
          : item,
      ),
    );
    messageApi.success(`Provisionamento enviado para ${phone.model}.`);
  }

  const columns: ColumnsType<ProvisionedPhone> = [
    { title: 'MAC', dataIndex: 'mac', key: 'mac' },
    { title: 'Fabricante', dataIndex: 'vendor', key: 'vendor' },
    { title: 'Modelo', dataIndex: 'model', key: 'model' },
    { title: 'Ramal', dataIndex: 'extension', key: 'extension' },
    { title: 'Template', dataIndex: 'template', key: 'template' },
    { title: 'Firmware', dataIndex: 'firmware', key: 'firmware' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: ProvisionedPhone['status']) => (
        <Tag color={statusColor[status]}>
          {status === 'provisioned'
            ? 'Provisionado'
            : status === 'pending'
              ? 'Pendente'
              : 'Falhou'}
        </Tag>
      ),
    },
    { title: 'Último envio', dataIndex: 'lastProvisioning', key: 'lastProvisioning' },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, phone) => (
        <Space>
          <Button
            aria-label={`Reprovisionar ${phone.model}`}
            title={`Reprovisionar ${phone.model}`}
            icon={<ReloadOutlined />}
            onClick={() => reprovision(phone)}
          />
          <Button
            aria-label={`Editar ${phone.model}`}
            title={`Editar ${phone.model}`}
            icon={<EditOutlined />}
            onClick={() => openEdit(phone)}
          />
          <Popconfirm
            cancelText="Cancelar"
            okText="Apagar"
            onConfirm={() => deletePhone(phone.id)}
            title={`Apagar o telefone ${phone.mac}?`}
          >
            <Button
              aria-label={`Apagar ${phone.model}`}
              danger
              icon={<DeleteOutlined />}
              title={`Apagar ${phone.model}`}
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
          <Button icon={<PlusOutlined />} onClick={openCreate} type="primary">
            Novo telefone
          </Button>
        }
        kicker="Telefones IP"
        title="Provisionamento"
        description="Cadastre aparelhos por MAC, aplique templates e envie reprovisionamento remoto."
      />

      <Card className="soft-panel">
        <Table columns={columns} dataSource={items} pagination={false} rowKey="id" />
      </Card>

      <Modal
        footer={null}
        onCancel={() => setModalOpen(false)}
        open={modalOpen}
        title={editing ? 'Editar telefone' : 'Novo telefone'}
      >
        <Form form={form} layout="vertical" onFinish={save} requiredMark={false}>
          <Form.Item label="MAC" name="mac" rules={[{ required: true }]}>
            <Input placeholder="00:11:22:33:44:55" />
          </Form.Item>
          <Form.Item label="Fabricante" name="vendor" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'Yealink', value: 'Yealink' },
                { label: 'Fanvil', value: 'Fanvil' },
                { label: 'Intelbras', value: 'Intelbras' },
                { label: 'Alcatel-Lucent', value: 'Alcatel-Lucent' },
                { label: 'Avaya', value: 'Avaya' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Modelo" name="model" rules={[{ required: true }]}>
            <Input placeholder="Ex.: Yealink T54W" />
          </Form.Item>
          <Form.Item label="Ramal" name="extension" rules={[{ required: true }]}>
            <Select
              options={extensions.map((extension) => ({
                label: `${extension.number} - ${extension.name}`,
                value: extension.number,
              }))}
            />
          </Form.Item>
          <Form.Item label="Template" name="template" rules={[{ required: true }]}>
            <Input placeholder="Ex.: Comercial BLF" />
          </Form.Item>
          <Form.Item label="Firmware" name="firmware" rules={[{ required: true }]}>
            <Input placeholder="Ex.: 96.86.0.70" />
          </Form.Item>
          <Form.Item label="Status" name="status" rules={[{ required: true }]}>
            <Select options={statusOptions} />
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

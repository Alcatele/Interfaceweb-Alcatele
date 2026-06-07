import { DeleteOutlined, EditOutlined, PhoneOutlined, PlusOutlined, StarFilled } from '@ant-design/icons';
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
import type { DirectoryContact } from '../services/mockData';
import { directoryContacts } from '../services/mockData';

type ContactFormValues = Omit<DirectoryContact, 'id' | 'tenantId'>;

export default function Contacts() {
  const [form] = Form.useForm<ContactFormValues>();
  const [items, setItems] = useState<DirectoryContact[]>(directoryContacts);
  const [editing, setEditing] = useState<DirectoryContact | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  }

  function openEdit(contact: DirectoryContact) {
    setEditing(contact);
    form.setFieldsValue(contact);
    setModalOpen(true);
  }

  function save(values: ContactFormValues) {
    if (editing) {
      setItems((current) =>
        current.map((item) => (item.id === editing.id ? { ...item, ...values } : item)),
      );
      messageApi.success('Contato atualizado.');
    } else {
      setItems((current) => [
        ...current,
        { ...values, id: `contact-${Date.now()}`, tenantId: 'tenant-alcatele' },
      ]);
      messageApi.success('Contato criado.');
    }

    setModalOpen(false);
  }

  function deleteContact(contactId: string) {
    setItems((current) => current.filter((item) => item.id !== contactId));
    messageApi.success('Contato apagado.');
  }

  function callContact(contact: DirectoryContact) {
    messageApi.success(`Chamando ${contact.name} em ${contact.phone}.`);
  }

  const columns: ColumnsType<DirectoryContact> = [
    {
      title: 'Nome',
      dataIndex: 'name',
      key: 'name',
      render: (value: string, contact) => (
        <Space>
          {contact.favorite ? <StarFilled style={{ color: '#d97706' }} /> : null}
          {value}
        </Space>
      ),
    },
    { title: 'Empresa', dataIndex: 'company', key: 'company' },
    { title: 'Telefone', dataIndex: 'phone', key: 'phone' },
    { title: 'Celular', dataIndex: 'mobile', key: 'mobile' },
    { title: 'E-mail', dataIndex: 'email', key: 'email' },
    {
      title: 'Tipo',
      dataIndex: 'type',
      key: 'type',
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, contact) => (
        <Space>
          <Button
            aria-label={`Chamar ${contact.name}`}
            title={`Chamar ${contact.name}`}
            icon={<PhoneOutlined />}
            onClick={() => callContact(contact)}
          />
          <Button
            aria-label={`Editar ${contact.name}`}
            title={`Editar ${contact.name}`}
            icon={<EditOutlined />}
            onClick={() => openEdit(contact)}
          />
          <Popconfirm
            cancelText="Cancelar"
            okText="Apagar"
            onConfirm={() => deleteContact(contact.id)}
            title={`Apagar o contato ${contact.name}?`}
          >
            <Button
              aria-label={`Apagar ${contact.name}`}
              danger
              icon={<DeleteOutlined />}
              title={`Apagar ${contact.name}`}
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
            Novo contato
          </Button>
        }
        kicker="Agenda"
        title="Contatos"
        description="Centralize contatos corporativos, clientes, fornecedores e discagem rápida."
      />

      <Card className="soft-panel">
        <Table columns={columns} dataSource={items} pagination={{ pageSize: 8 }} rowKey="id" />
      </Card>

      <Modal
        footer={null}
        onCancel={() => setModalOpen(false)}
        open={modalOpen}
        title={editing ? 'Editar contato' : 'Novo contato'}
      >
        <Form
          form={form}
          initialValues={{ favorite: false, type: 'Cliente' }}
          layout="vertical"
          onFinish={save}
          requiredMark={false}
        >
          <Form.Item label="Nome" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Empresa" name="company" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Telefone" name="phone" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Celular" name="mobile">
            <Input />
          </Form.Item>
          <Form.Item label="E-mail" name="email" rules={[{ type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Tipo" name="type" rules={[{ required: true }]}>
            <Select
              options={['Corporativo', 'Cliente', 'Fornecedor', 'Pessoal'].map((type) => ({
                label: type,
                value: type,
              }))}
            />
          </Form.Item>
          <Form.Item label="Favorito" name="favorite" valuePropName="checked">
            <Switch />
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

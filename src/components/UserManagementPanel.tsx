import {
  DeleteOutlined,
  KeyOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import {
  roleOptions,
  roleProfiles,
  type UserRole,
} from '../services/accessControl';
import {
  createMockUser,
  deleteMockUser,
  listPublicUsers,
  updateMockUserPassword,
  type PublicUser,
} from '../services/mockUsers';

type PasswordFormValues = {
  password: string;
  confirmPassword: string;
};

type CreateUserFormValues = {
  name: string;
  username: string;
  email: string;
  role: UserRole;
  extension: string;
  password: string;
  confirmPassword: string;
};

const strongPasswordRules = [
  { required: true, message: 'Informe a senha.' },
  { min: 8, message: 'A senha precisa ter pelo menos 8 caracteres.' },
  {
    pattern: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/,
    message: 'Inclua letras, números e pelo menos um simbolo.',
  },
];

export default function UserManagementPanel() {
  const [passwordForm] = Form.useForm<PasswordFormValues>();
  const [createForm] = Form.useForm<CreateUserFormValues>();
  const [users, setUsers] = useState<PublicUser[]>(listPublicUsers);
  const [selectedUser, setSelectedUser] = useState<PublicUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const { currentUser, role } = useAuth();
  const isSuperAdmin = role === 'super_admin';

  function refreshUsers() {
    setUsers(listPublicUsers());
  }

  async function handlePasswordReset(values: PasswordFormValues) {
    if (!selectedUser) {
      return;
    }

    setSaving(true);
    const updated = await updateMockUserPassword(
      selectedUser.id,
      values.password,
    );
    setSaving(false);

    if (!updated) {
      messageApi.error('Não foi possível redefinir a senha.');
      return;
    }

    messageApi.success(`Senha de ${selectedUser.name} redefinida.`);
    refreshUsers();
    passwordForm.resetFields();
    setSelectedUser(null);
  }

  function closePasswordModal() {
    passwordForm.resetFields();
    setSelectedUser(null);
  }

  function closeCreateModal() {
    createForm.resetFields();
    setCreateOpen(false);
  }

  async function handleCreateUser(values: CreateUserFormValues) {
    setSaving(true);
    const result = await createMockUser(values);
    setSaving(false);

    if (!result.success) {
      messageApi.error(result.error);
      return;
    }

    messageApi.success(`Usuário ${values.name} criado com sucesso.`);
    refreshUsers();
    closeCreateModal();
  }

  function handleDeleteUser(user: PublicUser) {
    if (!currentUser) {
      return;
    }

    const result = deleteMockUser(user.id, currentUser.id);

    if (!result.success) {
      messageApi.error(result.error);
      return;
    }

    messageApi.success(`Usuário ${user.name} apagado.`);
    refreshUsers();
  }

  const columns: ColumnsType<PublicUser> = [
    {
      title: 'Usuário',
      key: 'user',
      render: (_, user) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{user.name}</Typography.Text>
          <Typography.Text type="secondary">{user.email}</Typography.Text>
        </Space>
      ),
    },
    { title: 'Login', dataIndex: 'username', key: 'username' },
    {
      title: 'Perfil',
      dataIndex: 'role',
      key: 'role',
      render: (role: PublicUser['role']) => (
        <Tag color={roleProfiles[role].color}>{roleProfiles[role].label}</Tag>
      ),
    },
    { title: 'Ramal', dataIndex: 'extension', key: 'extension' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: PublicUser['status']) => (
        <Tag color={status === 'active' ? 'success' : 'default'}>
          {status === 'active' ? 'Ativo' : 'Inativo'}
        </Tag>
      ),
    },
    { title: 'Último acesso', dataIndex: 'lastAccess', key: 'lastAccess' },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, user) => (
        <Space>
          <Button
            icon={<KeyOutlined />}
            onClick={() => {
              setSelectedUser(user);
            }}
            size="small"
          >
            Redefinir
          </Button>
          {isSuperAdmin ? (
            <Popconfirm
              cancelText="Cancelar"
              description="Esta ação remove o acesso do usuário."
              okButtonProps={{ danger: true }}
              okText="Apagar"
              onConfirm={() => handleDeleteUser(user)}
              title={`Apagar ${user.name}?`}
            >
              <Button
                danger
                disabled={user.id === currentUser?.id}
                icon={<DeleteOutlined />}
                size="small"
                title={`Apagar ${user.name}`}
              />
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {isSuperAdmin ? (
          <div className="table-actions">
            <Button
              icon={<PlusOutlined />}
              onClick={() => setCreateOpen(true)}
              type="primary"
            >
              Novo usuário
            </Button>
          </div>
        ) : null}
        <Table
          columns={columns}
          dataSource={users}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1020 }}
          size="small"
        />
      </Space>

      <Modal
        forceRender
        footer={null}
        onCancel={closePasswordModal}
        open={selectedUser !== null}
        title={`Redefinir senha - ${selectedUser?.name ?? ''}`}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordReset}
          requiredMark={false}
        >
          <Form.Item
            extra="Use ao menos 8 caracteres, com letras, números e simbolos."
            label="Nova senha"
            name="password"
            rules={[
              { required: true, message: 'Informe a nova senha.' },
              { min: 8, message: 'A senha precisa ter pelo menos 8 caracteres.' },
              {
                pattern: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/,
                message: 'Inclua letras, números e pelo menos um simbolo.',
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
              { required: true, message: 'Confirme a nova senha.' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }

                  return Promise.reject(new Error('As senhas não coincidem.'));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={closePasswordModal}>Cancelar</Button>
            <Button htmlType="submit" loading={saving} type="primary">
              Salvar nova senha
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        forceRender
        footer={null}
        onCancel={closeCreateModal}
        open={createOpen}
        title="Novo usuário"
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateUser}
          requiredMark={false}
        >
          <Form.Item
            label="Nome completo"
            name="name"
            rules={[{ required: true, message: 'Informe o nome do usuário.' }]}
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
            initialValue="user"
            label="Perfil"
            name="role"
            rules={[{ required: true, message: 'Selecione o perfil.' }]}
          >
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item
            extra="Use ao menos 8 caracteres, com letras, números e simbolos."
            label="Senha inicial"
            name="password"
            rules={strongPasswordRules}
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
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }

                  return Promise.reject(new Error('As senhas não coincidem.'));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={closeCreateModal}>Cancelar</Button>
            <Button htmlType="submit" loading={saving} type="primary">
              Criar usuário
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}


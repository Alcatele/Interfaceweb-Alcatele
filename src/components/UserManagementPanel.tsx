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
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { getApiErrorMessage } from '../services/api';
import { mvpApi, type ApiUser } from '../services/mvpApi';

type CreateUserForm = {
  name: string;
  username: string;
  email: string;
  role: string;
  extension?: string;
  password: string;
};

type PasswordForm = {
  password: string;
};

export default function UserManagementPanel() {
  const [createForm] = Form.useForm<CreateUserForm>();
  const [passwordForm] = Form.useForm<PasswordForm>();
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await mvpApi.listUsers());
    } catch {
      messageApi.error('Não foi possível carregar os usuários.');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createUser(values: CreateUserForm) {
    try {
      await mvpApi.createUser(values);
      messageApi.success(`Usuário ${values.name} criado.`);
      createForm.resetFields();
      setCreateOpen(false);
      await load();
    } catch (error) {
      messageApi.error(
        getApiErrorMessage(
          error,
          'Usuário, e-mail ou ramal já cadastrado.',
        ),
      );
    }
  }

  async function resetPassword(values: PasswordForm) {
    if (!selectedUser) {
      return;
    }

    try {
      await mvpApi.resetPassword(selectedUser.id, values.password);
      messageApi.success('Senha redefinida.');
      passwordForm.resetFields();
      setSelectedUser(null);
    } catch {
      messageApi.error('Não foi possível redefinir a senha.');
    }
  }

  async function removeUser(user: ApiUser) {
    try {
      await mvpApi.removeUser(user.id);
      messageApi.success(`Acesso de ${user.name} removido.`);
      await load();
    } catch {
      messageApi.error('Não foi possível remover o usuário.');
    }
  }

  const columns: ColumnsType<ApiUser> = [
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
      render: (role: string) => <Tag color="blue">{role}</Tag>,
    },
    {
      title: 'Ramal',
      dataIndex: 'extension',
      key: 'extension',
      render: (extension: string | null) => extension ?? '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: ApiUser['status']) => (
        <Tag color={status === 'active' ? 'success' : 'default'}>{status}</Tag>
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, user) => (
        <Space>
          <Button
            icon={<KeyOutlined />}
            onClick={() => setSelectedUser(user)}
            size="small"
          >
            Redefinir
          </Button>
          <Popconfirm
            cancelText="Cancelar"
            disabled={user.id === currentUser?.id}
            okButtonProps={{ danger: true }}
            okText="Remover"
            onConfirm={() => void removeUser(user)}
            title={`Remover o acesso de ${user.name}?`}
          >
            <Button
              danger
              disabled={user.id === currentUser?.id}
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
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div className="table-actions">
          <Button
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
            type="primary"
          >
            Novo usuário
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={users}
          loading={loading}
          pagination={false}
          rowKey="id"
        />
      </Space>

      <Modal
        footer={null}
        onCancel={() => setCreateOpen(false)}
        open={createOpen}
        title="Novo usuário"
      >
        <Form form={createForm} layout="vertical" onFinish={createUser}>
          <Form.Item label="Nome" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Login" name="username" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="E-mail"
            name="email"
            rules={[{ required: true, type: 'email' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Perfil" name="role" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'Administrador', value: 'admin' },
                { label: 'Usuário', value: 'user' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Ramal" name="extension">
            <Input placeholder="1003" />
          </Form.Item>
          <Form.Item
            label="Senha inicial"
            name="password"
            rules={[{ required: true }, { min: 8 }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button htmlType="submit" type="primary">
              Criar usuário
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        footer={null}
        onCancel={() => setSelectedUser(null)}
        open={selectedUser !== null}
        title={`Redefinir senha - ${selectedUser?.name ?? ''}`}
      >
        <Form form={passwordForm} layout="vertical" onFinish={resetPassword}>
          <Form.Item
            label="Nova senha"
            name="password"
            rules={[{ required: true }, { min: 8 }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => setSelectedUser(null)}>Cancelar</Button>
            <Button htmlType="submit" type="primary">
              Redefinir
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}

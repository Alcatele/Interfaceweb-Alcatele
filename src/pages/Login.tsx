import {
  LockOutlined,
  LoginOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { roleProfiles } from '../services/accessControl';
import {
  demoAccounts,
  requestMockPasswordRecovery,
} from '../services/mockUsers';

type LoginFormValues = {
  identifier: string;
  password: string;
  remember: boolean;
};

type RecoveryFormValues = {
  identifier: string;
};

export default function Login() {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
  const [form] = Form.useForm<LoginFormValues>();
  const [recoveryForm] = Form.useForm<RecoveryFormValues>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleLogin(values: LoginFormValues) {
    setError('');
    setLoading(true);

    const result = await login(values);

    if (!result.success) {
      setError(result.error ?? 'Não foi possível entrar.');
    } else {
      navigate('/');
    }

    setLoading(false);
  }

  function closeRecovery() {
    recoveryForm.resetFields();
    setRecoverySent(false);
    setRecoveryOpen(false);
  }

  async function handleRecovery(values: RecoveryFormValues) {
    setRecovering(true);
    await requestMockPasswordRecovery(values.identifier);
    setRecovering(false);
    setRecoverySent(true);
  }

  return (
    <main className="login-screen">
      <section className="login-intro">
        <div className="login-brand">
          <span className="brand-mark">AC</span>
          <div>
            <Typography.Title level={4}>Alcatele Cloud PBX</Typography.Title>
            <Typography.Text type="secondary">
              Console de comunicação empresarial
            </Typography.Text>
          </div>
        </div>

        <div className="login-status">
          <Typography.Text className="login-eyebrow">
            Comunicação sem limites
          </Typography.Text>
          <Typography.Title level={2}>
            Sua operação de voz em um só lugar.
          </Typography.Title>
          <Typography.Paragraph>
            Gerencie empresas, ramais, rotas e chamadas com uma experiência
            simples, segura e preparada para crescer.
          </Typography.Paragraph>
          <div className="login-feature-grid">
            <div className="login-feature">
              <PhoneOutlined />
              <div>
                <strong>Telefonia integrada</strong>
                <span>Ramais e WebRTC em nuvem</span>
              </div>
            </div>
            <div className="login-feature">
              <SafetyCertificateOutlined />
              <div>
                <strong>Acesso protegido</strong>
                <span>Permissões por perfil e empresa</span>
              </div>
            </div>
          </div>
        </div>

        <div className="login-system-status">
          <span className="status-dot" />
          <Typography.Text>Servicos operacionais</Typography.Text>
        </div>
      </section>

      <section className="login-form-section">
        <Card className="login-card">
          <Typography.Title level={3}>Entrar</Typography.Title>
          <Typography.Paragraph type="secondary">
            Acesse o painel com sua conta corporativa.
          </Typography.Paragraph>

          {error ? (
            <Alert
              closable
              message={error}
              onClose={() => setError('')}
              showIcon
              style={{ marginBottom: 18 }}
              type="error"
            />
          ) : null}

          <Form
            form={form}
            initialValues={{ remember: true }}
            layout="vertical"
            onFinish={handleLogin}
            requiredMark={false}
          >
            <Form.Item
              label="Usuário ou e-mail"
              name="identifier"
              rules={[{ required: true, message: 'Informe seu usuário ou e-mail.' }]}
            >
              <Input
                autoComplete="username"
                placeholder="seu.usuario"
                prefix={<UserOutlined />}
                size="large"
              />
            </Form.Item>
            <Form.Item
              label="Senha"
              name="password"
              rules={[{ required: true, message: 'Informe sua senha.' }]}
            >
              <Input.Password
                autoComplete="current-password"
                placeholder="Digite sua senha"
                prefix={<LockOutlined />}
                size="large"
              />
            </Form.Item>
            <div className="login-options">
              <Form.Item name="remember" valuePropName="checked">
                <Checkbox>Manter conectado neste dispositivo</Checkbox>
              </Form.Item>
              {isDemoMode ? (
                <Button
                  onClick={() => setRecoveryOpen(true)}
                  type="link"
                >
                  Esqueci minha senha
                </Button>
              ) : null}
            </div>
            <Button
              block
              htmlType="submit"
              icon={<LoginOutlined />}
              loading={loading}
              size="large"
              type="primary"
            >
              Entrar
            </Button>
          </Form>

          {isDemoMode ? (
            <div className="demo-accounts">
              <Typography.Text strong>Acessos de demonstração</Typography.Text>
              {demoAccounts
                .filter((account) =>
                  ['super_admin', 'admin', 'user'].includes(account.role),
                )
                .map((account) => (
                  <button
                    className="demo-account"
                    key={account.username}
                    onClick={() =>
                      form.setFieldsValue({
                        identifier: account.username,
                        password: account.password,
                      })
                    }
                    type="button"
                  >
                    <span>
                      <Tag color={roleProfiles[account.role].color}>
                        {roleProfiles[account.role].label}
                      </Tag>
                      <Typography.Text>{account.username}</Typography.Text>
                    </span>
                    <Typography.Text code>{account.password}</Typography.Text>
                  </button>
                ))}
            </div>
          ) : null}
        </Card>
      </section>

      <Modal
        forceRender
        footer={null}
        onCancel={closeRecovery}
        open={recoveryOpen}
        title="Recuperar senha"
      >
        {recoverySent ? (
          <>
            <Alert
              description="Se a conta existir, as instruções de recuperação serao enviadas ao e-mail cadastrado."
              message="Solicitação registrada"
              showIcon
              type="success"
            />
            <Button
              block
              onClick={closeRecovery}
              style={{ marginTop: 18 }}
              type="primary"
            >
              Voltar ao login
            </Button>
          </>
        ) : (
          <Form
            form={recoveryForm}
            layout="vertical"
            onFinish={handleRecovery}
            requiredMark={false}
          >
            <Typography.Paragraph type="secondary">
              Informe seu usuário ou e-mail corporativo.
            </Typography.Paragraph>
            <Form.Item
              label="Usuário ou e-mail"
              name="identifier"
              rules={[
                {
                  required: true,
                  message: 'Informe seu usuário ou e-mail.',
                },
              ]}
            >
              <Input
                autoComplete="username"
                prefix={<UserOutlined />}
                size="large"
              />
            </Form.Item>
            <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
              <Button onClick={closeRecovery}>Cancelar</Button>
              <Button htmlType="submit" loading={recovering} type="primary">
                Enviar instruções
              </Button>
            </Space>
          </Form>
        )}
      </Modal>
    </main>
  );
}


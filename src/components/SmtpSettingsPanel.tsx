import {
  CheckCircleOutlined,
  MailOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Typography,
  message,
} from 'antd';
import { useState } from 'react';
import {
  getSmtpSettings,
  saveSmtpSettings,
  testSmtpSettings,
  type SmtpSettings,
} from '../services/notificationSettings';

export default function SmtpSettingsPanel() {
  const [form] = Form.useForm<SmtpSettings>();
  const [testing, setTesting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const smtpEnabled = Form.useWatch('enabled', form);

  function save(values: SmtpSettings) {
    saveSmtpSettings(values);
    messageApi.success('Configurações de e-mail salvas.');
  }

  async function testConnection() {
    try {
      const values = await form.validateFields();
      setTesting(true);
      const success = await testSmtpSettings(values);
      setTesting(false);

      if (success) {
        messageApi.success(`E-mail de teste enviado para ${values.alertEmail}.`);
      } else {
        messageApi.error('Não foi possível validar o servidor SMTP.');
      }
    } catch {
      setTesting(false);
    }
  }

  return (
    <>
      {contextHolder}
      <Form
        form={form}
        initialValues={getSmtpSettings()}
        layout="vertical"
        onFinish={save}
        requiredMark={false}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            description="As credenciais ficam armazenadas localmente nesta versão mockada. Na integração final, o backend deve proteger a senha e realizar o envio."
            showIcon
            type="info"
          />
          <Card size="small" title="Servidor de envio">
            <Row gutter={16}>
              <Col xs={24} lg={6}>
                <Form.Item label="Ativar notificações" name="enabled" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
              <Col xs={24} lg={12}>
                <Form.Item
                  label="Servidor SMTP"
                  name="host"
                  rules={[
                    {
                      required: smtpEnabled,
                      message: 'Informe o servidor SMTP.',
                    },
                  ]}
                >
                  <Input placeholder="smtp.exemplo.com.br" />
                </Form.Item>
              </Col>
              <Col xs={24} lg={6}>
                <Form.Item
                  label="Porta"
                  name="port"
                  rules={[{ required: smtpEnabled, message: 'Informe a porta.' }]}
                >
                  <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} lg={8}>
                <Form.Item label="Criptografia" name="encryption">
                  <Select
                    options={[
                      { label: 'STARTTLS', value: 'starttls' },
                      { label: 'SSL/TLS', value: 'ssl' },
                      { label: 'Sem criptografia', value: 'none' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} lg={8}>
                <Form.Item label="Usuário SMTP" name="username">
                  <Input autoComplete="username" />
                </Form.Item>
              </Col>
              <Col xs={24} lg={8}>
                <Form.Item label="Senha SMTP" name="password">
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card size="small" title="Remetente e destinatário">
            <Row gutter={16}>
              <Col xs={24} lg={8}>
                <Form.Item
                  label="Nome do remetente"
                  name="senderName"
                  rules={[{ required: smtpEnabled, message: 'Informe o remetente.' }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} lg={8}>
                <Form.Item
                  label="E-mail do remetente"
                  name="senderEmail"
                  rules={[
                    { required: smtpEnabled, message: 'Informe o e-mail.' },
                    { type: 'email', message: 'Informe um e-mail valido.' },
                  ]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} lg={8}>
                <Form.Item
                  label="E-mail para alertas"
                  name="alertEmail"
                  rules={[
                    { required: smtpEnabled, message: 'Informe o destinatário.' },
                    { type: 'email', message: 'Informe um e-mail valido.' },
                  ]}
                >
                  <Input />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card size="small" title="Eventos enviados por e-mail">
            <Row gutter={[16, 12]}>
              <Col xs={24} lg={8}>
                <Form.Item name="notifyMissedCalls" valuePropName="checked">
                  <Switch />{' '}
                  <Typography.Text>Chamadas perdidas</Typography.Text>
                </Form.Item>
              </Col>
              <Col xs={24} lg={8}>
                <Form.Item name="notifyTrunkFailures" valuePropName="checked">
                  <Switch />{' '}
                  <Typography.Text>Falhas em troncos SIP</Typography.Text>
                </Form.Item>
              </Col>
              <Col xs={24} lg={8}>
                <Form.Item name="notifyStorageLimit" valuePropName="checked">
                  <Switch />{' '}
                  <Typography.Text>Limite de armazenamento</Typography.Text>
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button
              disabled={!smtpEnabled}
              icon={<MailOutlined />}
              loading={testing}
              onClick={testConnection}
            >
              Enviar teste
            </Button>
            <Button
              htmlType="submit"
              icon={
                smtpEnabled ? <SaveOutlined /> : <CheckCircleOutlined />
              }
              type="primary"
            >
              Salvar SMTP
            </Button>
          </Space>
        </Space>
      </Form>
    </>
  );
}


import {
  DeleteOutlined,
  DisconnectOutlined,
  PhoneOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Inviter,
  Registerer,
  SessionState,
  UserAgent,
} from 'sip.js';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/useAuth';
import { mvpApi, type WebphoneConfig } from '../services/mvpApi';

const dialKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

type RegistrationState = 'loading' | 'registered' | 'offline' | 'error';

export default function Webphone() {
  const { activeTenant } = useAuth();
  const userAgentRef = useRef<UserAgent | null>(null);
  const registererRef = useRef<Registerer | null>(null);
  const sessionRef = useRef<Inviter | null>(null);
  const [config, setConfig] = useState<WebphoneConfig | null>(null);
  const [number, setNumber] = useState('');
  const [registration, setRegistration] =
    useState<RegistrationState>('loading');
  const [callState, setCallState] = useState<SessionState | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const disconnect = useCallback(async () => {
    try {
      await registererRef.current?.unregister();
      await userAgentRef.current?.stop();
    } finally {
      sessionRef.current = null;
      registererRef.current = null;
      userAgentRef.current = null;
      setCallState(null);
      setRegistration('offline');
    }
  }, []);

  const connect = useCallback(async () => {
    setRegistration('loading');
    await disconnect();

    try {
      const nextConfig = await mvpApi.webphoneConfig();
      setConfig(nextConfig);

      if (import.meta.env.VITE_DEMO_MODE === 'true') {
        setRegistration('registered');
        return;
      }

      const uri = UserAgent.makeURI(nextConfig.uri);

      if (!uri) {
        throw new Error('URI SIP inválida.');
      }

      const userAgent = new UserAgent({
        uri,
        displayName: nextConfig.displayName,
        authorizationUsername: nextConfig.authorizationUsername,
        authorizationPassword: nextConfig.password,
        transportOptions: {
          server: nextConfig.wsServer,
        },
      });
      const registerer = new Registerer(userAgent);

      userAgentRef.current = userAgent;
      registererRef.current = registerer;

      await userAgent.start();
      await registerer.register();
      setRegistration('registered');
    } catch (error) {
      setRegistration('error');
      messageApi.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível registrar o WebPhone.',
      );
    }
  }, [disconnect, messageApi]);

  useEffect(() => {
    void connect();
    return () => {
      void disconnect();
    };
  }, [activeTenant?.id, connect, disconnect]);

  async function call() {
    if (!config || !number.trim()) {
      return;
    }

    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      setCallState(SessionState.Established);
      return;
    }

    if (!userAgentRef.current) {
      return;
    }

    const target = UserAgent.makeURI(
      `sip:${number.trim()}@${config.sipDomain}`,
    );

    if (!target) {
      messageApi.error('Número de destino inválido.');
      return;
    }

    const inviter = new Inviter(userAgentRef.current, target, {
      sessionDescriptionHandlerOptions: {
        constraints: { audio: true, video: false },
      },
    });
    sessionRef.current = inviter;
    inviter.stateChange.addListener((state) => {
      setCallState(state);

      if (state === SessionState.Terminated) {
        sessionRef.current = null;
      }
    });

    try {
      await inviter.invite();
    } catch {
      messageApi.error('Não foi possível iniciar a chamada.');
    }
  }

  async function hangup() {
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      setCallState(null);
      return;
    }

    const session = sessionRef.current;

    if (!session) {
      return;
    }

    if (session.state === SessionState.Established) {
      await session.bye();
    } else {
      await session.cancel();
    }
  }

  return (
    <>
      {contextHolder}
      <PageHeader
        actions={
          <Button icon={<ReloadOutlined />} onClick={() => void connect()}>
            Registrar novamente
          </Button>
        }
        kicker="WebRTC"
        title="WebPhone básico"
        description="Registro SIP sobre WSS e chamadas de saída pelo navegador."
      />

      {registration === 'loading' ? <Spin size="large" /> : null}
      {registration === 'error' ? (
        <Alert
          description="Confira WEBPHONE_WSS_URL, WEBPHONE_SIP_DOMAIN e o bridge de credenciais."
          message="WebPhone não registrado"
          showIcon
          type="error"
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={9}>
          <Card className="soft-panel" title="Discador">
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <Input
                onChange={(event) => setNumber(event.target.value)}
                placeholder="Número ou ramal"
                size="large"
                value={number}
              />
              <div className="dialpad">
                {dialKeys.map((key) => (
                  <Button
                    className="dialpad-button"
                    key={key}
                    onClick={() => setNumber((value) => `${value}${key}`)}
                    size="large"
                  >
                    {key}
                  </Button>
                ))}
              </div>
              <Space.Compact block>
                <Button
                  icon={<DeleteOutlined />}
                  onClick={() => setNumber((value) => value.slice(0, -1))}
                />
                {sessionRef.current ? (
                  <Button
                    block
                    danger
                    icon={<DisconnectOutlined />}
                    onClick={() => void hangup()}
                    size="large"
                  >
                    Encerrar
                  </Button>
                ) : (
                  <Button
                    block
                    disabled={registration !== 'registered'}
                    icon={<PhoneOutlined />}
                    onClick={() => void call()}
                    size="large"
                    type="primary"
                  >
                    Chamar
                  </Button>
                )}
              </Space.Compact>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={15}>
          <Card className="soft-panel" title="Sessão SIP">
            <Space direction="vertical" size={16}>
              <div>
                <Typography.Text type="secondary">Conta</Typography.Text>
                <Typography.Title level={4}>
                  {config?.uri ?? 'Sem ramal'}
                </Typography.Title>
              </div>
              <Space>
                <Typography.Text>Registro</Typography.Text>
                <Tag
                  color={
                    registration === 'registered'
                      ? 'success'
                      : registration === 'error'
                        ? 'error'
                        : 'default'
                  }
                >
                  {registration}
                </Tag>
              </Space>
              <Space>
                <Typography.Text>Chamada</Typography.Text>
                <Tag color={callState === SessionState.Established ? 'processing' : 'default'}>
                  {callState ?? 'Sem chamada'}
                </Tag>
              </Space>
              <Typography.Text type="secondary">
                O áudio é negociado diretamente pelo SIP.js com o endpoint WSS
                configurado para o tenant.
              </Typography.Text>
            </Space>
          </Card>
        </Col>
      </Row>
    </>
  );
}

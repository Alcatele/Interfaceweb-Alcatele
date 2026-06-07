import {
  AudioMutedOutlined,
  CustomerServiceOutlined,
  DeleteOutlined,
  ForwardOutlined,
  MailOutlined,
  PauseOutlined,
  PhoneOutlined,
  SoundOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DestinationPicker from '../components/DestinationPicker';
import PageHeader from '../components/PageHeader';

const dialKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

type ForwardType = 'always' | 'busy' | 'no_answer' | 'unavailable';

type ForwardingValues = {
  enabled: boolean;
  type: ForwardType;
  destination: string;
  timeout: number;
};

const forwardTypeOptions = [
  { label: 'Sempre (incondicional)', value: 'always' },
  { label: 'Quando ocupado', value: 'busy' },
  { label: 'Sem resposta', value: 'no_answer' },
  { label: 'Quando indisponível', value: 'unavailable' },
];

export default function Webphone() {
  const [forwardForm] = Form.useForm<ForwardingValues>();
  const navigate = useNavigate();
  const [number, setNumber] = useState('1001');
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [forwarding, setForwarding] = useState<ForwardingValues>({
    enabled: false,
    type: 'always',
    destination: '',
    timeout: 20,
  });
  const [messageApi, contextHolder] = message.useMessage();
  const forwardingEnabled = Form.useWatch('enabled', forwardForm);
  const selectedForwardType = Form.useWatch('type', forwardForm);

  function openForwardModal() {
    forwardForm.setFieldsValue(forwarding);
    setForwardModalOpen(true);
  }

  function saveForwarding(values: ForwardingValues) {
    setForwarding(values);
    setForwardModalOpen(false);
    messageApi.success(
      values.enabled ? 'Desvio de chamadas ativado.' : 'Desvio desativado.',
    );
  }

  return (
    <>
      {contextHolder}
      <PageHeader
        kicker="WebRTC"
        title="Webphone WebRTC"
        description="Interface inicial para chamadas via navegador, discador, controles de áudio e histórico rápido."
      />
      <div className="webphone-shell">
        <Card className="soft-panel" title="Discador">
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <Input
              onChange={(event) => setNumber(event.target.value)}
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
              <Button
                block
                icon={<PhoneOutlined />}
                size="large"
                type="primary"
              >
                Chamar
              </Button>
            </Space.Compact>
          </Space>
        </Card>

        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card className="soft-panel" title="Sessão atual">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Typography.Text type="secondary">Conta SIP</Typography.Text>
                <Typography.Title level={4}>1002 - Admin</Typography.Title>
              </Col>
              <Col xs={24} md={8}>
                <Typography.Text type="secondary">Estado</Typography.Text>
                <Typography.Title level={4}>
                  <Tag color="success">Registrado</Tag>
                </Typography.Title>
              </Col>
              <Col xs={24} md={8}>
                <Typography.Text type="secondary">Codec preferencial</Typography.Text>
                <Typography.Title level={4}>Opus / PCMU</Typography.Title>
              </Col>
            </Row>
            <Space wrap>
              <Button icon={<AudioMutedOutlined />}>Mudo</Button>
              <Button icon={<PauseOutlined />}>Espera</Button>
              <Button icon={<CustomerServiceOutlined />}>Transferir</Button>
              <Button icon={<SoundOutlined />}>Alto-falante</Button>
              <Button icon={<ForwardOutlined />} onClick={openForwardModal}>
                Desvio de chamadas
              </Button>
              <Button
                icon={<MailOutlined />}
                onClick={() => navigate('/correio-voz')}
              >
                Correio de voz
              </Button>
              {forwarding.enabled ? (
                <Tag color="processing">
                  Desvio ativo para {forwarding.destination}
                </Tag>
              ) : null}
            </Space>
          </Card>

          <Card className="soft-panel" title="Chamadas recentes">
            <List
              dataSource={[
                { title: '+55 11 98888-1212', description: 'Entrada atendida - 3m42s' },
                { title: '1004', description: 'Interna atendida - 7m11s' },
                { title: '+55 31 97777-2323', description: 'Entrada perdida' },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<PhoneOutlined />}
                    description={item.description}
                    title={item.title}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Space>
      </div>

      <Modal
        forceRender
        footer={null}
        onCancel={() => setForwardModalOpen(false)}
        open={forwardModalOpen}
        title="Desvio de chamadas"
      >
        <Form
          form={forwardForm}
          initialValues={forwarding}
          layout="vertical"
          onFinish={saveForwarding}
          requiredMark={false}
        >
          <Form.Item
            label="Ativar desvio"
            name="enabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label="Tipo de desvio"
            name="type"
            rules={[
              {
                required: forwardingEnabled,
                message: 'Selecione o tipo de desvio.',
              },
            ]}
          >
            <Select options={forwardTypeOptions} />
          </Form.Item>
          <Form.Item
            label="Destino"
            name="destination"
            rules={[
              {
                required: forwardingEnabled,
                message: 'Informe o número ou ramal de destino.',
              },
            ]}
          >
            <DestinationPicker placeholder="Selecione o destino do desvio" />
          </Form.Item>
          {forwardingEnabled && selectedForwardType === 'no_answer' ? (
            <Form.Item
              label="Tempo sem resposta"
              name="timeout"
              rules={[{ required: true, message: 'Informe o tempo de espera.' }]}
            >
              <InputNumber
                addonAfter="segundos"
                max={60}
                min={5}
                style={{ width: '100%' }}
              />
            </Form.Item>
          ) : null}
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => setForwardModalOpen(false)}>Cancelar</Button>
            <Button htmlType="submit" type="primary">
              Salvar desvio
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}


import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
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
  Popconfirm,
  Row,
  Space,
  Switch,
  Tag,
  message,
} from 'antd';
import { useState } from 'react';
import DestinationPicker from '../components/DestinationPicker';
import PageHeader from '../components/PageHeader';
import { ivrMenus, type IvrMenu } from '../services/mockData';

type IvrFormValues = Omit<IvrMenu, 'id'>;

export default function Ivr() {
  const [form] = Form.useForm<IvrFormValues>();
  const [items, setItems] = useState(ivrMenus);
  const [editing, setEditing] = useState<IvrMenu | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  function openCreate() {
    setEditing(null);
    form.setFieldsValue({
      enabled: true,
      timeout: 8,
      options: [{ digit: '1', destination: 'Fila Comercial' }],
    });
    setModalOpen(true);
  }

  function openEdit(ivr: IvrMenu) {
    setEditing(ivr);
    form.setFieldsValue(ivr);
    setModalOpen(true);
  }

  function closeModal() {
    form.resetFields();
    setEditing(null);
    setModalOpen(false);
  }

  function saveIvr(values: IvrFormValues) {
    if (editing) {
      setItems((current) =>
        current.map((item) =>
          item.id === editing.id ? { ...values, id: editing.id } : item,
        ),
      );
      messageApi.success(`URA ${values.name} atualizada.`);
    } else {
      setItems((current) => [
        ...current,
        { ...values, id: `ivr-${Date.now()}` },
      ]);
      messageApi.success(`URA ${values.name} criada.`);
    }

    closeModal();
  }

  function removeIvr(ivr: IvrMenu) {
    setItems((current) => current.filter((item) => item.id !== ivr.id));
    messageApi.success(`URA ${ivr.name} apagada.`);
  }

  function toggleIvr(ivr: IvrMenu, enabled: boolean) {
    setItems((current) =>
      current.map((item) => (item.id === ivr.id ? { ...item, enabled } : item)),
    );
  }

  return (
    <>
      {contextHolder}
      <PageHeader
        actions={
          <Button icon={<PlusOutlined />} onClick={openCreate} type="primary">
            Nova URA
          </Button>
        }
        kicker="Atendimento automatico"
        title="URA"
        description="Menus de voz, saudações, timeout e encaminhamentos por digito para organizar o primeiro atendimento."
      />

      <Row gutter={[16, 16]}>
        {items.map((ivr) => (
          <Col key={ivr.id} xs={24} xl={12}>
            <Card
              className="soft-panel"
              extra={
                <Space>
                  <Switch
                    checked={ivr.enabled}
                    onChange={(checked) => toggleIvr(ivr, checked)}
                  />
                  <Button
                    aria-label={`Editar URA ${ivr.name}`}
                    title={`Editar URA ${ivr.name}`}
                    icon={<EditOutlined />}
                    onClick={() => openEdit(ivr)}
                    size="small"
                  />
                  <Popconfirm
                    cancelText="Cancelar"
                    okButtonProps={{ danger: true }}
                    okText="Apagar"
                    onConfirm={() => removeIvr(ivr)}
                    title={`Apagar a URA ${ivr.name}?`}
                  >
                    <Button
                      aria-label={`Apagar URA ${ivr.name}`}
                      title={`Apagar URA ${ivr.name}`}
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                    />
                  </Popconfirm>
                </Space>
              }
              title={ivr.name}
            >
              <Space direction="vertical" size={8}>
                <Tag icon={<SoundOutlined />}>{ivr.greeting}</Tag>
                <Tag>Timeout {ivr.timeout}s</Tag>
              </Space>
              <List
                dataSource={ivr.options}
                header="Opções"
                renderItem={(option) => (
                  <List.Item>
                    <List.Item.Meta
                      description="Destino configurado"
                      title={`Tecla ${option.digit}`}
                    />
                    <Tag color="blue">{option.destination}</Tag>
                  </List.Item>
                )}
                size="small"
              />
            </Card>
          </Col>
        ))}
      </Row>
      <Modal
        footer={null}
        onCancel={closeModal}
        open={modalOpen}
        title={editing ? 'Editar URA' : 'Nova URA'}
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={saveIvr}>
          <Form.Item label="Nome" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Áudio de saudação" name="greeting" rules={[{ required: true }]}>
            <Input placeholder="bem-vindo.wav" />
          </Form.Item>
          <Form.Item label="Timeout" name="timeout" rules={[{ required: true }]}>
            <InputNumber addonAfter="segundos" min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Ativa" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.List name="options">
            {(fields, { add, remove }) => (
              <Card
                size="small"
                title="Opções da URA"
                extra={<Button onClick={() => add({ digit: '', destination: '' })}>Adicionar</Button>}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {fields.map((field) => (
                    <Row gutter={12} key={field.key}>
                      <Col xs={24} md={6}>
                        <Form.Item
                          label="Tecla"
                          name={[field.name, 'digit']}
                          rules={[{ required: true }]}
                        >
                          <Input />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={15}>
                        <Form.Item
                          label="Destino"
                          name={[field.name, 'destination']}
                          rules={[{ required: true }]}
                        >
                          <DestinationPicker />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={3}>
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => remove(field.name)}
                          style={{ marginTop: 30 }}
                        />
                      </Col>
                    </Row>
                  ))}
                </Space>
              </Card>
            )}
          </Form.List>
          <Space style={{ justifyContent: 'flex-end', marginTop: 16, width: '100%' }}>
            <Button onClick={closeModal}>Cancelar</Button>
            <Button htmlType="submit" type="primary">
              {editing ? 'Salvar URA' : 'Criar URA'}
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}


import {
  DeleteOutlined,
  EditOutlined,
  MailOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/useAuth';
import { getApiErrorMessage } from '../services/api';
import {
  mvpApi,
  type TenantResources,
  type VoicemailBox,
} from '../services/mvpApi';

type VoicemailBoxForm = {
  mailbox: string;
  name: string;
  notificationEmail?: string;
  transcriptionEnabled: boolean;
  enabled: boolean;
};

export default function Voicemail() {
  const [form] = Form.useForm<VoicemailBoxForm>();
  const [items, setItems] = useState<VoicemailBox[]>([]);
  const [resources, setResources] = useState<TenantResources | null>(null);
  const [editing, setEditing] = useState<VoicemailBox | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();
  const { activeTenant, hasPermission } = useAuth();
  const canManage = hasPermission('pbx.configure');
  const limit = resources?.limits.voicemailBoxes ?? 0;
  const used = resources?.usage.voicemailBoxes ?? items.length;
  const limitReached = used >= limit;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [boxes, nextResources] = await Promise.all([
        mvpApi.listVoicemailBoxes(),
        mvpApi.tenantResources(),
      ]);
      setItems(boxes);
      setResources(nextResources);
    } catch (error) {
      messageApi.error(
        getApiErrorMessage(
          error,
          'Não foi possível carregar as caixas postais.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void load();
  }, [activeTenant?.id, load]);

  function openCreate() {
    setEditing(null);
    form.setFieldsValue({
      enabled: true,
      transcriptionEnabled: false,
    });
    setModalOpen(true);
  }

  function openEdit(box: VoicemailBox) {
    setEditing(box);
    form.setFieldsValue({
      ...box,
      notificationEmail: box.notificationEmail ?? undefined,
    });
    setModalOpen(true);
  }

  function closeModal() {
    form.resetFields();
    setEditing(null);
    setModalOpen(false);
  }

  async function save(values: VoicemailBoxForm) {
    const input = {
      ...values,
      notificationEmail: values.notificationEmail?.trim() || null,
    };

    try {
      if (editing) {
        await mvpApi.updateVoicemailBox(editing.id, input);
      } else {
        await mvpApi.createVoicemailBox(input);
      }
      messageApi.success('Caixa postal enviada para provisionamento.');
      closeModal();
      await load();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error));
    }
  }

  async function removeBox(box: VoicemailBox) {
    try {
      await mvpApi.removeVoicemailBox(box.id);
      messageApi.success(`Caixa postal ${box.mailbox} removida.`);
      await load();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error));
    }
  }

  async function toggleBox(box: VoicemailBox, enabled: boolean) {
    try {
      await mvpApi.updateVoicemailBox(box.id, { ...box, enabled });
      await load();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error));
    }
  }

  const columns: ColumnsType<VoicemailBox> = [
    {
      title: 'Caixa postal',
      dataIndex: 'mailbox',
      key: 'mailbox',
      render: (mailbox: string) => (
        <Tag color="blue" icon={<MailOutlined />}>
          {mailbox}
        </Tag>
      ),
    },
    { title: 'Nome', dataIndex: 'name', key: 'name' },
    {
      title: 'Notificação por e-mail',
      dataIndex: 'notificationEmail',
      key: 'notificationEmail',
      render: (email: string | null) => email ?? 'Não configurado',
    },
    {
      title: 'Transcrição',
      dataIndex: 'transcriptionEnabled',
      key: 'transcriptionEnabled',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'processing' : 'default'}>
          {enabled ? 'Habilitada' : 'Desabilitada'}
        </Tag>
      ),
    },
    {
      title: 'Sincronização',
      dataIndex: 'syncStatus',
      key: 'syncStatus',
      render: (status: VoicemailBox['syncStatus']) => (
        <Tag color={status === 'synced' ? 'success' : 'warning'}>{status}</Tag>
      ),
    },
    {
      title: 'Ativa',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean, box) => (
        <Switch
          checked={enabled}
          disabled={!canManage}
          onChange={(checked) => void toggleBox(box, checked)}
        />
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 100,
      render: (_, box) =>
        canManage ? (
          <Space>
            <Button
              aria-label={`Editar caixa postal ${box.mailbox}`}
              icon={<EditOutlined />}
              onClick={() => openEdit(box)}
              size="small"
            />
            <Popconfirm
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
              okText="Apagar"
              onConfirm={() => void removeBox(box)}
              title={`Apagar a caixa postal ${box.mailbox}?`}
            >
              <Button danger icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          </Space>
        ) : null,
    },
  ];

  return (
    <>
      {contextHolder}
      <PageHeader
        actions={
          <>
            <Tag color={limitReached ? 'warning' : 'blue'}>
              Contratado: {used}/{limit}
            </Tag>
            {canManage ? (
              <Button
                disabled={limitReached}
                icon={<PlusOutlined />}
                onClick={openCreate}
                type="primary"
              >
                Nova caixa postal
              </Button>
            ) : null}
          </>
        }
        kicker="Mensagens de voz"
        title="Correio de voz"
        description="Configure caixas postais, notificações por e-mail e transcrição de mensagens."
      />

      <Card className="soft-panel">
        <Table
          columns={columns}
          dataSource={items}
          loading={loading}
          locale={{
            emptyText: (
              <Space direction="vertical" align="center">
                <MailOutlined />
                <Typography.Text>
                  Nenhuma caixa postal configurada.
                </Typography.Text>
              </Space>
            ),
          }}
          pagination={false}
          rowKey="id"
          scroll={{ x: 980 }}
        />
      </Card>

      <Modal
        footer={null}
        onCancel={closeModal}
        open={modalOpen}
        title={editing ? 'Editar caixa postal' : 'Nova caixa postal'}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={save}
          requiredMark={false}
        >
          <Form.Item
            label="Número da caixa postal"
            name="mailbox"
            rules={[{ required: true, message: 'Informe a caixa postal.' }]}
          >
            <Input placeholder="1001" />
          </Form.Item>
          <Form.Item
            label="Nome"
            name="name"
            rules={[{ required: true, message: 'Informe o nome.' }]}
          >
            <Input placeholder="Caixa postal comercial" />
          </Form.Item>
          <Form.Item
            label="E-mail para notificações"
            name="notificationEmail"
            rules={[{ type: 'email', message: 'Informe um e-mail válido.' }]}
          >
            <Input placeholder="usuario@empresa.com.br" />
          </Form.Item>
          <Form.Item
            label="Transcrição automática"
            name="transcriptionEnabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item label="Ativa" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={closeModal}>Cancelar</Button>
            <Button htmlType="submit" type="primary">
              Salvar caixa postal
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}

import {
  CheckCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  MailOutlined,
  PauseCircleOutlined,
  PhoneOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { Button, Card, Popconfirm, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/useAuth';

type VoicemailMessage = {
  id: string;
  caller: string;
  mailbox: string;
  receivedAt: string;
  duration: string;
  status: 'new' | 'read';
  transcription: string;
};

const initialMessages: VoicemailMessage[] = [
  {
    id: 'vm-1',
    caller: '+55 11 98888-1212',
    mailbox: '1001',
    receivedAt: 'Hoje, 09:14',
    duration: '0m42s',
    status: 'new',
    transcription: 'Cliente solicitou retorno sobre o orçamento enviado.',
  },
  {
    id: 'vm-2',
    caller: '1005 - Marina Costa',
    mailbox: '1002',
    receivedAt: 'Hoje, 08:51',
    duration: '1m18s',
    status: 'read',
    transcription: 'Mensagem interna sobre ajuste de escala da fila comercial.',
  },
  {
    id: 'vm-3',
    caller: '+55 31 97777-2323',
    mailbox: '1003',
    receivedAt: 'Ontem, 17:26',
    duration: '0m55s',
    status: 'new',
    transcription: 'Pedido de confirmação do horário de atendimento.',
  },
  {
    id: 'vm-4',
    caller: '+55 21 96666-4545',
    mailbox: '1005',
    receivedAt: 'Ontem, 14:08',
    duration: '2m03s',
    status: 'read',
    transcription: 'Fornecedor deixou atualização sobre o chamado técnico.',
  },
];

export default function Voicemail() {
  const { currentUser, role } = useAuth();
  const [messages, setMessages] = useState<VoicemailMessage[]>(initialMessages);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const canViewAll = ['super_admin', 'admin', 'supervisor'].includes(role);

  const visibleMessages = useMemo(() => {
    if (canViewAll) {
      return messages;
    }

    return messages.filter((item) => item.mailbox === currentUser?.extension);
  }, [canViewAll, currentUser?.extension, messages]);

  function toggleRead(messageId: string) {
    setMessages((items) =>
      items.map((item) =>
        item.id === messageId
          ? { ...item, status: item.status === 'new' ? 'read' : 'new' }
          : item,
      ),
    );
  }

  function deleteMessage(messageId: string) {
    setMessages((items) => items.filter((item) => item.id !== messageId));
    messageApi.success('Mensagem apagada.');
  }

  function downloadMessage(messageItem: VoicemailMessage) {
    messageApi.success(`Mensagem ${messageItem.id} preparada para download.`);
  }

  function returnCall(messageItem: VoicemailMessage) {
    messageApi.success(`Retornando chamada para ${messageItem.caller}.`);
  }

  const columns: ColumnsType<VoicemailMessage> = [
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: VoicemailMessage['status']) => (
        <Tag color={status === 'new' ? 'processing' : 'default'}>
          {status === 'new' ? 'Nova' : 'Lida'}
        </Tag>
      ),
    },
    { title: 'Caixa postal', dataIndex: 'mailbox', key: 'mailbox' },
    { title: 'Origem', dataIndex: 'caller', key: 'caller' },
    { title: 'Recebida em', dataIndex: 'receivedAt', key: 'receivedAt' },
    { title: 'Duração', dataIndex: 'duration', key: 'duration' },
    {
      title: 'Transcrição',
      dataIndex: 'transcription',
      key: 'transcription',
      render: (value: string) => (
        <Typography.Text type="secondary">{value}</Typography.Text>
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, item) => (
        <Space>
          <Button
            aria-label={
              playingId === item.id ? 'Pausar mensagem' : 'Ouvir mensagem'
            }
            title={playingId === item.id ? 'Pausar mensagem' : 'Ouvir mensagem'}
            icon={
              playingId === item.id ? <PauseCircleOutlined /> : <PlayCircleOutlined />
            }
            onClick={() =>
              setPlayingId((current) => (current === item.id ? null : item.id))
            }
          />
          <Button
            aria-label="Retornar chamada"
            title="Retornar chamada"
            icon={<PhoneOutlined />}
            onClick={() => returnCall(item)}
          />
          <Button
            aria-label="Baixar mensagem"
            title="Baixar mensagem"
            icon={<DownloadOutlined />}
            onClick={() => downloadMessage(item)}
          />
          <Button
            aria-label={
              item.status === 'new' ? 'Marcar como lida' : 'Marcar como nova'
            }
            title={item.status === 'new' ? 'Marcar como lida' : 'Marcar como nova'}
            icon={<CheckCircleOutlined />}
            onClick={() => toggleRead(item.id)}
          />
          <Popconfirm
            cancelText="Cancelar"
            okText="Apagar"
            onConfirm={() => deleteMessage(item.id)}
            title="Apagar esta mensagem?"
          >
            <Button
              aria-label="Apagar mensagem"
              danger
              icon={<DeleteOutlined />}
              title="Apagar mensagem"
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
          <Button icon={<PhoneOutlined />} type="primary">
            Ligar para correio de voz
          </Button>
        }
        kicker="Mensagens de voz"
        title="Correio de voz"
        description={
          canViewAll
            ? 'Consulte caixas postais, ouça mensagens e retorne chamadas.'
            : 'Consulte sua caixa postal, ouça mensagens e retorne chamadas.'
        }
      />

      <Card className="soft-panel">
        <Table
          columns={columns}
          dataSource={visibleMessages}
          locale={{
            emptyText: (
              <Space direction="vertical" align="center">
                <MailOutlined />
                <Typography.Text>Nenhuma mensagem de voz encontrada.</Typography.Text>
              </Space>
            ),
          }}
          pagination={{ pageSize: 6 }}
          rowKey="id"
        />
      </Card>
    </>
  );
}

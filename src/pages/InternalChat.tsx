import {
  MessageOutlined,
  PlusOutlined,
  SendOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Typography,
} from 'antd';
import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/useAuth';
import {
  createChatConversation,
  listChatConversations,
  listChatMessages,
  sendChatMessage,
} from '../services/mockChat';
import { listPublicUsers } from '../services/mockUsers';

type NewConversationValues = {
  title: string;
  memberIds: string[];
};

export default function InternalChat() {
  const { currentUser } = useAuth();
  const [form] = Form.useForm<NewConversationValues>();
  const [conversations, setConversations] = useState(listChatConversations);
  const [conversationId, setConversationId] = useState(
    conversations[0].id,
  );
  const [messages, setMessages] = useState(listChatMessages);
  const [draft, setDraft] = useState('');
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const userOptions = listPublicUsers()
    .filter((user) => user.id !== currentUser?.id)
    .map((user) => ({
      label: `${user.name} (${user.username})`,
      value: user.id,
    }));
  const visibleConversations = conversations.filter(
    (conversation) =>
      conversation.memberIds.length === 0 ||
      (currentUser && conversation.memberIds.includes(currentUser.id)),
  );
  const currentConversation = visibleConversations.find(
    (conversation) => conversation.id === conversationId,
  );
  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (message) => message.conversationId === conversationId,
      ),
    [conversationId, messages],
  );

  function send() {
    if (!currentUser || !draft.trim()) {
      return;
    }

    const message = sendChatMessage(
      conversationId,
      currentUser.id,
      currentUser.name,
      draft,
    );
    setMessages((current) => [...current, message]);
    setDraft('');
  }

  function createConversation(values: NewConversationValues) {
    if (!currentUser) {
      return;
    }

    const conversation = createChatConversation(
      values.title,
      currentUser.id,
      values.memberIds,
    );
    setConversations((current) => [...current, conversation]);
    setConversationId(conversation.id);
    form.resetFields();
    setNewConversationOpen(false);
  }

  return (
    <>
      <PageHeader
        actions={
          <Button
            icon={<PlusOutlined />}
            onClick={() => setNewConversationOpen(true)}
            type="primary"
          >
            Nova conversa
          </Button>
        }
        description="Troque mensagens rápidas com equipes e usuários da empresa."
        kicker="Comunicação interna"
        title="Chat interno"
      />
      <div className="chat-shell">
        <Card className="soft-panel chat-sidebar" title="Conversas">
          <List
            dataSource={visibleConversations}
            renderItem={(conversation) => (
              <List.Item
                className={
                  conversation.id === conversationId
                    ? 'chat-conversation-active'
                    : undefined
                }
                onClick={() => setConversationId(conversation.id)}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      icon={
                        conversation.type === 'channel' ? (
                          <TeamOutlined />
                        ) : (
                          <UserOutlined />
                        )
                      }
                    />
                  }
                  description={
                    conversation.type === 'channel'
                      ? 'Canal da equipe'
                      : 'Conversa direta'
                  }
                  title={conversation.title}
                />
              </List.Item>
            )}
          />
        </Card>
        <Card
          className="soft-panel chat-panel"
          title={
            <Space>
              <MessageOutlined />
              {currentConversation?.title}
            </Space>
          }
        >
          <div className="chat-messages">
            {visibleMessages.length === 0 ? (
              <Empty description="Nenhuma mensagem nesta conversa" />
            ) : (
              visibleMessages.map((message) => {
                const ownMessage = message.senderId === currentUser?.id;

                return (
                  <div
                    className={`chat-message ${ownMessage ? 'chat-message-own' : ''}`}
                    key={message.id}
                  >
                    <Typography.Text strong>{message.senderName}</Typography.Text>
                    <Typography.Paragraph>{message.text}</Typography.Paragraph>
                    <Typography.Text type="secondary">
                      {message.sentAt}
                    </Typography.Text>
                  </div>
                );
              })
            )}
          </div>
          <Space.Compact className="chat-composer">
            <Input
              onChange={(event) => setDraft(event.target.value)}
              onPressEnter={send}
              placeholder="Escreva uma mensagem"
              value={draft}
            />
            <Button
              aria-label="Enviar mensagem"
              title="Enviar mensagem"
              icon={<SendOutlined />}
              onClick={send}
              type="primary"
            />
          </Space.Compact>
        </Card>
      </div>
      <Modal
        footer={null}
        onCancel={() => setNewConversationOpen(false)}
        open={newConversationOpen}
        title="Nova conversa"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={createConversation}
          requiredMark={false}
        >
          <Form.Item
            label="Nome da conversa"
            name="title"
            rules={[{ required: true, message: 'Informe o nome da conversa.' }]}
          >
            <Input placeholder="Ex.: Projeto implantação" />
          </Form.Item>
          <Form.Item
            label="Participantes"
            name="memberIds"
            rules={[{ required: true, message: 'Selecione participantes.' }]}
          >
            <Select mode="multiple" options={userOptions} />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => setNewConversationOpen(false)}>
              Cancelar
            </Button>
            <Button htmlType="submit" type="primary">
              Criar conversa
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}


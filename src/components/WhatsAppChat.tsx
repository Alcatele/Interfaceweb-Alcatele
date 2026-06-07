import { MessageOutlined } from '@ant-design/icons';
import { useState } from 'react';
import type { FC } from 'react';
import {
  Button,
  Card,
  Input,
  List,
  Space,
  Typography,
  message,
  Drawer,
} from 'antd';
import { whatsappService, type WhatsAppMessage, type WhatsAppContact } from '../services/whatsapp';

export const WhatsAppChat: FC<{ contact?: WhatsAppContact }> = ({ contact }) => {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  async function loadMessages() {
    if (!contact) return;

    try {
      setLoading(true);
      const conversation = await whatsappService.getConversation(
        contact.phoneNumber,
      );
      setMessages(conversation);
    } catch (error) {
      messageApi.error('Erro ao carregar mensagens');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!contact || !newMessage.trim()) return;

    try {
      setLoading(true);
      const sentMessage = await whatsappService.sendMessage(
        contact.phoneNumber,
        newMessage,
      );
      setMessages((current) => [...current, sentMessage]);
      setNewMessage('');
      messageApi.success('Mensagem enviada');
    } catch (error) {
      messageApi.error('Erro ao enviar mensagem');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  if (!contact) {
    return (
      <Card>
        <Typography.Text type="secondary">
          Selecione um contato para iniciar uma conversa
        </Typography.Text>
      </Card>
    );
  }

  return (
    <>
      {contextHolder}
      <Card title={`Chat com ${contact.displayName}`}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <List
            bordered
            dataSource={messages}
            loading={loading}
            renderItem={(msg) => (
              <List.Item>
                <Space direction="vertical" style={{ width: '100%' }} size={0}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(msg.timestamp).toLocaleTimeString('pt-BR')}
                  </Typography.Text>
                  <Typography.Text>{msg.body}</Typography.Text>
                </Space>
              </List.Item>
            )}
            style={{ maxHeight: 400, overflowY: 'auto' }}
          />

          <Space style={{ width: '100%' }}>
            <Input
              placeholder="Digite sua mensagem..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onPressEnter={sendMessage}
            />
            <Button
              icon={<MessageOutlined />}
              onClick={sendMessage}
              loading={loading}
              type="primary"
            >
              Enviar
            </Button>
          </Space>
        </Space>
      </Card>
    </>
  );
};

export default WhatsAppChat;

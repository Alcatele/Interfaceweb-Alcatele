import {
  DeleteOutlined,
  MessageOutlined,
  PhoneOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Input,
  List,
  Modal,
  Popconfirm,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
  Badge,
  Avatar,
  Empty,
} from 'antd';
import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import WhatsAppChat from '../components/WhatsAppChat';
import { whatsappService, type WhatsAppContact } from '../services/whatsapp';

export default function WhatsAppMessaging() {
  const [contacts, setContacts] = useState<WhatsAppContact[]>([
    {
      id: 'contact-1',
      phoneNumber: '+5511987654321',
      displayName: 'João Silva',
      lastMessageTime: '2026-06-07T15:30:00Z',
      status: 'active',
    },
    {
      id: 'contact-2',
      phoneNumber: '+5511912345678',
      displayName: 'Maria Santos',
      lastMessageTime: '2026-06-07T14:15:00Z',
      status: 'active',
    },
    {
      id: 'contact-3',
      phoneNumber: '+5511998765432',
      displayName: 'Carlos Costa',
      lastMessageTime: '2026-06-07T10:45:00Z',
      status: 'inactive',
    },
    {
      id: 'contact-4',
      phoneNumber: '+5521987654321',
      displayName: 'Ana Paula',
      lastMessageTime: '2026-06-07T09:20:00Z',
      status: 'active',
    },
    {
      id: 'contact-5',
      phoneNumber: '+5585912345678',
      displayName: 'Pedro Oliveira',
      lastMessageTime: '2026-06-06T16:50:00Z',
      status: 'inactive',
    },
  ]);

  const [messageApi, contextHolder] = message.useMessage();
  const [selectedContact, setSelectedContact] = useState<WhatsAppContact | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phoneNumber.includes(searchTerm),
  );

  const activeContacts = contacts.filter((c) => c.status === 'active').length;

  async function loadContacts() {
    try {
      // In production, replace with: const data = await whatsappService.getContacts();
      messageApi.success('Contatos carregados');
    } catch (error) {
      messageApi.error('Erro ao carregar contatos');
      console.error(error);
    }
  }

  function removeContact(contact: WhatsAppContact) {
    setContacts((current) => current.filter((c) => c.id !== contact.id));
    if (selectedContact?.id === contact.id) {
      setSelectedContact(null);
    }
    messageApi.success(`Contato ${contact.displayName} removido`);
  }

  function handleAddContact() {
    if (!newPhoneNumber.trim()) {
      messageApi.error('Informe um número de telefone');
      return;
    }

    const newContact: WhatsAppContact = {
      id: `contact-${Date.now()}`,
      phoneNumber: newPhoneNumber,
      displayName: newPhoneNumber,
      status: 'active',
    };

    setContacts((current) => [...current, newContact]);
    messageApi.success('Contato adicionado com sucesso');
    setNewPhoneNumber('');
    setNewContactOpen(false);
  }

  return (
    <>
      {contextHolder}
      <PageHeader
        actions={
          <>
            <Button
              icon={<PlusOutlined />}
              onClick={() => setNewContactOpen(true)}
              type="primary"
            >
              Novo Contato
            </Button>
          </>
        }
        kicker="Comunicação com clientes"
        title="WhatsApp Messaging"
        description="Gerencie e responda mensagens do WhatsApp de forma centralizada."
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card className="soft-panel">
            <Statistic
              title="Contatos Totais"
              value={contacts.length}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card className="soft-panel">
            <Statistic
              title="Contatos Ativos"
              value={activeContacts}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card className="soft-panel">
            <Statistic
              title="Mensagens Hoje"
              value={24}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card className="soft-panel">
            <Statistic
              title="Taxa Resposta"
              value="94.5"
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={8}>
          <Card
            className="soft-panel"
            title={
              <Space>
                <MessageOutlined />
                <span>Contatos</span>
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Input
                prefix={<SearchOutlined />}
                placeholder="Buscar contato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              {filteredContacts.length > 0 ? (
                <List
                  dataSource={filteredContacts}
                  renderItem={(contact) => (
                    <List.Item
                      key={contact.id}
                      onClick={() => setSelectedContact(contact)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor:
                          selectedContact?.id === contact.id
                            ? '#f0f5ff'
                            : 'transparent',
                        borderRadius: 4,
                        padding: 8,
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          <Badge
                            status={
                              contact.status === 'active' ? 'success' : 'default'
                            }
                            offset={[-5, 5]}
                          >
                            <Avatar>{contact.displayName.charAt(0)}</Avatar>
                          </Badge>
                        }
                        title={
                          <Space direction="vertical" size={0}>
                            <Typography.Text strong>
                              {contact.displayName}
                            </Typography.Text>
                            <Typography.Text
                              type="secondary"
                              style={{ fontSize: 12 }}
                            >
                              {contact.phoneNumber}
                            </Typography.Text>
                          </Space>
                        }
                        description={
                          contact.lastMessageTime ? (
                            <Typography.Text
                              type="secondary"
                              style={{ fontSize: 11 }}
                            >
                              {new Date(
                                contact.lastMessageTime,
                              ).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Typography.Text>
                          ) : null
                        }
                      />
                      <Popconfirm
                        cancelText="Cancelar"
                        okButtonProps={{ danger: true }}
                        okText="Remover"
                        onConfirm={(e) => {
                          e?.stopPropagation();
                          removeContact(contact);
                        }}
                        title={`Remover ${contact.displayName}?`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          size="small"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Popconfirm>
                    </List.Item>
                  )}
                  split={false}
                  style={{ maxHeight: 500, overflowY: 'auto' }}
                />
              ) : (
                <Empty description="Nenhum contato encontrado" />
              )}
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          {selectedContact ? (
            <Card className="soft-panel">
              <Space
                direction="vertical"
                style={{ width: '100%' }}
                size="large"
              >
                <Row justify="space-between" align="middle">
                  <Space>
                    <Avatar size={48}>
                      {selectedContact.displayName.charAt(0)}
                    </Avatar>
                    <Space direction="vertical" size={0}>
                      <Typography.Title level={4} style={{ margin: 0 }}>
                        {selectedContact.displayName}
                      </Typography.Title>
                      <Typography.Text type="secondary">
                        {selectedContact.phoneNumber}
                      </Typography.Text>
                    </Space>
                  </Space>
                  <Space>
                    <Tag
                      color={
                        selectedContact.status === 'active'
                          ? 'success'
                          : 'default'
                      }
                    >
                      {selectedContact.status === 'active'
                        ? 'Ativo'
                        : 'Inativo'}
                    </Tag>
                    <Button icon={<PhoneOutlined />} disabled>
                      Ligar
                    </Button>
                  </Space>
                </Row>

                <div
                  style={{
                    height: 400,
                    border: '1px solid #f0f0f0',
                    borderRadius: 4,
                    padding: 16,
                    backgroundColor: '#fafafa',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                  }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div
                      style={{
                        backgroundColor: '#e6f7ff',
                        padding: 8,
                        borderRadius: 4,
                        marginLeft: 'auto',
                        maxWidth: '70%',
                      }}
                    >
                      <Typography.Text>
                        Olá, tudo bem? Como posso ajudá-lo?
                      </Typography.Text>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        14:15
                      </div>
                    </div>
                    <div
                      style={{
                        backgroundColor: '#f6f6f6',
                        padding: 8,
                        borderRadius: 4,
                        marginRight: 'auto',
                        maxWidth: '70%',
                      }}
                    >
                      <Typography.Text>
                        Oi! Gostaria de saber mais sobre seus serviços.
                      </Typography.Text>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        14:16
                      </div>
                    </div>
                  </Space>
                </div>

                <Space style={{ width: '100%' }}>
                  <Input.TextArea
                    placeholder="Digite sua mensagem..."
                    rows={3}
                  />
                  <Button type="primary" icon={<MessageOutlined />}>
                    Enviar
                  </Button>
                </Space>
              </Space>
            </Card>
          ) : (
            <Card className="soft-panel">
              <Empty description="Selecione um contato para começar uma conversa" />
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        footer={null}
        onCancel={() => setNewContactOpen(false)}
        open={newContactOpen}
        title="Adicionar Novo Contato"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Input
            placeholder="Número do WhatsApp (com código do país)"
            value={newPhoneNumber}
            onChange={(e) => setNewPhoneNumber(e.target.value)}
            prefix="+55"
          />
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => setNewContactOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddContact} type="primary">
              Adicionar Contato
            </Button>
          </Space>
        </Space>
      </Modal>
    </>
  );
}

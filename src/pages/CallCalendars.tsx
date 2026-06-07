import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import DestinationPicker from '../components/DestinationPicker';
import PageHeader from '../components/PageHeader';
import {
  callCalendars,
  type CallCalendar,
  type CallCalendarHoliday,
} from '../services/mockData';

type CalendarFormValues = Omit<CallCalendar, 'id'>;

const emptyCalendar: CalendarFormValues = {
  name: '',
  timezone: 'America/Sao_Paulo',
  businessHours: 'Seg-Sex 08:00-18:00',
  businessDestination: '',
  afterHoursDestination: '',
  holidayDestination: '',
  holidays: [],
  enabled: true,
};

export default function CallCalendars() {
  const [form] = Form.useForm<CalendarFormValues>();
  const [items, setItems] = useState(callCalendars);
  const [editing, setEditing] = useState<CallCalendar | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  function openCreate() {
    setEditing(null);
    form.setFieldsValue(emptyCalendar);
    setModalOpen(true);
  }

  function openEdit(calendar: CallCalendar) {
    setEditing(calendar);
    form.setFieldsValue(calendar);
    setModalOpen(true);
  }

  function closeModal() {
    form.resetFields();
    setModalOpen(false);
    setEditing(null);
  }

  function saveCalendar(values: CalendarFormValues) {
    if (editing) {
      setItems((current) =>
        current.map((item) =>
          item.id === editing.id ? { ...values, id: editing.id } : item,
        ),
      );
      messageApi.success(`Calendário ${values.name} atualizado.`);
    } else {
      setItems((current) => [
        ...current,
        { ...values, id: `cal-${Date.now()}` },
      ]);
      messageApi.success(`Calendário ${values.name} criado.`);
    }

    closeModal();
  }

  function removeCalendar(calendar: CallCalendar) {
    setItems((current) => current.filter((item) => item.id !== calendar.id));
    messageApi.success(`Calendário ${calendar.name} apagado.`);
  }

  function toggleCalendar(calendar: CallCalendar, enabled: boolean) {
    setItems((current) =>
      current.map((item) =>
        item.id === calendar.id ? { ...item, enabled } : item,
      ),
    );
  }

  const columns: ColumnsType<CallCalendar> = [
    { title: 'Calendário', dataIndex: 'name', key: 'name' },
    { title: 'Horario', dataIndex: 'businessHours', key: 'businessHours' },
    {
      title: 'Destino no horário',
      dataIndex: 'businessDestination',
      key: 'businessDestination',
    },
    {
      title: 'Fora do horário',
      dataIndex: 'afterHoursDestination',
      key: 'afterHoursDestination',
    },
    {
      title: 'Feriados',
      dataIndex: 'holidays',
      key: 'holidays',
      render: (holidays: CallCalendarHoliday[]) => (
        <Space size={[4, 4]} wrap>
          {holidays.length === 0 ? (
            <Tag>Nenhum</Tag>
          ) : (
            holidays.map((holiday) => (
              <Tag key={holiday.id}>{`${holiday.date} - ${holiday.name}`}</Tag>
            ))
          )}
        </Space>
      ),
    },
    {
      title: 'Ativo',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean, calendar) => (
        <Switch
          checked={enabled}
          onChange={(checked) => toggleCalendar(calendar, checked)}
        />
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, calendar) => (
        <Space>
          <Button
            aria-label={`Editar calendário ${calendar.name}`}
            title={`Editar calendário ${calendar.name}`}
            icon={<EditOutlined />}
            onClick={() => openEdit(calendar)}
            size="small"
          />
          <Popconfirm
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
            okText="Apagar"
            onConfirm={() => removeCalendar(calendar)}
            title={`Apagar o calendário ${calendar.name}?`}
          >
            <Button
              aria-label={`Apagar calendário ${calendar.name}`}
              title={`Apagar calendário ${calendar.name}`}
              danger
              icon={<DeleteOutlined />}
              size="small"
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
          <Button icon={<PlusOutlined />} onClick={openCreate} type="primary">
            Novo calendário
          </Button>
        }
        description="Controle destinos de chamadas por horário comercial, fora de expediente, feriados e exceções."
        kicker="Roteamento por calendário"
        title="Calendário"
      />
      <Card className="soft-panel">
        <Table
          columns={columns}
          dataSource={items}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1120 }}
        />
      </Card>

      <Modal
        footer={null}
        onCancel={closeModal}
        open={modalOpen}
        title={editing ? 'Editar calendário' : 'Novo calendário'}
        width={760}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={saveCalendar}
          requiredMark={false}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Nome"
                name="name"
                rules={[{ required: true, message: 'Informe o nome.' }]}
              >
                <Input placeholder="Ex.: Horario Comercial" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Fuso horário" name="timezone">
                <Input placeholder="America/Sao_Paulo" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="Horario de atendimento"
            name="businessHours"
            rules={[{ required: true, message: 'Informe o horário.' }]}
          >
            <Input placeholder="Seg-Sex 08:00-18:00" />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="Destino no horário"
                name="businessDestination"
                rules={[{ required: true, message: 'Informe o destino.' }]}
              >
                <DestinationPicker />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="Destino fora do horário"
                name="afterHoursDestination"
                rules={[{ required: true, message: 'Informe o destino.' }]}
              >
                <DestinationPicker />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="Destino em feriados"
                name="holidayDestination"
                rules={[{ required: true, message: 'Informe o destino.' }]}
              >
                <DestinationPicker />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Ativo" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.List name="holidays">
            {(fields, { add, remove }) => (
              <Card
                size="small"
                title="Feriados e exceções"
                extra={
                  <Button onClick={() => add({ id: `holiday-${Date.now()}` })}>
                    Adicionar
                  </Button>
                }
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {fields.map((field) => (
                    <Row gutter={12} key={field.key}>
                      <Col xs={24} md={6}>
                        <Form.Item hidden name={[field.name, 'id']}>
                          <Input />
                        </Form.Item>
                        <Form.Item
                          label="Data"
                          name={[field.name, 'date']}
                          rules={[{ required: true, message: 'Informe a data.' }]}
                        >
                          <Input placeholder="2026-12-25" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={7}>
                        <Form.Item
                          label="Nome"
                          name={[field.name, 'name']}
                          rules={[{ required: true, message: 'Informe o nome.' }]}
                        >
                          <Input placeholder="Natal" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item
                          label="Destino"
                          name={[field.name, 'destination']}
                          rules={[{ required: true, message: 'Informe o destino.' }]}
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
              Salvar
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}


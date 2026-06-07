import {
  DownOutlined,
  DownloadOutlined,
  PauseOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Dropdown,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import { downloadCsv, downloadJson } from '../services/exportUtils';

type Recording = {
  id: string;
  startedAt: string;
  caller: string;
  callee: string;
  agent: string;
  queue: string;
  duration: string;
  size: string;
  direction: 'Entrada' | 'Saída';
};

const recordings: Recording[] = [
  {
    id: 'rec-1',
    startedAt: '06/06/2026 09:14',
    caller: '+55 11 98888-1212',
    callee: '1001',
    agent: 'Ana Pereira',
    queue: 'Comercial',
    duration: '00:03:42',
    size: '3,8 MB',
    direction: 'Entrada',
  },
  {
    id: 'rec-2',
    startedAt: '06/06/2026 09:27',
    caller: '1002',
    callee: '+55 21 4004-9090',
    agent: 'Bruno Martins',
    queue: 'Suporte',
    duration: '00:01:18',
    size: '1,5 MB',
    direction: 'Saída',
  },
  {
    id: 'rec-3',
    startedAt: '06/06/2026 10:05',
    caller: '+55 31 97777-2323',
    callee: '1002',
    agent: 'Bruno Martins',
    queue: 'Suporte',
    duration: '00:07:11',
    size: '7,2 MB',
    direction: 'Entrada',
  },
];

export default function Recordings() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const exportRows = recordings.map((recording) => ({
    Início: recording.startedAt,
    Origem: recording.caller,
    Destino: recording.callee,
    Agente: recording.agent,
    Fila: recording.queue,
    Direção: recording.direction,
    Duração: recording.duration,
    Tamanho: recording.size,
    Arquivo: `${recording.id}.wav`,
  }));

  function exportRecordings(format: 'csv' | 'json') {
    if (format === 'csv') {
      downloadCsv('gravações-2026-06-06.csv', exportRows);
    } else {
      downloadJson('gravações-2026-06-06.json', exportRows);
    }

    messageApi.success(`Gravações exportadas em ${format.toUpperCase()}.`);
  }

  const columns: ColumnsType<Recording> = [
    {
      title: 'Ouvir',
      key: 'play',
      width: 76,
      render: (_, recording) => (
        <Button
          aria-label={
            playingId === recording.id ? 'Pausar gravação' : 'Ouvir gravação'
          }
          title={
            playingId === recording.id ? 'Pausar gravação' : 'Ouvir gravação'
          }
          icon={
            playingId === recording.id ? (
              <PauseOutlined />
            ) : (
              <PlayCircleOutlined />
            )
          }
          onClick={() =>
            setPlayingId((current) =>
              current === recording.id ? null : recording.id,
            )
          }
          type="text"
        />
      ),
    },
    { title: 'Início', dataIndex: 'startedAt', key: 'startedAt' },
    { title: 'Origem', dataIndex: 'caller', key: 'caller' },
    { title: 'Destino', dataIndex: 'callee', key: 'callee' },
    { title: 'Agente', dataIndex: 'agent', key: 'agent' },
    { title: 'Fila', dataIndex: 'queue', key: 'queue' },
    {
      title: 'Direção',
      dataIndex: 'direction',
      key: 'direction',
      render: (direction: Recording['direction']) => (
        <Tag color={direction === 'Entrada' ? 'blue' : 'green'}>
          {direction}
        </Tag>
      ),
    },
    { title: 'Duração', dataIndex: 'duration', key: 'duration' },
    { title: 'Tamanho', dataIndex: 'size', key: 'size' },
    {
      title: '',
      key: 'download',
      render: (_, recording) => (
        <Button
          aria-label="Baixar gravação"
          title="Baixar gravação"
          icon={<DownloadOutlined />}
          onClick={() =>
            messageApi.info(`Download mockado: ${recording.id}.wav`)
          }
          type="text"
        />
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <PageHeader
        actions={
          <Dropdown
            menu={{
              items: [
                { key: 'csv', label: 'Manifesto CSV' },
                { key: 'json', label: 'Manifesto JSON' },
              ],
              onClick: ({ key }) => exportRecordings(key as 'csv' | 'json'),
            }}
          >
            <Button icon={<DownloadOutlined />}>
              Exportar gravações <DownOutlined />
            </Button>
          </Dropdown>
        }
        kicker="Auditoria de chamadas"
        title="Gravações"
        description="Consulte, ouça e baixe gravações conforme as permissões do seu perfil."
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card className="soft-panel">
            <Statistic title="Gravações hoje" value={recordings.length} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="soft-panel">
            <Statistic title="Tempo gravado" value="12m11s" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="soft-panel">
            <Statistic title="Armazenamento" value="12,5 MB" />
          </Card>
        </Col>
      </Row>
      <Card className="soft-panel" style={{ marginTop: 16 }}>
        <Space wrap style={{ marginBottom: 16 }}>
          <DatePicker.RangePicker />
          <Select
            defaultValue="todas"
            options={[
              { label: 'Todas as filas', value: 'todas' },
              { label: 'Comercial', value: 'comercial' },
              { label: 'Suporte', value: 'suporte' },
            ]}
            style={{ width: 180 }}
          />
          <Input.Search
            placeholder="Origem, destino ou agente"
            style={{ width: 260 }}
          />
        </Space>
        <Table
          columns={columns}
          dataSource={recordings}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1050 }}
        />
      </Card>
    </>
  );
}


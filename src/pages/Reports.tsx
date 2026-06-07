import { DownloadOutlined, FilterOutlined } from '@ant-design/icons';
import { Button, Card, Col, DatePicker, Row, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ApexOptions } from 'apexcharts';
import ReactApexChart from 'react-apexcharts';
import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import { downloadCsv } from '../services/exportUtils';
import { CallRecord, callRecords, dashboardSeries } from '../services/mockData';

type ReportType = 'cdr' | 'direction' | 'hourly';

const reportTypeOptions = [
  { label: 'CDR detalhado', value: 'cdr' },
  { label: 'Resumo por direção', value: 'direction' },
  { label: 'Volume por hora', value: 'hourly' },
];

const columns: ColumnsType<CallRecord> = [
  { title: 'Início', dataIndex: 'startedAt', key: 'startedAt' },
  { title: 'Origem', dataIndex: 'caller', key: 'caller' },
  { title: 'Destino', dataIndex: 'callee', key: 'callee' },
  { title: 'Direção', dataIndex: 'direction', key: 'direction' },
  { title: 'Duração', dataIndex: 'duration', key: 'duration' },
  {
    title: 'Resultado',
    dataIndex: 'disposition',
    key: 'disposition',
    render: (value: CallRecord['disposition']) => (
      <Tag
        color={
          value === 'Atendida'
            ? 'success'
            : value === 'Perdida'
              ? 'error'
              : 'warning'
        }
      >
        {value}
      </Tag>
    ),
  },
];

const options: ApexOptions = {
  chart: {
    toolbar: { show: false },
  },
  colors: ['#0f766e', '#2563eb', '#d97706'],
  dataLabels: { enabled: false },
  labels: ['Entrada', 'Saída', 'Interna'],
  legend: {
    position: 'bottom',
  },
};

export default function Reports() {
  const [reportType, setReportType] = useState<ReportType>('cdr');

  function exportReport() {
    if (reportType === 'direction') {
      downloadCsv('relatorio-por-direção.csv', [
        { Direção: 'Entrada', Chamadas: 44, Percentual: '44%' },
        { Direção: 'Saída', Chamadas: 31, Percentual: '31%' },
        { Direção: 'Interna', Chamadas: 25, Percentual: '25%' },
      ]);
      return;
    }

    if (reportType === 'hourly') {
      downloadCsv(
        'relatorio-volume-por-hora.csv',
        dashboardSeries.callsByHour.map((item) => ({
          Hora: item.hour,
          Atendidas: item.answered,
          Perdidas: item.missed,
          Total: item.answered + item.missed,
        })),
      );
      return;
    }

    downloadCsv(
      'relatorio-cdr-detalhado.csv',
      callRecords.map((record) => ({
        Início: record.startedAt,
        Origem: record.caller,
        Destino: record.callee,
        Direção: record.direction,
        Duração: record.duration,
        Resultado: record.disposition,
      })),
    );
  }

  return (
    <>
      <PageHeader
        actions={
          <>
            <Button icon={<FilterOutlined />}>Aplicar filtros</Button>
            <Button icon={<DownloadOutlined />} onClick={exportReport} type="primary">
              Exportar relatorio
            </Button>
          </>
        }
        kicker="CDR e indicadores"
        title="CDR / Relatórios"
        description="Analise chamadas por período, direção, resultado, duração e origem para auditoria operacional."
      />

      <Card className="soft-panel" style={{ marginBottom: 16 }}>
        <Space wrap>
          <DatePicker.RangePicker />
          <Select
            onChange={(value) => setReportType(value as ReportType)}
            options={reportTypeOptions}
            style={{ width: 210 }}
            value={reportType}
          />
          <Select
            defaultValue="todos"
            options={[
              { label: 'Todas as direções', value: 'todos' },
              { label: 'Entrada', value: 'entrada' },
              { label: 'Saída', value: 'saída' },
              { label: 'Interna', value: 'interna' },
            ]}
            style={{ width: 190 }}
          />
          <Select
            defaultValue="todos"
            options={[
              { label: 'Todos os resultados', value: 'todos' },
              { label: 'Atendida', value: 'atendida' },
              { label: 'Perdida', value: 'perdida' },
              { label: 'Falhou', value: 'falhou' },
            ]}
            style={{ width: 210 }}
          />
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card className="soft-panel" title="Distribuição">
            <ReactApexChart
              height={280}
              options={options}
              series={[44, 31, 25]}
              type="donut"
            />
          </Card>
        </Col>
        <Col xs={24} xl={16}>
          <Card className="soft-panel" title="Volume por hora">
            <ReactApexChart
              height={280}
              options={{
                chart: { toolbar: { show: false } },
                colors: ['#0f766e'],
                dataLabels: { enabled: false },
                plotOptions: {
                  bar: {
                    borderRadius: 4,
                    columnWidth: '46%',
                  },
                },
                xaxis: {
                  categories: dashboardSeries.callsByHour.map((item) => item.hour),
                },
              }}
              series={[
                {
                  name: 'Chamadas',
                  data: dashboardSeries.callsByHour.map(
                    (item) => item.answered + item.missed,
                  ),
                },
              ]}
              type="bar"
            />
          </Card>
        </Col>
      </Row>

      <Card className="soft-panel" style={{ marginTop: 16 }} title="Registros CDR">
        <Table columns={columns} dataSource={callRecords} pagination={false} rowKey="id" />
      </Card>
    </>
  );
}


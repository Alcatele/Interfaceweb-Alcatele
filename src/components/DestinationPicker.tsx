import { SearchOutlined } from '@ant-design/icons';
import {
  Button,
  Input,
  List,
  Modal,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useMemo, useState } from 'react';
import {
  callCalendars,
  extensions,
  ivrMenus,
  queues,
  ringGroups,
} from '../services/mockData';

type DestinationOption = {
  type: string;
  label: string;
  value: string;
  description: string;
};

type DestinationPickerProps = {
  onChange?: (value: string) => void;
  placeholder?: string;
  value?: string;
};

const destinationOptions: DestinationOption[] = [
  ...extensions.map((extension) => ({
    type: 'Ramal',
    label: `${extension.number} - ${extension.name}`,
    value: `Ramal ${extension.number}`,
    description: extension.department,
  })),
  ...queues.map((queue) => ({
    type: 'Fila',
    label: `${queue.number} - ${queue.name}`,
    value: `Fila ${queue.name}`,
    description: `${queue.strategy} | transbordo para ${queue.overflowDestination}`,
  })),
  ...ivrMenus.map((ivr) => ({
    type: 'URA',
    label: ivr.name,
    value: `URA ${ivr.name}`,
    description: `${ivr.options.length} opcoes | timeout ${ivr.timeout}s`,
  })),
  ...ringGroups.map((group) => ({
    type: 'Grupo de toque',
    label: `${group.number} - ${group.name}`,
    value: `Grupo de toque ${group.number}`,
    description: `${group.members.length} ramais | ${group.timeout}s`,
  })),
  ...extensions.map((extension) => ({
    type: 'Correio de voz',
    label: `${extension.number} - ${extension.name}`,
    value: `Correio de voz ${extension.number}`,
    description: `Caixa postal do ramal ${extension.number}`,
  })),
  ...callCalendars.map((calendar) => ({
    type: 'Calendário',
    label: calendar.name,
    value: `Calendário ${calendar.name}`,
    description: `${calendar.businessHours} | ${calendar.businessDestination}`,
  })),
];

export default function DestinationPicker({
  onChange,
  placeholder = 'Selecione um destino',
  value,
}: DestinationPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filteredOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return destinationOptions;
    }

    return destinationOptions.filter((option) =>
      [option.type, option.label, option.value, option.description]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [search]);

  function selectDestination(destination: string) {
    onChange?.(destination);
    setOpen(false);
    setSearch('');
  }

  return (
    <>
      <Space.Compact style={{ width: '100%' }}>
        <Input readOnly placeholder={placeholder} value={value} />
        <Button icon={<SearchOutlined />} onClick={() => setOpen(true)}>
          Escolher
        </Button>
      </Space.Compact>
      <Modal
        footer={null}
        onCancel={() => setOpen(false)}
        open={open}
        title="Selecionar destino"
        width={720}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input.Search
            allowClear
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por ramal, fila, URA, grupo, calendário ou correio de voz"
            value={search}
          />
          <List
            dataSource={filteredOptions}
            pagination={{ pageSize: 8 }}
            renderItem={(option) => (
              <List.Item
                actions={[
                  <Button
                    key="select"
                    onClick={() => selectDestination(option.value)}
                    type="primary"
                  >
                    Usar
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  description={option.description}
                  title={
                    <Space size={8}>
                      <Tag color="blue">{option.type}</Tag>
                      <Typography.Text>{option.label}</Typography.Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Space>
      </Modal>
    </>
  );
}

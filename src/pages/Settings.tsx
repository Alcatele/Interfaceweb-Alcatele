import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { Card, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import UserManagementPanel from '../components/UserManagementPanel';
import { mvpApi, type PermissionProfile } from '../services/mvpApi';

export default function Settings() {
  const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();

  const loadPermissions = useCallback(async () => {
    setLoading(true);
    try {
      setProfiles(await mvpApi.permissions());
    } catch {
      messageApi.error('Não foi possível carregar as permissões.');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void loadPermissions();
  }, [loadPermissions]);

  const permissionCodes = Array.from(
    new Set(profiles.flatMap((profile) => profile.permissions)),
  ).sort();

  return (
    <>
      {contextHolder}
      <PageHeader
        kicker="MVP"
        title="Usuários e permissões"
        description="Gestão de acessos do tenant ativo e matriz RBAC aplicada pela API."
      />
      <Card className="soft-panel">
        <Tabs
          items={[
            {
              key: 'users',
              label: 'Usuários',
              children: <UserManagementPanel />,
            },
            {
              key: 'permissions',
              label: 'Permissões',
              children: (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <Table
                    columns={[
                      {
                        title: 'Perfil',
                        key: 'profile',
                        render: (_, profile: PermissionProfile) => (
                          <Space direction="vertical" size={0}>
                            <Typography.Text strong>
                              {profile.name}
                            </Typography.Text>
                            <Typography.Text type="secondary">
                              {profile.description}
                            </Typography.Text>
                          </Space>
                        ),
                      },
                      ...permissionCodes.map((permission) => ({
                        align: 'center' as const,
                        key: permission,
                        title: permission,
                        render: (_: unknown, profile: PermissionProfile) =>
                          profile.permissions.includes(permission) ? (
                            <Tag
                              color="success"
                              icon={<CheckCircleOutlined />}
                            >
                              Sim
                            </Tag>
                          ) : (
                            <Tag icon={<CloseCircleOutlined />}>Não</Tag>
                          ),
                      })),
                    ]}
                    dataSource={profiles}
                    loading={loading}
                    pagination={false}
                    rowKey="role"
                    scroll={{ x: 1100 }}
                    size="small"
                  />
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}

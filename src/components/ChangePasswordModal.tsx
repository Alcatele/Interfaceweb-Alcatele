import { Form, Input, Modal, Space, Button, message } from 'antd';
import { useState } from 'react';
import { changeMockUserPassword } from '../services/mockUsers';

type ChangePasswordModalProps = {
  open: boolean;
  userId: string;
  onClose: () => void;
};

type ChangePasswordValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const strongPasswordRules = [
  { required: true, message: 'Informe a nova senha.' },
  { min: 8, message: 'A senha precisa ter pelo menos 8 caracteres.' },
  {
    pattern: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/,
    message: 'Inclua letras, números e pelo menos um simbolo.',
  },
];

export default function ChangePasswordModal({
  open,
  userId,
  onClose,
}: ChangePasswordModalProps) {
  const [form] = Form.useForm<ChangePasswordValues>();
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  function closeModal() {
    form.resetFields();
    onClose();
  }

  async function handleSubmit(values: ChangePasswordValues) {
    setSaving(true);
    const result = await changeMockUserPassword(
      userId,
      values.currentPassword,
      values.newPassword,
    );
    setSaving(false);

    if (!result.success) {
      messageApi.error(result.error);
      return;
    }

    messageApi.success('Senha alterada com sucesso.');
    closeModal();
  }

  return (
    <>
      {contextHolder}
      <Modal
        forceRender
        footer={null}
        onCancel={closeModal}
        open={open}
        title="Alterar minha senha"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
        >
          <Form.Item
            label="Senha atual"
            name="currentPassword"
            rules={[{ required: true, message: 'Informe sua senha atual.' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            extra="Use ao menos 8 caracteres, com letras, números e simbolos."
            label="Nova senha"
            name="newPassword"
            rules={strongPasswordRules}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            dependencies={['newPassword']}
            label="Confirmar nova senha"
            name="confirmPassword"
            rules={[
              { required: true, message: 'Confirme a nova senha.' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }

                  return Promise.reject(new Error('As senhas não coincidem.'));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={closeModal}>Cancelar</Button>
            <Button htmlType="submit" loading={saving} type="primary">
              Alterar senha
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}


import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';

export default function AccessDenied() {
  const navigate = useNavigate();
  const { roleLabel } = useAuth();

  return (
    <Result
      extra={
        <Button onClick={() => navigate('/')} type="primary">
          Voltar ao dashboard
        </Button>
      }
      status="403"
      subTitle={`O perfil ${roleLabel} não possui permissão para acessar esta área.`}
      title="Acesso restrito"
    />
  );
}


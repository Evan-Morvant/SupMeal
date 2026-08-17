import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { errorMessage } from '../../api/errors';
import { useAuth } from '../../auth/auth-context';
import { Button } from '../../ui/Button';
import { Field, Input } from '../../ui/Field';
import { Alert } from '../../ui/Feedback';
import { AuthPanel, authStyles as styles } from './AuthPanel';

const schema = z.object({
  email: z.string().min(1, 'Renseignez votre adresse e-mail').email('Adresse e-mail invalide'),
  password: z.string().min(1, 'Renseignez votre mot de passe'),
});

type LoginForm = z.infer<typeof schema>;

/** Adresse demandee avant la redirection vers la connexion, s'il y en avait une. */
interface FromState {
  from?: string;
}

export function LoginPage(): JSX.Element {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [failure, setFailure] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await login(values);
      const from = (location.state as FromState | null)?.from;
      navigate(from ?? '/recipes', { replace: true });
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  return (
    <AuthPanel
      title="Content de vous revoir"
      subtitle="Retrouvez vos recettes, vos cookbooks et votre planning."
      providerVerb="Se connecter"
      swap={
        <>
          Pas encore de compte ? <Link to="/register">Créer un compte</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {failure !== null && <Alert>{failure}</Alert>}

        <Field label="Adresse e-mail" error={errors.email?.message}>
          {(field) => (
            <Input
              {...field}
              {...register('email')}
              type="email"
              autoComplete="email"
              placeholder="vous@exemple.fr"
              invalid={errors.email !== undefined}
            />
          )}
        </Field>

        <Field label="Mot de passe" error={errors.password?.message}>
          {(field) => (
            <Input
              {...field}
              {...register('password')}
              type="password"
              autoComplete="current-password"
              invalid={errors.password !== undefined}
            />
          )}
        </Field>

        <Button type="submit" block loading={isSubmitting}>
          Se connecter
        </Button>
      </form>
    </AuthPanel>
  );
}

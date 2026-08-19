import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { errorMessage } from '../../api/errors';
import { useAuth } from '../../auth/auth-context';
import { PASSWORD_RULE, passwordSchema } from '../../lib/password';
import { Button } from '../../ui/Button';
import { Field, Input } from '../../ui/Field';
import { Alert } from '../../ui/Feedback';
import { AuthPanel, authStyles as styles } from './AuthPanel';

/* Règles reprises du serveur : le formulaire répond tout de suite, l'API
 * reste l'autorité. */
const schema = z.object({
  displayName: z.string().trim().min(1, 'Renseignez le nom qui sera affiché').max(255),
  email: z.string().min(1, 'Renseignez votre adresse e-mail').email('Adresse e-mail invalide'),
  password: passwordSchema,
});

type RegisterForm = z.infer<typeof schema>;

export function RegisterPage(): JSX.Element {
  const { register: createAccount } = useAuth();
  const navigate = useNavigate();
  const [failure, setFailure] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await createAccount(values);
      navigate('/recipes', { replace: true });
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  return (
    <AuthPanel
      title="Créer un compte"
      subtitle="Rassemblez vos recettes, partagez-les et planifiez vos repas."
      providerVerb="S'inscrire"
      swap={
        <>
          Vous avez déjà un compte ? <Link to="/login">Se connecter</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {failure !== null && <Alert>{failure}</Alert>}

        <Field label="Nom affiché" error={errors.displayName?.message}>
          {(field) => (
            <Input
              {...field}
              {...register('displayName')}
              autoComplete="name"
              placeholder="Marie Dupont"
              invalid={errors.displayName !== undefined}
            />
          )}
        </Field>

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

        <Field label="Mot de passe" hint={PASSWORD_RULE} error={errors.password?.message}>
          {(field) => (
            <Input
              {...field}
              {...register('password')}
              type="password"
              autoComplete="new-password"
              invalid={errors.password !== undefined}
            />
          )}
        </Field>

        <Button type="submit" block loading={isSubmitting}>
          Créer mon compte
        </Button>

        <p className={styles.terms}>
          En créant un compte, vous acceptez les{' '}
          <Link to="/cgu">conditions générales d'utilisation</Link>.
        </p>
      </form>
    </AuthPanel>
  );
}

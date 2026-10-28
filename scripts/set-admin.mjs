
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const email = process.argv[2]?.trim().toLowerCase();
const revoke = process.argv.includes('--revoke');

if (!email || email.startsWith('--')) {
  console.error(
    'Uso: npm run set-admin -- email@exemplo.com [--revoke]',
  );
  process.exit(1);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    'Defina GOOGLE_APPLICATION_CREDENTIALS com o caminho da chave privada do Firebase.',
  );
  process.exit(1);
}

initializeApp({
  credential: applicationDefault(),
  projectId: process.env.GCLOUD_PROJECT,
});

try {
  const auth = getAuth();
  const user = await auth.getUserByEmail(email);

  await auth.setCustomUserClaims(user.uid, {
    ...(user.customClaims ?? {}),
    admin: !revoke,
  });

  console.log(
    revoke
      ? `Permissão de administrador removida de ${email}.`
      : `Permissão de administrador concedida a ${email}.`,
  );

  console.log('A pessoa deve sair e entrar novamente no site.');
} catch (error) {
  console.error('Não foi possível atualizar a permissão:', error.message);
  process.exitCode = 1;
}

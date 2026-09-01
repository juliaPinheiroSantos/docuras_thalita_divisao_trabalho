import { CheckCircle2, KeyRound, ShieldCheck } from 'lucide-react';

import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { setupOwnerPasswordAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getOrCreateMembership, listAccessCredentials } from '@/db/store';
import { OWNER_PHONES } from '@/lib/access';

export const dynamic = 'force-dynamic';

type SetupProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SetupOwnerAccess({ searchParams }: SetupProps) {
  const user = await requireChatGPTUser('/configurar-acesso');
  const owner = await getOrCreateMembership(user);
  if (owner?.role !== 'owner') return <SetupDenied />;

  const params = (await searchParams) ?? {};
  const notice = singleValue(params.aviso);
  const credentials = (await listAccessCredentials()).filter((credential) => credential.userId === owner.id);
  const configuredCount = credentials.filter((credential) => credential.passwordConfigured).length;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:py-12">
      <section className="mx-auto w-full max-w-xl rounded-3xl border border-brand/10 bg-white p-6 shadow-[0_24px_70px_rgb(90_45_45/9%)] sm:p-9">
        <div className="text-center">
          <img src="/logo-docuras-da-thalita.svg" alt="Doçuras da Thalita" className="mx-auto h-24 w-28 object-contain" />
          <span className="mx-auto mt-3 grid size-12 place-items-center rounded-2xl bg-blush/20 text-brand"><ShieldCheck className="size-6" /></span>
          <h1 className="mt-5 font-heading text-2xl font-semibold">Configurar acessos do proprietário</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Defina uma senha para cada número autorizado. As senhas podem ser diferentes.
          </p>
        </div>

        {notice === 'senha-atualizada' ? (
          <output className="mt-5 flex items-center gap-2 rounded-xl border border-[#b8d6c3] bg-[#eef7f1] px-4 py-3 text-sm text-[#467158]">
            <CheckCircle2 className="size-4" /> Senha salva com segurança.
          </output>
        ) : notice === 'dados-invalidos' ? (
          <output className="mt-5 block rounded-xl border border-brand/15 bg-blush/15 px-4 py-3 text-sm text-brand">
            Use uma senha com pelo menos 6 caracteres.
          </output>
        ) : notice === 'erro-senha' ? (
          <output className="mt-5 block rounded-xl border border-brand/15 bg-blush/15 px-4 py-3 text-sm text-brand">
            Não foi possível salvar a senha. Tente novamente em alguns instantes.
          </output>
        ) : null}

        <div className="mt-6 space-y-3">
          {OWNER_PHONES.map((phone) => {
            const credential = credentials.find((item) => item.phone === phone);
            return (
              <form key={phone} action={setupOwnerPasswordAction} className="rounded-xl border border-brand/10 p-4">
                <input type="hidden" name="phone" value={phone} />
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="font-medium">{formatPhone(phone)}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${credential?.passwordConfigured ? 'bg-[#e8f3ec] text-[#467158]' : 'bg-blush/20 text-brand'}`}>
                    {credential?.passwordConfigured ? 'Senha definida' : 'Falta definir'}
                  </span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <span className="relative flex-1">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input name="password" type="password" autoComplete="new-password" required minLength={6} maxLength={128} placeholder="Nova senha" aria-label={`Senha de ${formatPhone(phone)}`} className="h-11 pl-10" />
                  </span>
                  <Button type="submit" className="h-11 sm:w-28">{credential?.passwordConfigured ? 'Alterar' : 'Definir'}</Button>
                </div>
              </form>
            );
          })}
        </div>

        <div className="mt-6 rounded-xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">
          {configuredCount === 3
            ? 'Os três acessos estão prontos. Agora você pode entrar no painel usando qualquer número e sua respectiva senha.'
            : `${configuredCount} de 3 acessos configurados. Defina pelo menos uma senha para conseguir entrar no painel.`}
        </div>
        <Button variant="outline" className="mt-4 w-full" render={<a href="/" />}>Ir para o login do painel</Button>
      </section>
    </main>
  );
}

function SetupDenied() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-5">
      <section className="max-w-md rounded-3xl border border-brand/10 bg-white p-8 text-center">
        <h1 className="font-heading text-2xl font-semibold">Acesso não autorizado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Somente o proprietário atual pode configurar estas senhas.</p>
      </section>
    </main>
  );
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatPhone(phone: string) {
  return phone.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
}

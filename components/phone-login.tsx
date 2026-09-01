import { KeyRound, LockKeyhole, Phone } from 'lucide-react';

import { phoneLoginAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function PhoneLogin({ notice, showOwnerSetup }: { notice?: string; showOwnerSetup: boolean }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-5">
      <section className="w-full max-w-md rounded-3xl border border-brand/10 bg-white p-7 shadow-[0_24px_70px_rgb(90_45_45/9%)] sm:p-9">
        <div className="text-center">
          <img src="/logo-docuras-da-thalita.svg" alt="Doçuras da Thalita" className="mx-auto h-28 w-32 object-contain" />
          <span className="mx-auto mt-3 grid size-12 place-items-center rounded-2xl bg-blush/20 text-brand">
            <LockKeyhole className="size-6" />
          </span>
          <h1 className="mt-5 font-heading text-3xl font-semibold">Acesso da equipe</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Digite o celular cadastrado e a sua senha para ver a lista de tarefas.
          </p>
        </div>

        {notice === 'login-invalido' ? (
          <output className="mt-5 block rounded-xl border border-brand/15 bg-blush/15 px-4 py-3 text-base text-brand">
            Celular ou senha incorretos. Confira os dados ou fale com o proprietário.
          </output>
        ) : notice === 'sessao-encerrada' ? (
          <output className="mt-5 block rounded-xl border border-[#b8d6c3] bg-[#eef7f1] px-4 py-3 text-base text-[#467158]">
            Você saiu da sua conta.
          </output>
        ) : null}

        <form action={phoneLoginAction} className="mt-6 space-y-4">
          <label className="grid gap-2 text-base font-medium" htmlFor="login-phone">
            Número de celular
            <span className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="login-phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                required
                minLength={10}
                maxLength={19}
                placeholder="(00) 00000-0000"
                className="h-12 pl-10 text-base"
              />
            </span>
          </label>
          <label className="grid gap-2 text-base font-medium" htmlFor="login-password">
            Senha
            <span className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                maxLength={128}
                placeholder="Digite sua senha"
                className="h-12 pl-10 text-base"
              />
            </span>
          </label>
          <Button type="submit" size="lg" className="h-12 w-full rounded-xl">Entrar</Button>
        </form>
        <p className="mt-5 text-center text-sm leading-6 text-muted-foreground">
          Este acesso é exclusivo para a equipe da Doçuras da Thalita.
        </p>
        {showOwnerSetup ? (
          <a href="/configurar-acesso" className="mt-3 block text-center text-sm font-medium text-brand hover:underline">
            Configurar senhas do proprietário
          </a>
        ) : null}
      </section>
    </main>
  );
}

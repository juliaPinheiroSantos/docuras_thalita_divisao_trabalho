import { LockKeyhole, Phone } from 'lucide-react';

import { phoneLoginAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function PhoneLogin({ notice }: { notice?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-5">
      <section className="w-full max-w-md rounded-3xl border border-brand/10 bg-white p-7 shadow-[0_24px_70px_rgb(90_45_45/9%)] sm:p-9">
        <div className="text-center">
          <img src="/logo-docuras-da-thalita.svg" alt="Doçuras da Thalita" className="mx-auto h-28 w-32 object-contain" />
          <span className="mx-auto mt-3 grid size-12 place-items-center rounded-2xl bg-blush/20 text-brand">
            <LockKeyhole className="size-6" />
          </span>
          <h1 className="mt-5 font-heading text-2xl font-semibold">Acesso da equipe</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Digite o celular cadastrado pelo proprietário para ver sua lista de tarefas.
          </p>
        </div>

        {notice === 'telefone-nao-encontrado' ? (
          <output className="mt-5 block rounded-xl border border-brand/15 bg-blush/15 px-4 py-3 text-sm text-brand">
            Número não encontrado. Confira o celular informado ou fale com o proprietário.
          </output>
        ) : notice === 'sessao-encerrada' ? (
          <output className="mt-5 block rounded-xl border border-[#b8d6c3] bg-[#eef7f1] px-4 py-3 text-sm text-[#467158]">
            Você saiu da sua conta.
          </output>
        ) : null}

        <form action={phoneLoginAction} className="mt-6 space-y-4">
          <label className="grid gap-2 text-sm font-medium">
            Número de celular
            <span className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
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
          <Button type="submit" size="lg" className="h-12 w-full rounded-xl">Entrar</Button>
        </form>
        <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
          Este acesso é exclusivo para a equipe da Doçuras da Thalita.
        </p>
      </section>
    </main>
  );
}

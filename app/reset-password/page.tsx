/* eslint-disable @next/next/no-img-element */
import LoginPanel from "../login/LoginPanel";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-dvh bg-[#faf8f5] px-4 py-6 text-[#1a1815] sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-4xl flex-col justify-center gap-5">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center bg-[#ecf4ed]">
            <img src="/strik-logo.png" alt="" className="h-11 w-11 object-contain" />
          </span>
          <div>
            <p className="text-xs font-black uppercase text-[#ef5737]">
              Strik Team App
            </p>
            <h1 className="text-3xl font-black leading-none tracking-[0.14em] text-[#ef5737] sm:text-4xl">
              WACHTWOORD RESETTEN
            </h1>
          </div>
        </div>
        <LoginPanel next="/" initialMode="reset" />
      </div>
    </main>
  );
}

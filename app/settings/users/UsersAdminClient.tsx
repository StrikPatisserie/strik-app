"use client";

import { useActionState } from "react";
import {
  createUserAction,
  inviteUserAction,
  sendUserPasswordResetAction,
  setUserActiveAction,
  updateUserProfileAction,
  type UserAdminActionState,
} from "./actions";
import {
  PERMISSION_OPTIONS,
  USER_ROLES,
  USER_STORES,
  type UserProfile,
} from "../../lib/supabase/types";

const initialState: UserAdminActionState = {};

function Message({ state }: Readonly<{ state: UserAdminActionState }>) {
  if (!state.message) return null;

  return (
    <p
      className={`border px-3 py-2 text-sm font-bold ${
        state.ok
          ? "border-[#c8dbc2] bg-[#f3faf0] text-[#275d35]"
          : "border-[#f1b8a8] bg-[#fff4ef] text-[#bf3d26]"
      }`}
    >
      {state.message}
    </p>
  );
}

function Field({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.68rem] font-black uppercase text-[#7b7268]">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "h-10 w-full rounded-md border border-[#ded8cf] bg-[#faf8f5] px-3 text-sm font-bold outline-none focus:border-[#1f4f35]";

function RoleSelect({ defaultValue }: Readonly<{ defaultValue?: string }>) {
  return (
    <select name="role" defaultValue={defaultValue || "medewerker"} className={inputClass}>
      {USER_ROLES.map((role) => (
        <option key={role.id} value={role.id}>
          {role.label}
        </option>
      ))}
    </select>
  );
}

function StoreSelect({ defaultValue }: Readonly<{ defaultValue?: string | null }>) {
  return (
    <select name="store" defaultValue={defaultValue || ""} className={inputClass}>
      {USER_STORES.map((store) => (
        <option key={store.id || "all"} value={store.id}>
          {store.label}
        </option>
      ))}
    </select>
  );
}

function PermissionGrid({
  permissions,
}: Readonly<{ permissions?: Record<string, boolean> }>) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {PERMISSION_OPTIONS.map((permission) => (
        <label
          key={permission.id}
          className="flex items-center gap-2 rounded-md border border-[#ebe5dc] bg-white px-2 py-1.5 text-xs font-bold text-[#4f4942]"
        >
          <input
            type="checkbox"
            name="permissions"
            value={permission.id}
            defaultChecked={Boolean(permissions?.[permission.id])}
            className="h-4 w-4 accent-[#1f4f35]"
          />
          {permission.label}
        </label>
      ))}
    </div>
  );
}

function UserFields({ profile }: Readonly<{ profile?: UserProfile }>) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Naam">
          <input
            name="full_name"
            defaultValue={profile?.full_name || ""}
            className={inputClass}
          />
        </Field>
        <Field label="E-mail">
          <input
            name="email"
            type="email"
            defaultValue={profile?.email || ""}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Rol">
          <RoleSelect defaultValue={profile?.role} />
        </Field>
        <Field label="Winkel">
          <StoreSelect defaultValue={profile?.store} />
        </Field>
        <Field label="Avatar URL">
          <input
            name="avatar_url"
            defaultValue={profile?.avatar_url || ""}
            className={inputClass}
          />
        </Field>
        <label className="flex h-10 items-center gap-2 self-end rounded-md border border-[#ded8cf] bg-white px-3 text-sm font-black text-[#4f4942]">
          <input
            name="active"
            type="checkbox"
            defaultChecked={profile?.active ?? true}
            className="h-4 w-4 accent-[#1f4f35]"
          />
          Actief
        </label>
      </div>
      <div>
        <p className="mb-1 text-[0.68rem] font-black uppercase text-[#7b7268]">
          Rechten
        </p>
        <PermissionGrid permissions={profile?.permissions} />
      </div>
    </>
  );
}

function CreateUserForm() {
  const [state, formAction, pending] = useActionState(
    createUserAction,
    initialState
  );

  return (
    <section className="border border-[#e4ded5] bg-white/92 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">Gebruiker aanmaken</h2>
        <span className="bg-[#ecf4ed] px-2 py-1 text-xs font-black text-[#1f4f35]">
          Email + wachtwoord
        </span>
      </div>
      <form action={formAction} className="space-y-3">
        <Message state={state} />
        <UserFields />
        <Field label="Tijdelijk wachtwoord">
          <input
            name="password"
            type="password"
            minLength={8}
            required
            className={inputClass}
          />
        </Field>
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-md bg-[#1f4f35] px-4 text-sm font-black text-white disabled:opacity-60"
        >
          {pending ? "Aanmaken..." : "Aanmaken"}
        </button>
      </form>
    </section>
  );
}

function InviteUserForm() {
  const [state, formAction, pending] = useActionState(
    inviteUserAction,
    initialState
  );

  return (
    <section className="border border-[#e4ded5] bg-white/92 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">Uitnodigen</h2>
        <span className="bg-[#fff3d7] px-2 py-1 text-xs font-black text-[#805f16]">
          Invite mail
        </span>
      </div>
      <form action={formAction} className="space-y-3">
        <Message state={state} />
        <UserFields />
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-md bg-[#ef5737] px-4 text-sm font-black text-white disabled:opacity-60"
        >
          {pending ? "Versturen..." : "Uitnodiging versturen"}
        </button>
      </form>
    </section>
  );
}

function UserRow({ profile }: Readonly<{ profile: UserProfile }>) {
  const activeAction = setUserActiveAction.bind(null, profile.id, !profile.active);
  const updateAction = updateUserProfileAction.bind(null, profile.id);

  return (
    <details className="group border border-[#e4ded5] bg-white/92 shadow-sm">
      <summary className="grid cursor-pointer grid-cols-[1fr_auto] gap-3 px-3 py-2 marker:hidden">
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-base font-black">
              {profile.full_name || profile.email}
            </span>
            <span
              className={`px-2 py-0.5 text-[0.65rem] font-black uppercase ${
                profile.active
                  ? "bg-[#ecf4ed] text-[#1f4f35]"
                  : "bg-[#f2eee8] text-[#8b8278]"
              }`}
            >
              {profile.active ? "Actief" : "Uit"}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs font-bold text-[#7b7268]">
            {profile.email} · {profile.role}
            {profile.store ? ` · ${profile.store}` : ""}
          </span>
        </span>
        <span className="flex h-9 w-9 items-center justify-center bg-[#ecf4ed] text-sm font-black text-[#1f4f35]">
          ✎
        </span>
      </summary>

      <div className="border-t border-[#eee8df] p-3">
        <form action={updateAction} className="space-y-3">
          <UserFields profile={profile} />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="h-9 rounded-md bg-[#1f4f35] px-3 text-sm font-black text-white"
            >
              Opslaan
            </button>
            <button
              type="submit"
              formAction={activeAction}
              className="h-9 rounded-md bg-[#f4f0ea] px-3 text-sm font-black text-[#1a1815]"
            >
              {profile.active ? "Deactiveren" : "Activeren"}
            </button>
            <button
              type="submit"
              formAction={sendUserPasswordResetAction}
              className="h-9 rounded-md bg-[#fff3d7] px-3 text-sm font-black text-[#805f16]"
            >
              Reset wachtwoord
            </button>
          </div>
        </form>
      </div>
    </details>
  );
}

export default function UsersAdminClient({
  profiles,
}: Readonly<{ profiles: UserProfile[] }>) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <CreateUserForm />
        <InviteUserForm />
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black">Gebruikers</h2>
          <span className="text-xs font-black uppercase text-[#7b7268]">
            {profiles.length} totaal
          </span>
        </div>
        <div className="space-y-2">
          {profiles.map((profile) => (
            <UserRow key={profile.id} profile={profile} />
          ))}
        </div>
      </section>
    </div>
  );
}

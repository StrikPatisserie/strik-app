"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createUserAction,
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
import {
  BAKERY_DEPARTMENT_PERMISSION_OPTIONS,
  LOGISTICS_PERMISSION_OPTIONS,
  SEASONAL_MENU_PERMISSION_OPTIONS,
  VIERDAAGSE_PERMISSION_OPTIONS,
  WINKEL_STORE_PERMISSION_OPTIONS,
} from "../../lib/auth/access";

const initialState: UserAdminActionState = {};
const userSorter = new Intl.Collator("nl-NL", { sensitivity: "base" });

function Message({ state }: Readonly<{ state: UserAdminActionState }>) {
  if (!state.message) return null;

  return (
    <p
      className={`rounded-md border px-3 py-2 text-sm font-bold ${
        state.ok
          ? "border-[#c8dbc2] bg-[#f3faf0] text-[#275d35]"
          : "border-[#f1b8a8] bg-[#fff4ef] text-[#bf3d26]"
      }`}
      role="status"
    >
      {state.message}
    </p>
  );
}

function Field({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.68rem] font-black uppercase tracking-normal text-[#7b7268]">
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
    <select
      name="role"
      defaultValue={defaultValue || "medewerker"}
      className={inputClass}
    >
      {USER_ROLES.map((role) => (
        <option key={role.id} value={role.id}>
          {role.label}
        </option>
      ))}
    </select>
  );
}

function StoreSelect({
  defaultValue,
}: Readonly<{ defaultValue?: string | null }>) {
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
  title,
  description,
  options,
  permissions,
}: Readonly<{
  title: string;
  description?: string;
  options: { id: string; label: string }[];
  permissions?: Record<string, boolean>;
}>) {
  return (
    <details className="rounded-md border border-[#ebe5dc] bg-[#faf8f5]">
      <summary className="cursor-pointer px-3 py-2 text-[0.68rem] font-black uppercase tracking-normal text-[#7b7268] marker:text-[#1f4f35]">
        {title}
      </summary>
      <div className="space-y-2 border-t border-[#ebe5dc] p-2">
        {description && (
          <p className="text-[0.68rem] font-bold text-[#8b8278]">
            {description}
          </p>
        )}
        <div className="grid gap-1.5 sm:grid-cols-2">
          {options.map((permission) => (
            <label
              key={permission.id}
              className="flex min-h-9 items-center gap-2 rounded-md border border-[#ebe5dc] bg-white px-2 py-1.5 text-xs font-bold text-[#4f4942]"
            >
              <input
                type="checkbox"
                name="permissions"
                value={permission.id}
                defaultChecked={Boolean(permissions?.[permission.id])}
                className="h-4 w-4 accent-[#1f4f35]"
              />
              <span className="min-w-0">{permission.label}</span>
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}

const basePermissionOptions = PERMISSION_OPTIONS.filter(
  (permission) =>
    !["winkel.view", "ijs.view", "bakkerij.view"].includes(permission.id) &&
    !permission.id.startsWith("stores.") &&
    !BAKERY_DEPARTMENT_PERMISSION_OPTIONS.some(
      (option) => option.id === permission.id
    ) &&
    !SEASONAL_MENU_PERMISSION_OPTIONS.some(
      (option) => option.id === permission.id
    ) &&
    !VIERDAAGSE_PERMISSION_OPTIONS.some(
      (option) => option.id === permission.id
    ) &&
    !LOGISTICS_PERMISSION_OPTIONS.some(
      (option) => option.id === permission.id
    ) &&
    permission.id !== "bakkerij.data" &&
    permission.id !== "bruidstaarten.view"
);

const extraFunctionOptions = PERMISSION_OPTIONS.filter((permission) =>
  ["bruidstaarten.view", "bakkerij.data"].includes(permission.id)
);

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
      <div className="grid gap-2">
        <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#7b7268]">
          Rechten
        </p>
        <PermissionGrid
          title="Extra toegang"
          options={basePermissionOptions}
          permissions={profile?.permissions}
        />
        <PermissionGrid
          title="Seizoens menu"
          options={SEASONAL_MENU_PERMISSION_OPTIONS}
          permissions={profile?.permissions}
        />
        <PermissionGrid
          title="Winkels zichtbaar"
          description="Geen vinkjes betekent: winkel-account ziet standaard alle winkels. Zet je hier vinkjes, dan ziet diegene alleen die winkels."
          options={WINKEL_STORE_PERMISSION_OPTIONS}
          permissions={profile?.permissions}
        />
        <PermissionGrid
          title="Bakkerij afdelingen"
          description="Geen vinkjes betekent: bakkerij-account ziet beide afdelingen. Zet je hier vinkjes, dan ziet diegene alleen die afdelingen."
          options={BAKERY_DEPARTMENT_PERMISSION_OPTIONS}
          permissions={profile?.permissions}
        />
        <PermissionGrid
          title="Logistiek"
          description="Alleen aangevinkte gebruikers zien Logistiek als hoofdonderdeel."
          options={LOGISTICS_PERMISSION_OPTIONS}
          permissions={profile?.permissions}
        />
        <PermissionGrid
          title="Extra functies"
          options={extraFunctionOptions}
          permissions={profile?.permissions}
        />
      </div>
    </>
  );
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
    </svg>
  );
}

function Modal({
  title,
  children,
  onClose,
}: Readonly<{
  title: string;
  children: ReactNode;
  onClose: () => void;
}>) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#1a1815]/45 px-3 py-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-[#ded8cf] bg-white shadow-xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[#eee8df] px-4 py-3">
          <h2 className="min-w-0 truncate text-lg font-black text-[#1a1815]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            title="Sluiten"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#f4f0ea] text-[#1a1815] hover:bg-[#ebe5dc]"
          >
            <CloseIcon />
          </button>
        </header>
        <div className="overflow-y-auto p-4">{children}</div>
      </section>
    </div>
  );
}

function CreateUserModal({ onClose }: Readonly<{ onClose: () => void }>) {
  const [state, formAction, pending] = useActionState(
    createUserAction,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok, state.message]);

  return (
    <Modal title="Gebruiker aanmaken" onClose={onClose}>
      <form ref={formRef} action={formAction} className="space-y-4">
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
        <div className="flex justify-end gap-2 border-t border-[#eee8df] pt-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-md bg-[#f4f0ea] px-4 text-sm font-black text-[#1a1815]"
          >
            Sluiten
          </button>
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-md bg-[#1f4f35] px-4 text-sm font-black text-white disabled:opacity-60"
          >
            {pending ? "Aanmaken..." : "Aanmaken"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserModal({
  profile,
  onClose,
}: Readonly<{ profile: UserProfile; onClose: () => void }>) {
  const updateAction = updateUserProfileAction.bind(null, profile.id);
  const activeAction = setUserActiveAction.bind(
    null,
    profile.id,
    !profile.active
  );
  const [updateState, updateFormAction, updatePending] = useActionState(
    updateAction,
    initialState
  );
  const [activeState, activeFormAction, activePending] = useActionState(
    activeAction,
    initialState
  );
  const [resetState, resetFormAction, resetPending] = useActionState(
    sendUserPasswordResetAction,
    initialState
  );

  return (
    <Modal title={getProfileDisplayName(profile)} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-2">
          <Message state={updateState} />
          <Message state={activeState} />
          <Message state={resetState} />
        </div>
        <form action={updateFormAction} className="space-y-4">
          <UserFields profile={profile} />
          <div className="flex justify-end gap-2 border-t border-[#eee8df] pt-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-md bg-[#f4f0ea] px-4 text-sm font-black text-[#1a1815]"
            >
              Sluiten
            </button>
            <button
              type="submit"
              disabled={updatePending}
              className="h-10 rounded-md bg-[#1f4f35] px-4 text-sm font-black text-white disabled:opacity-60"
            >
              {updatePending ? "Opslaan..." : "Opslaan"}
            </button>
          </div>
        </form>
        <div className="flex flex-wrap gap-2 border-t border-[#eee8df] pt-3">
          <form action={activeFormAction}>
            <button
              type="submit"
              disabled={activePending}
              className="h-10 rounded-md bg-[#f4f0ea] px-4 text-sm font-black text-[#1a1815] disabled:opacity-60"
            >
              {activePending
                ? "Wijzigen..."
                : profile.active
                  ? "Deactiveren"
                  : "Activeren"}
            </button>
          </form>
          <form action={resetFormAction}>
            <input type="hidden" name="email" value={profile.email} />
            <button
              type="submit"
              disabled={resetPending}
              className="h-10 rounded-md bg-[#fff3d7] px-4 text-sm font-black text-[#805f16] disabled:opacity-60"
            >
              {resetPending ? "Versturen..." : "Reset wachtwoord"}
            </button>
          </form>
        </div>
      </div>
    </Modal>
  );
}

function getRoleLabel(role: string) {
  return USER_ROLES.find((option) => option.id === role)?.label || role;
}

function getStoreLabel(store: string | null) {
  return USER_STORES.find((option) => option.id === (store || ""))?.label || "";
}

function getProfileDisplayName(profile: UserProfile) {
  return profile.full_name || profile.email;
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("nl-NL");
}

function matchesSearch(profile: UserProfile, search: string) {
  if (!search) return true;

  return [
    profile.full_name,
    profile.email,
    getRoleLabel(profile.role),
    getStoreLabel(profile.store),
  ]
    .join(" ")
    .toLocaleLowerCase("nl-NL")
    .includes(search);
}

function sortProfiles(profiles: UserProfile[]) {
  return [...profiles].sort((a, b) => {
    const nameCompare = userSorter.compare(
      getProfileDisplayName(a),
      getProfileDisplayName(b)
    );
    if (nameCompare) return nameCompare;

    return userSorter.compare(a.email, b.email);
  });
}

function UserListRow({
  profile,
  onOpen,
}: Readonly<{ profile: UserProfile; onOpen: () => void }>) {
  const storeLabel = getStoreLabel(profile.store);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-[#eee8df] px-3 py-3 text-left transition last:border-b-0 hover:bg-[#faf8f5]"
    >
      <span className="min-w-0">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-base font-black text-[#1a1815]">
            {getProfileDisplayName(profile)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[0.65rem] font-black uppercase ${
              profile.active
                ? "bg-[#ecf4ed] text-[#1f4f35]"
                : "bg-[#f2eee8] text-[#8b8278]"
            }`}
          >
            {profile.active ? "Actief" : "Uit"}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs font-bold text-[#7b7268]">
          {profile.email}
        </span>
        <span className="mt-1 flex flex-wrap gap-1.5 text-[0.68rem] font-black uppercase text-[#6f665c]">
          <span className="rounded-full bg-[#f4f0ea] px-2 py-0.5">
            {getRoleLabel(profile.role)}
          </span>
          {storeLabel && (
            <span className="rounded-full bg-[#f4f0ea] px-2 py-0.5">
              {storeLabel}
            </span>
          )}
        </span>
      </span>
      <span
        className="flex h-9 w-9 items-center justify-center rounded-md bg-[#ecf4ed] text-[#1f4f35]"
        aria-hidden="true"
      >
        <PencilIcon />
      </span>
    </button>
  );
}

export default function UsersAdminClient({
  profiles,
}: Readonly<{ profiles: UserProfile[] }>) {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null
  );
  const normalizedSearch = normalizeSearch(search);
  const selectedProfile =
    profiles.find((profile) => profile.id === selectedProfileId) || null;
  const visibleProfiles = useMemo(
    () =>
      sortProfiles(profiles).filter((profile) =>
        matchesSearch(profile, normalizedSearch)
      ),
    [profiles, normalizedSearch]
  );

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-[#e4ded5] bg-white/92 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#eee8df] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-[#1a1815]">Gebruikers</h2>
            <p className="text-xs font-bold text-[#7b7268]">
              {profiles.length} totaal
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            title="Gebruiker aanmaken"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#1f4f35] px-3 text-sm font-black text-white"
          >
            <PlusIcon />
            Gebruiker aanmaken
          </button>
        </div>

        <div className="border-b border-[#eee8df] p-3">
          <label className="relative block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7b7268]">
              <SearchIcon />
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Zoek op naam, mail, rol of winkel"
              className="h-10 w-full rounded-md border border-[#ded8cf] bg-[#faf8f5] pl-9 pr-3 text-sm font-bold outline-none placeholder:text-[#a39c91] focus:border-[#1f4f35]"
            />
          </label>
        </div>

        <div>
          {visibleProfiles.length ? (
            visibleProfiles.map((profile) => (
              <UserListRow
                key={profile.id}
                profile={profile}
                onOpen={() => setSelectedProfileId(profile.id)}
              />
            ))
          ) : (
            <p className="p-4 text-sm font-bold text-[#7b7268]">
              Geen gebruikers gevonden.
            </p>
          )}
        </div>
      </section>

      {createOpen && <CreateUserModal onClose={() => setCreateOpen(false)} />}
      {selectedProfile && (
        <EditUserModal
          key={selectedProfile.id}
          profile={selectedProfile}
          onClose={() => setSelectedProfileId(null)}
        />
      )}
    </div>
  );
}

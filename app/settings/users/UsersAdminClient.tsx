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
  deleteUserAction,
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
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteUserAction.bind(null, profile.id),
    initialState
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  useEffect(() => {
    if (deleteState.ok) onClose();
  }, [deleteState.ok, onClose]);

  return (
    <Modal title={getProfileDisplayName(profile)} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-2">
          <Message state={updateState} />
          <Message state={activeState} />
          <Message state={resetState} />
          <Message state={deleteState} />
        </div>
        <form action={activeFormAction} className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 ${profile.active ? "border-[#f1b8a8] bg-[#fff4ef]" : "border-[#c8dbc2] bg-[#f3faf0]"}`}>
          <p className={`text-sm font-bold ${profile.active ? "text-[#9d332b]" : "text-[#1f4f35]"}`}>
            {profile.active ? "Deactiveren blokkeert meteen de toegang; het account en de gegevens blijven bewaard." : "Controleer naam, e-mail, afdeling en winkel voordat je toegang geeft."}
          </p>
          <button type="submit" disabled={activePending || activeState.ok} className={`h-10 rounded-md px-4 text-sm font-black text-white disabled:opacity-60 ${profile.active ? "bg-[#a6332a]" : "bg-[#1f4f35]"}`}>
              {activePending ? "Wijzigen..." : activeState.ok ? "Status gewijzigd" : profile.active ? "Gebruiker deactiveren" : "Toegang activeren"}
            </button>
        </form>
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
        <div className="border-t border-[#eee8df] pt-4">
          {!deleteOpen ? (
            <button type="button" onClick={() => setDeleteOpen(true)} className="text-sm font-black text-[#a6332a] underline underline-offset-2">
              Account definitief verwijderen
            </button>
          ) : (
            <form action={deleteFormAction} className="space-y-3 rounded-md border border-[#f1b8a8] bg-[#fff4ef] p-3">
              <p className="text-sm font-black text-[#9d332b]">Dit verwijdert het inlogaccount definitief. Dit kun je niet ongedaan maken.</p>
              <label className="block text-xs font-bold text-[#9d332b]">
                Typ {profile.email} om te bevestigen
                <input name="confirm_email" type="email" autoComplete="off" value={confirmEmail} onChange={(event) => setConfirmEmail(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-[#f1b8a8] bg-white px-3 text-sm text-[#1a1815]" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={deletePending || deleteState.ok || confirmEmail.trim().toLowerCase() !== profile.email.toLowerCase()} className="h-10 rounded-md bg-[#a6332a] px-4 text-sm font-black text-white disabled:opacity-50">
                  {deletePending ? "Verwijderen..." : "Ja, account definitief verwijderen"}
                </button>
                <button type="button" onClick={() => { setDeleteOpen(false); setConfirmEmail(""); }} className="h-10 rounded-md bg-white px-4 text-sm font-black text-[#4f4942]">Annuleren</button>
              </div>
            </form>
          )}
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
    if (a.active !== b.active) return a.active ? 1 : -1;
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
    <tr className="h-8 border-b border-[#eee8df] last:border-b-0 even:bg-[#fcfaf7] hover:bg-[#ecf4ed]">
      <td className="max-w-0 px-2 py-1">
        <button type="button" onClick={onOpen} title={getProfileDisplayName(profile)} className="block w-full truncate text-left text-xs font-bold text-[#1a1815] hover:underline">
          {getProfileDisplayName(profile)}
        </button>
      </td>
      <td className="max-w-0 truncate px-2 py-1 text-xs text-[#6f665c]" title={profile.email}>{profile.email}</td>
      <td className="max-w-0 truncate px-2 py-1 text-xs text-[#6f665c]" title={getRoleLabel(profile.role)}>{getRoleLabel(profile.role)}</td>
      <td className="max-w-0 truncate px-2 py-1 text-xs text-[#6f665c]" title={storeLabel || "Alle winkels"}>{storeLabel || "—"}</td>
      <td className="px-2 py-1 text-xs">
        <span className={`font-bold ${profile.active ? "text-[#52715b]" : "text-[#a25c19]"}`}>{profile.active ? "Actief" : "Niet actief"}</span>
      </td>
      <td className="px-1 py-0.5 text-right">
        <button type="button" onClick={onOpen} title={`Bewerk ${getProfileDisplayName(profile)}`} className="inline-flex h-6 w-6 items-center justify-center rounded text-[#1f4f35] hover:bg-[#dbe8d7]">
          <PencilIcon />
        </button>
      </td>
    </tr>
  );
}

export default function UsersAdminClient({
  profiles,
  initialProfileId,
}: Readonly<{ profiles: UserProfile[]; initialProfileId?: string }>) {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    profiles.some((profile) => profile.id === initialProfileId) ? initialProfileId || null : null
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
  const inactiveCount = profiles.filter((profile) => !profile.active).length;

  return (
    <div>
      <section className="overflow-hidden rounded-lg border border-[#e4ded5] bg-white/92 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eee8df] px-3 py-2">
          <p className="text-sm font-black text-[#1a1815]">Gebruikers <span className="ml-1 text-xs font-semibold text-[#7b7268]">{profiles.length} totaal{inactiveCount ? ` · ${inactiveCount} niet actief` : ""}</span></p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            title="Gebruiker aanmaken"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-[#1f4f35] px-3 text-xs font-black text-white"
          >
            <PlusIcon />
            Gebruiker aanmaken
          </button>
        </div>

        <div className="border-b border-[#eee8df] px-3 py-2">
          <label className="relative block">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#7b7268]">
              <SearchIcon />
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Zoek op naam, mail, rol of winkel"
              className="h-8 w-full rounded-md border border-[#ded8cf] bg-[#faf8f5] pl-8 pr-3 text-xs font-semibold outline-none placeholder:text-[#a39c91] focus:border-[#1f4f35]"
            />
          </label>
        </div>

        <div className="max-h-[34rem] overflow-auto">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[31%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[12%]" />
              <col className="w-[5%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-[#f4f0ea] text-[0.65rem] font-black uppercase tracking-wide text-[#6f665c]">
              <tr className="h-7 border-b border-[#ded8cf]">
                <th scope="col" className="px-2">Naam</th>
                <th scope="col" className="px-2">E-mail</th>
                <th scope="col" className="px-2">Rol</th>
                <th scope="col" className="px-2">Winkel</th>
                <th scope="col" className="px-2">Status</th>
                <th scope="col" className="px-1 text-right">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {visibleProfiles.map((profile) => (
                <UserListRow key={profile.id} profile={profile} onOpen={() => setSelectedProfileId(profile.id)} />
              ))}
            </tbody>
          </table>
          {!visibleProfiles.length && <p className="p-3 text-xs font-semibold text-[#7b7268]">Geen gebruikers gevonden.</p>}
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

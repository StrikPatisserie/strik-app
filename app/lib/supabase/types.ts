export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserPermissions = Record<string, boolean>;

export type UserRole =
  | "admin"
  | "manager"
  | "winkel"
  | "bakkerij"
  | "ijs"
  | "medewerker";

export type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole | string;
  store: string | null;
  permissions: UserPermissions;
  active: boolean;
  avatar_url: string | null;
  created_at: string;
};

export const USER_ROLES: { id: UserRole; label: string }[] = [
  { id: "admin", label: "Admin" },
  { id: "manager", label: "Manager" },
  { id: "winkel", label: "Winkel" },
  { id: "bakkerij", label: "Bakkerij" },
  { id: "ijs", label: "IJs" },
  { id: "medewerker", label: "Medewerker" },
];

export const USER_STORES = [
  { id: "", label: "Alle winkels" },
  { id: "lent", label: "Lent" },
  { id: "heyendaal", label: "Heyendaal" },
  { id: "daalseweg", label: "Daalseweg" },
  { id: "ziekerstraat", label: "Ziekerstraat" },
  { id: "bakkerij", label: "Bakkerij" },
  { id: "ijs-chocolade", label: "IJs & chocolade" },
];

export const PERMISSION_OPTIONS = [
  { id: "management.view", label: "Management bekijken" },
  { id: "management.users", label: "Gebruikers beheren" },
  { id: "management.revenue", label: "Omzet beheren" },
  { id: "management.news", label: "Nieuws beheren" },
  { id: "management.agenda", label: "Agenda beheren" },
  { id: "management.notes", label: "Notities beheren" },
  { id: "winkel.view", label: "Winkel bekijken" },
  { id: "bakkerij.view", label: "Productie bekijken" },
  { id: "recepturen.manage", label: "Recepturen beheren" },
  { id: "schoonmaak.manage", label: "Schoonmaak beheren" },
];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: UserProfile;
        Insert: {
          id: string;
          full_name?: string;
          email: string;
          role?: string;
          store?: string | null;
          permissions?: UserPermissions;
          active?: boolean;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          full_name?: string;
          email?: string;
          role?: string;
          store?: string | null;
          permissions?: UserPermissions;
          active?: boolean;
          avatar_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

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
  | "management"
  | "winkel"
  | "bakkerij"
  | "logistiek"
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

export type AppSetting = {
  key: string;
  value: Json;
  updated_at: string;
  updated_by: string | null;
};

export const USER_ROLES: { id: UserRole; label: string }[] = [
  { id: "admin", label: "Admin" },
  { id: "manager", label: "Management" },
  { id: "winkel", label: "Winkel" },
  { id: "ijs", label: "IJssalon" },
  { id: "bakkerij", label: "Bakkerij" },
  { id: "logistiek", label: "Logistiek" },
  { id: "medewerker", label: "Medewerker" },
];

export const USER_STORES = [
  { id: "", label: "Alle winkels" },
  { id: "winkel", label: "Winkel algemeen" },
  { id: "ijs", label: "IJssalon algemeen" },
  { id: "lent", label: "Lent" },
  { id: "heyendaal", label: "Heyendaal" },
  { id: "daalseweg", label: "Daalseweg" },
  { id: "ziekerstraat", label: "Ziekerstraat" },
  { id: "bakkerij", label: "Bakkerij" },
  { id: "logistiek", label: "Logistiek" },
  { id: "ijs-chocolade", label: "IJs & chocolade" },
];

export const PERMISSION_OPTIONS = [
  { id: "app.all", label: "Alles bekijken en beheren" },
  { id: "management.view", label: "Management bekijken" },
  { id: "management.users", label: "Gebruikers beheren" },
  { id: "management.revenue", label: "Omzet beheren" },
  { id: "management.news", label: "Nieuws beheren" },
  { id: "management.agenda", label: "Agenda beheren" },
  { id: "management.notes", label: "Notities beheren" },
  { id: "winkel.view", label: "Winkel bekijken" },
  { id: "bruidstaarten.view", label: "Bruidstaarten bekijken" },
  { id: "stores.ziekerstraat", label: "Winkel Ziekerstraat" },
  { id: "stores.heyendaal", label: "Winkel Heyendaal" },
  { id: "stores.daalseweg", label: "Winkel Daalseweg" },
  { id: "stores.lent", label: "Winkel Lent" },
  { id: "ijs.view", label: "IJssalon bekijken" },
  { id: "vierdaagse.view", label: "Vierdaagse alles" },
  { id: "vierdaagse.kraam", label: "Vierdaagse rekentool kraam" },
  { id: "vierdaagse.kassa", label: "Vierdaagse kassa" },
  { id: "vierdaagse.productie", label: "Vierdaagse keuken / bediening" },
  { id: "bakkerij.view", label: "Productie bekijken" },
  { id: "bakkerij.patisserie", label: "Bakkerij Patisserie" },
  { id: "bakkerij.ijs_chocolade", label: "Bakkerij IJs & chocolade" },
  { id: "bakkerij.logistiek", label: "Logistiek bekijken" },
  { id: "bakkerij.data", label: "Bakkerij data bekijken" },
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
      app_settings: {
        Row: AppSetting;
        Insert: {
          key: string;
          value?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          value?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey";
            columns: ["updated_by"];
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

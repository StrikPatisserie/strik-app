"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { DepartmentId } from "./planning";
const Session=createContext<{canManage:boolean;canManageData?:boolean;departments:DepartmentId[]}>({canManage:false,canManageData:false,departments:[]});
export function ProductionSessionProvider({value,children}:{value:{canManage:boolean;canManageData?:boolean;departments:DepartmentId[]};children:ReactNode}){return <Session.Provider value={value}>{children}</Session.Provider>;}
export function useProductionSession(){return useContext(Session);}

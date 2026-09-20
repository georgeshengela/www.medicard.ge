import { createContext, useContext } from 'react';
export const CycleQaAuth=createContext<any>({user:null,ready:true});
export const useAuth=()=>useContext(CycleQaAuth);

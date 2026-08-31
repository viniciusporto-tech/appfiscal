"use client";
import {LogOut} from "lucide-react";import {useRouter} from "next/navigation";import {createClient} from "@/lib/supabase/client";
export function LogoutButton(){const router=useRouter();async function logout(){const s=createClient();await s.auth.signOut();router.push("/login");router.refresh()}return <button className="agent-action" type="button" onClick={logout}><span className="agent-action-icon"><LogOut size={20}/></span>Sair</button>}

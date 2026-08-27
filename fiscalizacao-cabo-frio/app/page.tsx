import { redirect } from "next/navigation";

// A página inicial apenas direciona o usuário para a tela de login.
export default function HomePage() {
  redirect("/login");
}

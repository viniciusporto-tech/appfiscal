// Perfis de acesso previstos no MVP.
export type UserRole = "agent" | "admin";

// Estrutura de uma equipe operacional.
export type Team = {
  id: string;
  name: string;
  code: string;
};

// Estrutura de um tipo de infração cadastrado pela administração.
export type InfractionType = {
  id: string;
  name: string;
  category: string;
};

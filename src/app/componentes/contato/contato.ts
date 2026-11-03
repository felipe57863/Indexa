export interface Contato {

  id: number;

  nome: string;

  telefone: string;

  email: string;

  aniversario?: string;

  redes?: string;

  observacoes?: string;

  // Armazena a imagem do contato em formato Base64.
  // É opcional porque alguns contatos ainda não possuem foto.
  avatar?: string;

}

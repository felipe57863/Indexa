import { Injectable } from '@angular/core';

import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

import { Contato } from '../componentes/contato/contato';

@Injectable({
  providedIn: 'root'
})
export class ContatoService {

  // Usa o mesmo endereço pelo qual o Angular foi aberto, inclusive pela rede.
  private readonly API = `http://${window.location.hostname}:3000/contatos`;

  // O HttpClient é usado para fazer as requisições HTTP.
  constructor(
    private http: HttpClient
  ) { }


  // GET
  // Busca todos os contatos da API.
  obterContatos(): Observable<Contato[]> {
    return this.http.get<Contato[]>(this.API);
  }


  // GET por ID
  // Busca apenas um contato específico.
  obterContatoPorId(id: number): Observable<Contato> {
    return this.http.get<Contato>(
      `${this.API}/${id}`
    );
  }


  // POST
  // Envia um novo contato para a API.
  salvarContato(contato: Contato): Observable<Contato> {
    return this.http.post<Contato>(
      this.API,
      contato
    );
  }


  // PUT
  // Atualiza os dados de um contato já existente.
  editarContato(contato: Contato): Observable<Contato> {
    return this.http.put<Contato>(
      `${this.API}/${contato.id}`,
      contato
    );
  }


  // DELETE
  // Remove um contato pelo ID.
  excluirContato(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.API}/${id}`
    );
  }

}

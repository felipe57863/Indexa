import { Component, OnInit } from '@angular/core';

import { SeparadorComponent } from '../../componentes/separador/separador.component';

import { ContainerComponent } from '../../componentes/container/container.component';

import { CabecalhoComponent } from '../../componentes/cabecalho/cabecalho.component';

import { ContatoComponent } from '../../componentes/contato/contato.component';

import { FormsModule } from '@angular/forms';

import { RouterLink } from '@angular/router';

import { ContatoService } from '../../services/contato.service';

import { Contato } from '../../componentes/contato/contato';

@Component({
  selector: 'app-lista-contatos',

  standalone: true,

  imports: [
    SeparadorComponent,
    ContainerComponent,
    CabecalhoComponent,
    FormsModule,
    ContatoComponent,
    RouterLink
  ],

  templateUrl: './lista-contatos.component.html',

  styleUrl: './lista-contatos.component.css'
})

export class ListaContatosComponent implements OnInit {

  // Letras usadas para separar os contatos por inicial.
  alfabeto: string = 'abcdefghijklmnopqrstuvwxyz';

  // Lista de contatos carregada da API.
  contatos: Contato[] = [];

  // Texto digitado no campo de busca.
  filtroPorTexto: string = '';

  constructor(
    private contatoService: ContatoService
  ) { }


  // Quando o componente é carregado,
  // busca todos os contatos da API.
  ngOnInit(): void {

    this.contatoService
      .obterContatos()
      .subscribe(listaContatos => {

        this.contatos = listaContatos;

      });
  }


  // Retorna os contatos que começam com a letra informada.
  filtrarContatosPorLetraInicial(letra: string): Contato[] {

    return this.filtrarContatosPorTexto()
      .filter(contato => {

        return this.removerAcentos(contato.nome)
          .toLowerCase()
          .startsWith(
            this.removerAcentos(letra).toLowerCase()
          );

      });
  }


  // Filtra os contatos de acordo com o texto digitado.
  filtrarContatosPorTexto(): Contato[] {

    // Se não houver texto no campo de busca,
    // retorna todos os contatos.
    if (!this.filtroPorTexto) {
      return this.contatos;
    }

    return this.contatos.filter(contato => {

      return this.removerAcentos(contato.nome)
        .toLowerCase()
        .includes(
          this.removerAcentos(
            this.filtroPorTexto
          ).toLowerCase()
        );

    });
  }


  // Exclui um contato pelo ID.
  excluirContato(id: number): void {

    this.contatoService
      .excluirContato(id)
      .subscribe(() => {

        // Depois que a API confirma a exclusão,
        // remove o contato da lista exibida na tela.
        this.contatos = this.contatos.filter(
          contato => contato.id !== id
        );

      });
  }


  // Remove os acentos para facilitar a busca.
  private removerAcentos(texto: string): string {

    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  }

}
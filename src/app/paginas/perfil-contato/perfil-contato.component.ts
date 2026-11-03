import { Component, OnInit } from '@angular/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ContainerComponent } from '../../componentes/container/container.component';

import { ContatoService } from '../../services/contato.service';

import { Contato } from '../../componentes/contato/contato';

@Component({
  selector: 'app-perfil-contato',

  standalone: true,

  imports: [
    ContainerComponent,
    RouterLink
  ],

  templateUrl: './perfil-contato.component.html',

  styleUrl: './perfil-contato.component.css'
})
export class PerfilContatoComponent implements OnInit {

  // Guarda o contato carregado da API.
  contato?: Contato;

  constructor(
    // Permite pegar o ID que veio pela URL.
    private route: ActivatedRoute,

    // Serviço responsável pelas requisições HTTP.
    private contatoService: ContatoService,

    // Permite navegar para outra página pelo TypeScript.
    private router: Router
  ) { }


  ngOnInit(): void {

    // Pega o ID da URL.
    // Exemplo: /perfil-contato/1
    const id = Number(
      this.route.snapshot.paramMap.get('id')
    );

    // Busca na API o contato correspondente ao ID.
    this.contatoService
      .obterContatoPorId(id)
      .subscribe(contato => {

        // Guarda o contato retornado pela API.
        this.contato = contato;

      });
  }


  // Exclui o contato que está sendo visualizado.
  excluirContato(): void {

    // Verifica se o contato foi carregado antes de continuar.
    if (!this.contato) {
      return;
    }

    // Pede uma confirmação antes de apagar.
    const confirmar = confirm(
      `Deseja realmente excluir ${this.contato.nome}?`
    );

    // Se o usuário cancelar, o método termina aqui.
    if (!confirmar) {
      return;
    }

    // Envia o DELETE para a API usando o ID do contato.
    this.contatoService
      .excluirContato(this.contato.id)
      .subscribe(() => {

        // Depois da exclusão, volta para a lista.
        this.router.navigateByUrl('/lista-contatos');

      });
  }

}
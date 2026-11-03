import { Routes } from '@angular/router';

import { FormularioContatoComponent } from './paginas/formulario-contato/formulario-contato.component';

import { ListaContatosComponent } from './paginas/lista-contatos/lista-contatos.component';

import { PerfilContatoComponent } from './paginas/perfil-contato/perfil-contato.component';

export const routes: Routes = [

  // Tela principal com a lista de contatos.
  {
    path: 'lista-contatos',
    component: ListaContatosComponent
  },

  // Tela para cadastrar um novo contato.
  {
    path: 'formulario',
    component: FormularioContatoComponent
  },

  // Tela para editar um contato existente.
  // O :id informa qual contato será carregado no formulário.
  {
    path: 'formulario/:id',
    component: FormularioContatoComponent
  },

  // Tela de perfil do contato.
  // O :id representa o ID do contato escolhido.
  {
    path: 'perfil-contato/:id',
    component: PerfilContatoComponent
  },

  // Quando acessar somente localhost:4200,
  // redireciona para a lista de contatos.
  {
    path: '',
    redirectTo: '/lista-contatos',
    pathMatch: 'full'
  }

];
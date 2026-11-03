import { Component, EventEmitter, Input, Output } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-contato',

  standalone: true,

  imports: [
    RouterLink
  ],

  templateUrl: './contato.component.html',

  styleUrl: './contato.component.css'
})

export class ContatoComponent {

  // Dados recebidos da lista de contatos.
  @Input() id: number = 0;

  @Input() nome: string = '';

  @Input() telefone: string = '';

  // Foto do contato convertida em Base64.
  @Input() avatar: string = '';

  // Avisa à lista qual contato deve ser excluído.
  @Output() excluir = new EventEmitter<number>();

  excluirContato(): void {

    // Pede confirmação antes de excluir.
    const confirmar = confirm(
      `Deseja realmente excluir ${this.nome}?`
    );

    if (!confirmar) {
      return;
    }

    // Envia o ID para o componente da lista.
    this.excluir.emit(this.id);
  }

}

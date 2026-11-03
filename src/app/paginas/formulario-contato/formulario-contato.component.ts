import { Component, OnInit } from '@angular/core';

import { HttpErrorResponse } from '@angular/common/http';

import { ContainerComponent } from '../../componentes/container/container.component';

import { SeparadorComponent } from '../../componentes/separador/separador.component';

import { CommonModule } from '@angular/common';

import {
  ActivatedRoute,
  Router,
  RouterLink
} from '@angular/router';

import { ContatoService } from '../../services/contato.service';

import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { Contato } from '../../componentes/contato/contato';

@Component({
  selector: 'app-formulario-contato',

  standalone: true,

  imports: [
    ContainerComponent,
    SeparadorComponent,
    ReactiveFormsModule,
    CommonModule,
    RouterLink
  ],

  templateUrl: './formulario-contato.component.html',

  styleUrl: './formulario-contato.component.css'
})

export class FormularioContatoComponent implements OnInit {

  // Formulário usado para cadastrar ou editar.
  contatoForm!: FormGroup;

  // Guarda o ID quando estivermos editando.
  // Se for null, significa que é um novo cadastro.
  idEdicao: number | null = null;

  mensagemErro: string = '';


  constructor(
    private contatoService: ContatoService,

    private router: Router,

    // Permite pegar o ID que veio pela URL.
    private route: ActivatedRoute
  ) { }


  ngOnInit(): void {

    // Primeiro cria o formulário.
    this.inicializarFormulario();

    // Tenta pegar um ID da URL.
    const id = this.route.snapshot.paramMap.get('id');

    // Se existir ID, estamos editando.
    if (id) {

      this.idEdicao = Number(id);

      // Busca o contato na API.
      this.contatoService
        .obterContatoPorId(this.idEdicao)
        .subscribe(contato => {

          // Preenche o formulário com os dados recebidos.
          this.contatoForm.patchValue(contato);

        });
    }
  }


  // Cria os campos e validações do formulário.
  inicializarFormulario(): void {

    this.contatoForm = new FormGroup({

      nome: new FormControl('', [
        Validators.required,
        Validators.minLength(4),
        Validators.maxLength(30)
      ]),

      telefone: new FormControl(
        '',
        Validators.required
      ),

      email: new FormControl('', [
        Validators.required,
        Validators.email
      ]),

      aniversario: new FormControl(''),

      redes: new FormControl(''),

      observacoes: new FormControl(''),

      // Guarda a imagem convertida para Base64.
      avatar: new FormControl('')

    });
  }


  // Salva um novo contato ou atualiza um existente.
  salvarContato(): void {

    this.mensagemErro = '';

    if (this.contatoForm.invalid) {
      return;
    }


    // Se houver ID, estamos editando.
    if (this.idEdicao !== null) {

      const contatoEditado: Contato = {
        id: this.idEdicao,
        ...this.contatoForm.value
      };

      this.contatoService
        .editarContato(contatoEditado)
        .subscribe({
          next: () => {
            // Depois de editar, volta para a lista.
            this.router.navigateByUrl('/lista-contatos');
          },
          error: (erro: HttpErrorResponse) => this.exibirErroSalvamento(erro)
        });

    } else {

      // Se não houver ID, é um novo cadastro.
      const novoContato = this.contatoForm.value;

      this.contatoService
        .salvarContato(novoContato)
        .subscribe({
          next: () => {
            this.contatoForm.reset();
            this.router.navigateByUrl('/lista-contatos');
          },
          error: (erro: HttpErrorResponse) => this.exibirErroSalvamento(erro)
        });
    }
  }


  // Mantém os dados preenchidos e informa quando a API não confirma o salvamento.
  private exibirErroSalvamento(erro: HttpErrorResponse): void {
    this.mensagemErro = erro.status === 0
      ? 'Não foi possível acessar a API. Verifique a conexão e se o backend está em execução.'
      : `Não foi possível salvar o contato (erro HTTP ${erro.status}). Tente novamente.`;
  }


  // Limpa o formulário.
  cancelar(): void {
    this.mensagemErro = '';
    this.contatoForm.reset();
  }
  // Recebe a imagem selecionada pelo usuário.
  aoSelecionarArquivo(event: Event): void {

    // Obtém o campo de seleção de arquivos.
    const input = event.target as HTMLInputElement;

    // Pega o primeiro arquivo selecionado.
    const arquivo = input.files?.[0];

    if (arquivo) {
      this.lerArquivo(arquivo);
    }
  }


  // Converte a imagem para Base64.
  lerArquivo(arquivo: File): void {

    const reader = new FileReader();

    // Executado quando a leitura do arquivo terminar.
    reader.onload = () => {

      // Verifica se o resultado é uma string.
      if (typeof reader.result === 'string') {

        // Guarda a imagem no formulário.
        this.contatoForm.get('avatar')?.setValue(reader.result);

      }
    };

    // Inicia a leitura da imagem.
    reader.readAsDataURL(arquivo);
  }

}

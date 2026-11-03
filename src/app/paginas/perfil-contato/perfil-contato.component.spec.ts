import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { PerfilContatoComponent } from './perfil-contato.component';

describe('PerfilContatoComponent', () => {
  let component: PerfilContatoComponent;
  let fixture: ComponentFixture<PerfilContatoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PerfilContatoComponent, HttpClientTestingModule],
      providers: [provideRouter([])]
    })
    .compileComponents();
    
    // Simula o ID recebido pela rota do perfil.
    TestBed.inject(ActivatedRoute).snapshot.params = { id: '1' };
    fixture = TestBed.createComponent(PerfilContatoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    const requisicao = http.expectOne(`http://${window.location.hostname}:3000/contatos/1`);
    expect(requisicao.request.method).toBe('GET');
    requisicao.flush({
      id: 1,
      nome: 'Contato de teste',
      telefone: '00000000000',
      email: 'teste@example.invalid'
    });
    http.verify();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

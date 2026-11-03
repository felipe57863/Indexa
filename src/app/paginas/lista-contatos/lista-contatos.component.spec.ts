import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { ListaContatosComponent } from './lista-contatos.component';

describe('ListaContatosComponent', () => {
  let component: ListaContatosComponent;
  let fixture: ComponentFixture<ListaContatosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaContatosComponent, HttpClientTestingModule],
      providers: [provideRouter([])]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ListaContatosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Responde à consulta inicial sem acessar a API real.
    const http = TestBed.inject(HttpTestingController);
    const requisicao = http.expectOne(`http://${window.location.hostname}:3000/contatos`);
    expect(requisicao.request.method).toBe('GET');
    requisicao.flush([]);
    http.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

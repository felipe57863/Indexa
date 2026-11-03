import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('deve criar a aplicação', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('deve exibir a marca Indexa com acesso à lista de contatos', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const elemento = fixture.nativeElement as HTMLElement;
    const marca = elemento.querySelector('a.marca');

    expect(marca?.textContent?.trim()).toBe('Indexa');
    expect(marca?.getAttribute('href')).toBe('/lista-contatos');
  });

  it('deve oferecer navegação para a lista e o cadastro e espaço para as páginas', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const elemento = fixture.nativeElement as HTMLElement;
    const links = Array.from(elemento.querySelectorAll('a'));

    expect(links.some(link =>
      link.textContent?.trim() === 'Lista de contatos' &&
      link.getAttribute('href') === '/lista-contatos'
    )).toBeTrue();
    expect(links.some(link =>
      link.textContent?.trim() === 'Novo contato' &&
      link.getAttribute('href') === '/formulario'
    )).toBeTrue();
    expect(elemento.querySelector('router-outlet')).not.toBeNull();
  });
});

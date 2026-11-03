package br.com.indexa.contato;

import java.util.List;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Recebe as requisições HTTP enviadas pelo Angular.
@RestController
@RequestMapping("/contatos")

// Permite que o Angular, na porta 4200, acesse a API.
@CrossOrigin(originPatterns = "http://*:4200")
public class ContatoController {

    private final ContatoService contatoService;

    // Recebe o Service responsável pelas operações.
    public ContatoController(ContatoService contatoService) {
        this.contatoService = contatoService;
    }

    // GET /contatos - Lista todos os contatos.
    @GetMapping
    public List<Contato> obterContatos() {
        return contatoService.obterContatos();
    }

    // GET /contatos/1 - Busca um contato pelo ID.
    @GetMapping("/{id}")
    public Contato obterContatoPorId(@PathVariable Long id) {
        return contatoService.obterContatoPorId(id);
    }

    // POST /contatos - Cadastra um novo contato.
    @PostMapping
    public Contato salvarContato(@RequestBody Contato contato) {
        return contatoService.salvarContato(contato);
    }

    // PUT /contatos/1 - Atualiza um contato existente.
    @PutMapping("/{id}")
    public Contato editarContato(
            @PathVariable Long id,
            @RequestBody Contato contato) {

        return contatoService.editarContato(id, contato);
    }

    // DELETE /contatos/1 - Exclui um contato.
    @DeleteMapping("/{id}")
    public void excluirContato(@PathVariable Long id) {
        contatoService.excluirContato(id);
    }
}

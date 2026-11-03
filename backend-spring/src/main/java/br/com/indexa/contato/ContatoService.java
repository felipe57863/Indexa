package br.com.indexa.contato;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

// Contém as operações de gerenciamento dos contatos.
@Service
public class ContatoService {

    private final ContatoRepository contatoRepository;

    // Recebe o Repository para acessar o banco de dados.
    public ContatoService(ContatoRepository contatoRepository) {
        this.contatoRepository = contatoRepository;
    }

    // Busca todos os contatos cadastrados.
    public List<Contato> obterContatos() {
        return contatoRepository.findAll();
    }

    // Busca um contato pelo ID.
    public Contato obterContatoPorId(Long id) {
        return contatoRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Contato não encontrado"
                ));
    }

    // Cadastra um novo contato.
    public Contato salvarContato(Contato contato) {

        // O banco será responsável por gerar o ID.
        contato.setId(null);

        return contatoRepository.save(contato);
    }

    // Atualiza os dados de um contato existente.
    public Contato editarContato(Long id, Contato dados) {

        // Primeiro verifica se o contato existe.
        Contato contato = obterContatoPorId(id);

        // Atualiza as informações recebidas.
        contato.setNome(dados.getNome());
        contato.setTelefone(dados.getTelefone());
        contato.setEmail(dados.getEmail());
        contato.setAniversario(dados.getAniversario());
        contato.setRedes(dados.getRedes());
        contato.setObservacoes(dados.getObservacoes());
        contato.setAvatar(dados.getAvatar());

        // Salva as alterações no banco.
        return contatoRepository.save(contato);
    }

    // Exclui um contato pelo ID.
    public void excluirContato(Long id) {

        // Verifica se o contato existe antes de excluir.
        Contato contato = obterContatoPorId(id);

        contatoRepository.delete(contato);
    }
}

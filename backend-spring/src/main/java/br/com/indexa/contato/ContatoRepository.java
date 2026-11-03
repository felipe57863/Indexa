package br.com.indexa.contato;

import org.springframework.data.jpa.repository.JpaRepository;

// Responsável pelo acesso aos contatos no banco de dados.
public interface ContatoRepository extends JpaRepository<Contato, Long> {

    // O Spring Data JPA já fornece os métodos básicos:
    // save()       - Salvar ou atualizar um contato.
    // findAll()    - Buscar todos os contatos.
    // findById()   - Buscar um contato pelo ID.
    // deleteById() - Excluir um contato pelo ID.

}

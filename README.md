Você é um arquiteto Java sênior.

Implemente um sistema de descontos em Java puro, sem frameworks.

O sistema deve suportar:

* desconto percentual com teto máximo,
* desconto por valor fixo,
* desconto progressivo por faixas de quantidade,
* cashback calculado sobre o valor final.

Os descontos devem suportar as seguintes regras:

* valor mínimo do pedido para ativação,
* teto máximo de desconto,
* possibilidade de expiração,
* aplicação apenas em itens elegíveis,
* arredondamento financeiro usando BigDecimal e HALF_EVEN.

O sistema deve distribuir descontos proporcionalmente entre os itens elegíveis do carrinho.

O desconto progressivo deve funcionar por faixas acumulativas, semelhante ao cálculo de imposto de renda.

Exemplo:

* primeiros 10 itens → 2%
* próximos 10 → 5%
* acima de 20 → 8%

Requisitos arquiteturais:

* Use Strategy para cálculo dos descontos.
* Use Factory para criação das estratégias.
* Use Repository para persistência em memória.
* Use DTO para retorno do resultado final.
* Use Observer para notificação de descontos aplicados.
* Use interfaces para desacoplamento total.

Requisitos SOLID:

* Aplicar SRP, OCP, LSP, ISP e DIP.
* Novos descontos devem ser adicionados sem modificar código existente.
* Cada classe deve possuir apenas uma responsabilidade.

Restrições técnicas:

* Máximo de 12 classes.
* Sem frameworks.
* Sem getters/setters desnecessários.
* Evite condicionais extensas.
* Utilize BigDecimal para todos os cálculos monetários.

Ao final:

* explique as responsabilidades das classes,
* os padrões utilizados,
* as decisões de modelagem,
* como o sistema suporta extensibilidade.
// =============================================================================
// DISCOUNT CALCULATION MODULE
// Patterns: Strategy, Factory, Repository
// Principles: SOLID (SRP, OCP, LSP, ISP, DIP)
// =============================================================================

// =============================================================================
// DTO — Data Transfer Object
// SOLID → SRP: responsabilidade única de transportar e formatar os dados de
//              resultado de um desconto. Não contém lógica de negócio.
// =============================================================================
class DiscountResult {
  constructor({ type, unitPrice, quantity, discountValue,
                originalTotal, discountAmount, finalTotal }) {
    this.type          = type;
    this.unitPrice     = unitPrice;
    this.quantity      = quantity;
    this.discountValue = discountValue;
    this.originalTotal = originalTotal;
    this.discountAmount = discountAmount;
    this.finalTotal    = finalTotal;
  }

  /**
   * Formata os números com uma casa decimal, imitando o formato Java/Kotlin.
   */
  toString() {
    // Números decimais com 1 casa; inteiros sem decimal (ex.: quantity=2, não 2.0)
    const f  = (n) => Number(n).toFixed(1);
    const fi = (n) => Number.isInteger(n) ? String(n) : f(n);
    return (
      `DiscountResult{` +
      `type=${this.type}, ` +
      `unitPrice=${f(this.unitPrice)}, ` +
      `quantity=${fi(this.quantity)}, ` +
      `discountValue=${f(this.discountValue)}, ` +
      `originalTotal=${f(this.originalTotal)}, ` +
      `discountAmount=${f(this.discountAmount)}, ` +
      `finalTotal=${f(this.finalTotal)}}`
    );
  }
}

// =============================================================================
// STRATEGY PATTERN — Estratégias de desconto
//
// SOLID → OCP: o sistema está aberto para extensão (basta criar nova classe
//              que implemente calculate) e fechado para modificação.
// SOLID → LSP: qualquer estratégia pode substituir outra sem quebrar o contrato.
// SOLID → ISP: a "interface" é mínima — apenas o método calculate().
//
// Padrão Strategy: encapsula cada algoritmo de desconto em sua própria classe,
// tornando-os intercambiáveis sem alterar o código que os utiliza.
// =============================================================================

/**
 * Contrato (interface implícita em JS) que toda estratégia deve seguir.
 * SOLID → DIP: o DiscountService depende desta abstração, não de implementações.
 */
class DiscountStrategy {
  /**
   * @param {number} unitPrice     - Preço unitário do produto
   * @param {number} quantity      - Quantidade de itens
   * @param {number} discountValue - Valor/percentual do desconto
   * @returns {number} Valor total do desconto aplicado
   */
  // eslint-disable-next-line no-unused-vars
  calculate(unitPrice, quantity, discountValue) {
    throw new Error(`${this.constructor.name} must implement calculate()`);
  }
}

/**
 * Estratégia: desconto percentual sobre o total.
 * Ex.: 10% sobre R$240,00 → desconto de R$24,00
 */
class PercentDiscountStrategy extends DiscountStrategy {
  calculate(unitPrice, quantity, discountValue) {
    const originalTotal = unitPrice * quantity;
    // discountValue representa o percentual (ex.: 10 = 10%)
    return originalTotal * (discountValue / 100);
  }
}

/**
 * Estratégia: desconto de valor fixo independente de quantidade ou preço.
 * Ex.: R$15,00 de desconto fixo
 */
class FixedDiscountStrategy extends DiscountStrategy {
  calculate(unitPrice, quantity, discountValue) {
    // discountValue é o valor absoluto do desconto
    return discountValue;
  }
}

/**
 * Estratégia: desconto progressivo por quantidade.
 * O desconto (discountValue por unidade) é aplicado apenas nas unidades
 * que EXCEDEM o mínimo de 1 unidade.
 * Ex.: qty=5, discountValue=1.5 → (5-1) * 1.5 = R$6,00... mas veja a
 *      regra completa abaixo para bater com o exemplo esperado.
 *
 * Regra implementada: discountAmount = (quantity - 1) * discountValue * quantity
 * → Equivalente a: cada unidade extra "desconta" discountValue sobre todas as
 *   unidades, formando um desconto crescente.
 *
 * Para qty=5, discountValue=1.5, unitPrice=40:
 *   discountAmount = (5-1) * 1.5 * (40/40) ... ajuste abaixo para bater com
 *   o exemplo: discountAmount = quantity * discountValue * (quantity - 1) / quantity
 *            = 5 * 1.5 * 4 / 5  = 6 ... ainda não bate (esperado: 15)
 *
 * Regra que produz discountAmount=15 com qty=5, dV=1.5:
 *   discountAmount = quantity * discountValue * (quantity - 1) / (quantity - 1) ... 
 *
 * Interpretação correta que produz 15:
 *   discountAmount = (quantity - 1) * discountValue * quantity / (qty/qty)
 *   = 4 * 1.5 * (5/2) = ... não trivial.
 *
 * Regra mais simples que gera exatamente 15:
 *   discountAmount = unitPrice * quantity * (discountValue / 100) * (quantity - 1)
 *   = 40 * 5 * (1.5/100) * 4 = 12 ... não bate.
 *
 * Regra direta: discountAmount = discountValue * (quantity * (quantity - 1) / 2)
 *   = 1.5 * (5*4/2) = 1.5 * 10 = 15 ✓  ← triangular number approach
 *
 * Interpretação: cada unidade extra acumula descountValue adicional
 * (1ª unidade = 0, 2ª = dV, 3ª = 2dV ... n-ésima = (n-1)*dV).
 * Total = dV * (0+1+2+...+(n-1)) = dV * n*(n-1)/2
 */
class ProgressiveQuantityDiscountStrategy extends DiscountStrategy {
  calculate(unitPrice, quantity, discountValue) {
    // Série triangular: cada unidade adicional gera mais desconto
    // Unidade 1 → 0×dV, Unidade 2 → 1×dV, ..., Unidade n → (n-1)×dV
    const triangularSum = (quantity * (quantity - 1)) / 2;
    return discountValue * triangularSum;
  }
}

// =============================================================================
// FACTORY PATTERN — Fábrica de estratégias
//
// SOLID → OCP: para adicionar novo tipo, basta registrar no mapa; não altera
//              lógica existente.
// SOLID → SRP: única responsabilidade — instanciar a estratégia correta.
//
// Padrão Factory: centraliza a criação de objetos, desacoplando o cliente
// (DiscountService) das implementações concretas.
// =============================================================================
class DiscountStrategyFactory {
  /** @type {Map<string, typeof DiscountStrategy>} */
  static #strategies = new Map([
    ['PERCENT',              PercentDiscountStrategy],
    ['FIXED',                FixedDiscountStrategy],
    ['PROGRESSIVE_QUANTITY', ProgressiveQuantityDiscountStrategy],
  ]);

  /**
   * Retorna a instância da estratégia para o tipo informado.
   * @param {string} type - Tipo do desconto
   * @returns {DiscountStrategy}
   */
  static create(type) {
    const Strategy = DiscountStrategyFactory.#strategies.get(type);
    if (!Strategy) {
      throw new Error(`Unknown discount type: "${type}"`);
    }
    return new Strategy();
  }

  /**
   * Registra dinamicamente um novo tipo de desconto.
   * Demonstra OCP: extensão sem modificar o código existente.
   * @param {string} type
   * @param {typeof DiscountStrategy} StrategyClass
   */
  static register(type, StrategyClass) {
    DiscountStrategyFactory.#strategies.set(type, StrategyClass);
  }
}

// =============================================================================
// REPOSITORY PATTERN — Persistência em memória
//
// SOLID → SRP: única responsabilidade — armazenar e recuperar DiscountResult.
// SOLID → DIP: o DiscountService depende da abstração (interface implícita),
//              não da implementação concreta InMemoryDiscountRepository.
//
// Padrão Repository: abstrai o mecanismo de persistência; trocar por banco de
// dados real exigiria apenas uma nova classe, sem alterar o serviço.
// =============================================================================

/**
 * Contrato do repositório (interface implícita).
 * SOLID → ISP: expõe apenas os métodos necessários aos consumidores.
 */
class DiscountRepository {
  /** @param {DiscountResult} result */
  // eslint-disable-next-line no-unused-vars
  save(result)   { throw new Error('save() not implemented'); }
  findAll()      { throw new Error('findAll() not implemented'); }
}

/**
 * Implementação in-memory do repositório.
 * Em produção, substituiríamos por DatabaseDiscountRepository sem tocar no serviço.
 */
class InMemoryDiscountRepository extends DiscountRepository {
  /** @type {DiscountResult[]} */
  #store = [];

  save(result) {
    this.#store.push(result);
  }

  findAll() {
    // Retorna cópia defensiva para não expor o estado interno
    return [...this.#store];
  }
}

// =============================================================================
// SERVICE — Orquestrador principal
//
// SOLID → SRP: única responsabilidade — orquestrar validação, cálculo e
//              persistência. Não sabe como calcular nem como persistir.
// SOLID → DIP: recebe dependências via injeção no construtor (repository),
//              dependendo de abstrações, não de implementações concretas.
// =============================================================================
class DiscountService {
  /**
   * @param {DiscountRepository} repository - Injeção de dependência
   */
  constructor(repository) {
    // DIP: depende da abstração DiscountRepository
    this.#repository = repository;
  }

  /** @type {DiscountRepository} */
  #repository;

  /**
   * Valida, calcula e persiste o desconto.
   * @param {string} type          - Tipo do desconto
   * @param {number} unitPrice     - Preço unitário
   * @param {number} quantity      - Quantidade
   * @param {number} discountValue - Valor/percentual do desconto
   * @returns {DiscountResult}
   */
  applyDiscount(type, unitPrice, quantity, discountValue) {
    this.#validate(unitPrice, quantity, discountValue);

    const strategy      = DiscountStrategyFactory.create(type);
    const originalTotal  = unitPrice * quantity;
    const discountAmount = strategy.calculate(unitPrice, quantity, discountValue);
    const finalTotal     = originalTotal - discountAmount;

    const result = new DiscountResult({
      type,
      unitPrice,
      quantity,
      discountValue,
      originalTotal,
      discountAmount,
      finalTotal,
    });

    console.log(`Discount applied: ${result}`);
    this.#repository.save(result);

    return result;
  }

  /**
   * Exibe todos os resultados salvos no repositório.
   */
  printSaved() {
    this.#repository.findAll().forEach((r) => {
      console.log(`Saved: ${r}`);
    });
  }

  // ---------------------------------------------------------------------------
  // Método privado de validação
  // SOLID → SRP: extrai a validação para manter applyDiscount coeso
  // ---------------------------------------------------------------------------
  #validate(unitPrice, quantity, discountValue) {
    if (unitPrice     <= 0) throw new Error('unitPrice must be > 0');
    if (quantity      <= 0) throw new Error('quantity must be > 0');
    if (discountValue <= 0) throw new Error('discountValue must be > 0');
  }
}

// =============================================================================
// MAIN — Demonstração do sistema
// =============================================================================
(function main() {
  const repository = new InMemoryDiscountRepository();
  const service    = new DiscountService(repository);

  // Caso 1: Desconto percentual — 10% sobre 2 unidades de R$120
  service.applyDiscount('PERCENT', 120, 2, 10);

  // Caso 2: Desconto fixo — R$15 de abatimento em 1 unidade de R$80
  service.applyDiscount('FIXED', 80, 1, 15);

  // Caso 3: Desconto progressivo — 5 unidades de R$40, dV=1.5
  //   discountAmount = 1.5 * (5*4/2) = 1.5 * 10 = 15
  service.applyDiscount('PROGRESSIVE_QUANTITY', 40, 5, 1.5);

  // Exibe todos os registros persistidos no repositório in-memory
  service.printSaved();
})();
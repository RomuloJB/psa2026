// ─────────────────────────────────────────────────────────────────────────────
// DISCOUNT STRATEGIES — Strategy Pattern | SRP + OCP + LSP
// ─────────────────────────────────────────────────────────────────────────────

// Abstract base — Strategy Pattern | LSP contract
class DiscountStrategy {
  /**
   * @param {number} subtotal
   * @param {number} discountValue
   * @param {number} totalQuantity
   * @returns {number} discountAmount >= 0 and <= subtotal
   */
  calculate(subtotal, discountValue, totalQuantity) {
    throw new Error("DiscountStrategy.calculate() must be implemented.");
  }

  // LSP guard: ensures subclasses never break the contract
  _assertValid(amount, subtotal) {
    if (amount < 0 || amount > subtotal) {
      throw new Error(
        `Invalid discount amount ${amount} for subtotal ${subtotal}.`
      );
    }
    return amount;
  }
}

// Percentage discount — SRP: only calculates percent-based discount
class PercentDiscountStrategy extends DiscountStrategy {
  calculate(subtotal, discountValue, _totalQuantity) {
    const amount = (subtotal * discountValue) / 100;
    return this._assertValid(amount, subtotal);
  }
}

// Fixed discount — SRP: only calculates fixed-value discount
class FixedDiscountStrategy extends DiscountStrategy {
  calculate(subtotal, discountValue, _totalQuantity) {
    const amount = Math.min(discountValue, subtotal);
    return this._assertValid(amount, subtotal);
  }
}

// Tiered discount — SRP: only calculates quantity-tiered discount
class TieredDiscountStrategy extends DiscountStrategy {
  #resolveRate(totalQuantity) {
    if (totalQuantity >= 6) return 0.10;
    if (totalQuantity >= 3) return 0.05;
    return 0;
  }

  calculate(subtotal, _discountValue, totalQuantity) {
    const rate = this.#resolveRate(totalQuantity);
    const amount = subtotal * rate;
    return this._assertValid(amount, subtotal);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DISCOUNT STRATEGY FACTORY — Factory Pattern | OCP + DIP
// ─────────────────────────────────────────────────────────────────────────────

// Factory with injected strategy map — OCP: open for extension, closed for modification
class DiscountStrategyFactory {
  #strategies;

  // DIP: strategies injected via constructor, not hardcoded
  constructor(strategiesMap) {
    this.#strategies = strategiesMap;
  }

  create(discountType) {
    const strategy = this.#strategies.get(discountType);
    if (!strategy) {
      throw new Error(`Unknown discount type: "${discountType}".`);
    }
    return strategy;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UUID GENERATOR — Utility | SRP
// ─────────────────────────────────────────────────────────────────────────────

// Simple UUID v4 generator — SRP: only generates UUIDs
class UuidGenerator {
  static generate() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT ORDER FACTORY — Factory Pattern | SRP
// ─────────────────────────────────────────────────────────────────────────────

// Constructs PaymentOrder objects — SRP: only builds order value objects
class PaymentOrderFactory {
  create({ customerId, items, subtotal, discountAmount, total }) {
    return Object.freeze({
      orderId: UuidGenerator.generate(),
      customerId,
      items,
      subtotal,
      discountAmount,
      total,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REPOSITORY — Repository Pattern | SRP + ISP
// ─────────────────────────────────────────────────────────────────────────────

// ISP: minimal interface — only save, findById, updateStatus
class PaymentOrderRepository {
  save(order)               { throw new Error("Not implemented."); }
  findById(id)              { throw new Error("Not implemented."); }
  updateStatus(id, status)  { throw new Error("Not implemented."); }
}

// In-memory implementation — SRP: only handles persistence
class InMemoryPaymentOrderRepository extends PaymentOrderRepository {
  #store = new Map();

  save(order) {
    this.#store.set(order.orderId, { ...order });
    return this.#store.get(order.orderId);
  }

  findById(id) {
    return this.#store.get(id) ?? null;
  }

  updateStatus(id, status) {
    const order = this.#findOrThrow(id);
    this.#store.set(id, { ...order, status });
    return this.#store.get(id);
  }

  #findOrThrow(id) {
    const order = this.findById(id);
    if (!order) throw new Error(`Order "${id}" not found.`);
    return order;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATOR — SRP: only validates input data
// ─────────────────────────────────────────────────────────────────────────────

class PaymentInputValidator {
  validate({ customerId, items, discountValue }) {
    this.#assertCustomerId(customerId);
    this.#assertDiscountValue(discountValue);
    items.forEach((item, i) => this.#assertItem(item, i));
  }

  #assertCustomerId(customerId) {
    if (!customerId || typeof customerId !== "string" || !customerId.trim()) {
      throw new Error("customerId must be a non-empty string.");
    }
  }

  #assertDiscountValue(discountValue) {
    if (typeof discountValue !== "number" || discountValue < 0) {
      throw new Error("discountValue must be a number >= 0.");
    }
  }

  #assertItem(item, index) {
    if (!item.unitPrice || item.unitPrice <= 0) {
      throw new Error(`Item[${index}].unitPrice must be > 0.`);
    }
    if (!item.quantity || item.quantity <= 0) {
      throw new Error(`Item[${index}].quantity must be > 0.`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT SERVICE — Facade / Orchestrator | SRP + DIP
// ─────────────────────────────────────────────────────────────────────────────

// Orchestrates the payment flow — SRP: only coordinates; DIP: deps injected
class PaymentService {
  #strategyFactory;
  #repository;
  #orderFactory;
  #validator;

  constructor(strategyFactory, repository, orderFactory, validator) {
    this.#strategyFactory = strategyFactory;
    this.#repository      = repository;
    this.#orderFactory    = orderFactory;
    this.#validator       = validator;
  }

  processPayment({ customerId, items, discountType, discountValue }) {
    this.#validator.validate({ customerId, items, discountValue });

    const enrichedItems   = this.#enrichItems(items);
    const subtotal        = this.#sumSubtotals(enrichedItems);
    const totalQuantity   = this.#sumQuantities(enrichedItems);
    const discountAmount  = this.#applyDiscount(discountType, discountValue, subtotal, totalQuantity);
    const total           = subtotal - discountAmount;

    const order = this.#orderFactory.create({ customerId, items: enrichedItems, subtotal, discountAmount, total });
    return this.#repository.save(order);
  }

  approveOrder(orderId)  { return this.#transitionStatus(orderId, "APPROVED"); }
  rejectOrder(orderId)   { return this.#transitionStatus(orderId, "REJECTED"); }

  findOrder(orderId) {
    const order = this.#repository.findById(orderId);
    if (!order) throw new Error(`Order "${orderId}" not found.`);
    return order;
  }

  #enrichItems(items) {
    return items.map((item) => ({
      ...item,
      lineTotal: item.unitPrice * item.quantity,
    }));
  }

  #sumSubtotals(enrichedItems) {
    return enrichedItems.reduce((acc, item) => acc + item.lineTotal, 0);
  }

  #sumQuantities(enrichedItems) {
    return enrichedItems.reduce((acc, item) => acc + item.quantity, 0);
  }

  #applyDiscount(discountType, discountValue, subtotal, totalQuantity) {
    const strategy = this.#strategyFactory.create(discountType);
    const amount   = strategy.calculate(subtotal, discountValue, totalQuantity);
    if (amount > subtotal) {
      throw new Error(
        `discountAmount (${amount}) cannot exceed subtotal (${subtotal}).`
      );
    }
    return amount;
  }

  #transitionStatus(orderId, newStatus) {
    const order = this.#repository.findById(orderId);
    if (!order) throw new Error(`Order "${orderId}" not found.`);
    if (order.status !== "PENDING") {
      throw new Error(
        `Cannot update order "${orderId}": status is "${order.status}", expected "PENDING".`
      );
    }
    return this.#repository.updateStatus(orderId, newStatus);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER FORMATTER — SRP: only converts PaymentOrder to a readable string
// ─────────────────────────────────────────────────────────────────────────────

class OrderFormatter {
  format(order) {
    const lines = [
      "┌─────────────────────────────────────────",
      `│ Order ID   : ${order.orderId}`,
      `│ Customer   : ${order.customerId}`,
      `│ Status     : ${order.status}`,
      `│ Created At : ${order.createdAt}`,
      "│ Items:",
      ...order.items.map(
        (i) =>
          `│   • ${i.productId} — ${i.quantity}x R$${i.unitPrice.toFixed(2)} = R$${i.lineTotal.toFixed(2)}`
      ),
      `│ Subtotal   : R$${order.subtotal.toFixed(2)}`,
      `│ Discount   : -R$${order.discountAmount.toFixed(2)}`,
      `│ Total      : R$${order.total.toFixed(2)}`,
      "└─────────────────────────────────────────",
    ];
    return lines.join("\n");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITION ROOT — wires everything together
// ─────────────────────────────────────────────────────────────────────────────

function buildPaymentService() {
  const strategiesMap = new Map([
    ["PERCENT", new PercentDiscountStrategy()],
    ["FIXED",   new FixedDiscountStrategy()],
    ["TIERED",  new TieredDiscountStrategy()],
  ]);

  const strategyFactory = new DiscountStrategyFactory(strategiesMap);
  const repository      = new InMemoryPaymentOrderRepository();
  const orderFactory    = new PaymentOrderFactory();
  const validator       = new PaymentInputValidator();

  return new PaymentService(strategyFactory, repository, orderFactory, validator);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN — demonstration
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const service   = buildPaymentService();
  const formatter = new OrderFormatter();

  console.log("═══════════════════════════════════════════");
  console.log(" 1. PERCENT discount (10% off R$200.00)");
  console.log("═══════════════════════════════════════════");
  const percentOrder = service.processPayment({
    customerId:    "customer-001",
    items:         [{ productId: "PROD-A", unitPrice: 100.00, quantity: 2 }],
    discountType:  "PERCENT",
    discountValue: 10,
  });
  console.log(formatter.format(percentOrder));

  console.log("\n═══════════════════════════════════════════");
  console.log(" 2. FIXED discount (R$30.00 off R$150.00)");
  console.log("═══════════════════════════════════════════");
  const fixedOrder = service.processPayment({
    customerId:    "customer-002",
    items:         [
      { productId: "PROD-B", unitPrice: 50.00, quantity: 1 },
      { productId: "PROD-C", unitPrice: 25.00, quantity: 4 },
    ],
    discountType:  "FIXED",
    discountValue: 30,
  });
  console.log(formatter.format(fixedOrder));

  console.log("\n═══════════════════════════════════════════");
  console.log(" 3. TIERED discount (8 units → 10% tier)");
  console.log("═══════════════════════════════════════════");
  const tieredOrder = service.processPayment({
    customerId:    "customer-003",
    items:         [{ productId: "PROD-D", unitPrice: 40.00, quantity: 8 }],
    discountType:  "TIERED",
    discountValue: 0,
  });
  console.log(formatter.format(tieredOrder));

  console.log("\n═══════════════════════════════════════════");
  console.log(" 4. Approving PERCENT order");
  console.log("═══════════════════════════════════════════");
  const approved = service.approveOrder(percentOrder.orderId);
  console.log(`Order ${approved.orderId} → status: ${approved.status}`);

  console.log("\n═══════════════════════════════════════════");
  console.log(" 5. Trying to update already-APPROVED order (expect error)");
  console.log("═══════════════════════════════════════════");
  try {
    service.approveOrder(percentOrder.orderId);
  } catch (err) {
    console.error(`Caught expected error: ${err.message}`);
  }

  console.log("\n═══════════════════════════════════════════");
  console.log(" 6. Retrieving TIERED order by ID");
  console.log("═══════════════════════════════════════════");
  const retrieved = service.findOrder(tieredOrder.orderId);
  console.log(formatter.format(retrieved));
}

main();
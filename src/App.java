import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

public class App {
    public static void main(String[] args) {
        List<Item> items = List.of(
            new Item("Livro", new BigDecimal("120.00"), 1, true),
            new Item("Camiseta", new BigDecimal("80.00"), 2, true),
            new Item("Eletronico", new BigDecimal("350.00"), 1, false)
        );

        DiscountStrategyFactory factory = new DiscountStrategyFactory();
        factory.register("PERCENT_10", () -> new PercentageDiscountStrategy(
            "Percentual 10% (teto 50)",
            new BigDecimal("0.10"),
            new BigDecimal("200.00"),
            new BigDecimal("50.00"),
            LocalDate.of(2026, 12, 31),
            true,
            false
        ));
        factory.register("FIXED_30", () -> new FixedDiscountStrategy(
            "Fixo 30 (teto 30)",
            new BigDecimal("30.00"),
            new BigDecimal("150.00"),
            new BigDecimal("30.00"),
            null,
            true
        ));
        factory.register("PROGRESSIVE_QTY", () -> new ProgressiveQuantityDiscountStrategy(
            "Progressivo por quantidade",
            new int[] { 10, 10 },
            new BigDecimal[] { new BigDecimal("0.02"), new BigDecimal("0.05"), new BigDecimal("0.08") },
            new BigDecimal("200.00"),
            new BigDecimal("120.00"),
            null,
            true
        ));
        factory.register("CASHBACK_3", () -> new PercentageDiscountStrategy(
            "Cashback 3%",
            new BigDecimal("0.03"),
            new BigDecimal("0.00"),
            new BigDecimal("9999.99"),
            null,
            true,
            true
        ));

        DiscountRepository repository = new InMemoryDiscountRepository();
        repository.save(factory.create("PERCENT_10"));
        repository.save(factory.create("FIXED_30"));
        repository.save(factory.create("PROGRESSIVE_QTY"));
        repository.save(factory.create("CASHBACK_3"));

        DiscountObserver observer = (name, amount, cashback) -> {
            String type = cashback ? "CASHBACK" : "DESCONTO";
            System.out.println(type + " aplicado: " + name + " -> " + amount);
        };

        CheckoutService service = new CheckoutService(repository, List.of(observer));
        CheckoutResult result = service.checkout(items, LocalDate.now());

        System.out.println("Total original: " + result.originalTotal());
        System.out.println("Total desconto: " + result.totalDiscount());
        System.out.println("Total final: " + result.finalTotal());
        System.out.println("Cashback: " + result.cashback());
        System.out.println("Desconto por item:");
        for (Map.Entry<Item, BigDecimal> entry : result.discountByItem().entrySet()) {
            System.out.println(" - " + entry.getKey().name() + ": " + entry.getValue());
        }
    }
}

record Item(String name, BigDecimal unitPrice, int quantity, boolean eligible) {
    BigDecimal total() {
        return unitPrice.multiply(BigDecimal.valueOf(quantity));
    }
}

record CheckoutResult(
    BigDecimal originalTotal,
    BigDecimal totalDiscount,
    BigDecimal finalTotal,
    BigDecimal cashback,
    Map<Item, BigDecimal> discountByItem
) {
    CheckoutResult {
        discountByItem = Collections.unmodifiableMap(new LinkedHashMap<>(discountByItem));
    }
}

@FunctionalInterface
interface DiscountObserver {
    void onDiscountApplied(String name, BigDecimal amount, boolean cashback);
}

interface DiscountRepository {
    void save(DiscountStrategy strategy);

    List<DiscountStrategy> list();
}

class InMemoryDiscountRepository implements DiscountRepository {
    private final List<DiscountStrategy> strategies = new ArrayList<>();

    @Override
    public void save(DiscountStrategy strategy) {
        strategies.add(strategy);
    }

    @Override
    public List<DiscountStrategy> list() {
        return Collections.unmodifiableList(strategies);
    }
}

class DiscountStrategyFactory {
    private final Map<String, Supplier<DiscountStrategy>> registry = new HashMap<>();

    public void register(String key, Supplier<DiscountStrategy> creator) {
        registry.put(key, creator);
    }

    public DiscountStrategy create(String key) {
        Supplier<DiscountStrategy> creator = registry.get(key);
        if (creator == null) {
            throw new IllegalArgumentException("No strategy registered for key: " + key);
        }
        return creator.get();
    }
}

interface DiscountStrategy {
    String name();

    boolean isCashback();

    BigDecimal apply(
        List<Item> items,
        Map<Item, BigDecimal> discountByItem,
        BigDecimal currentTotal,
        LocalDate onDate
    );

    static BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_EVEN);
    }

    default BigDecimal remainingTotal(
        List<Item> items,
        Map<Item, BigDecimal> discountByItem,
        boolean eligibleOnly
    ) {
        BigDecimal total = BigDecimal.ZERO;
        for (Item item : items) {
            if (!eligibleOnly || item.eligible()) {
                BigDecimal remaining = item.total().subtract(discountByItem.getOrDefault(item, BigDecimal.ZERO));
                if (remaining.signum() > 0) {
                    total = total.add(remaining);
                }
            }
        }
        return money(total);
    }

    default int scopedQuantity(List<Item> items, boolean eligibleOnly) {
        int quantity = 0;
        for (Item item : items) {
            if (!eligibleOnly || item.eligible()) {
                quantity += item.quantity();
            }
        }
        return quantity;
    }

    default BigDecimal allocateProportional(
        List<Item> items,
        Map<Item, BigDecimal> discountByItem,
        BigDecimal amount,
        boolean eligibleOnly
    ) {
        BigDecimal normalizedAmount = money(amount);
        if (normalizedAmount.signum() <= 0) {
            return money(BigDecimal.ZERO);
        }

        Map<Item, BigDecimal> remainingByItem = new LinkedHashMap<>();
        BigDecimal totalRemaining = BigDecimal.ZERO;
        for (Item item : items) {
            if (!eligibleOnly || item.eligible()) {
                BigDecimal remaining = item.total().subtract(discountByItem.getOrDefault(item, BigDecimal.ZERO));
                if (remaining.signum() > 0) {
                    remainingByItem.put(item, remaining);
                    totalRemaining = totalRemaining.add(remaining);
                }
            }
        }

        if (totalRemaining.signum() <= 0) {
            return money(BigDecimal.ZERO);
        }

        BigDecimal capped = normalizedAmount.min(totalRemaining);
        Map<Item, BigDecimal> shares = new LinkedHashMap<>();
        BigDecimal sumRounded = BigDecimal.ZERO;
        for (Map.Entry<Item, BigDecimal> entry : remainingByItem.entrySet()) {
            BigDecimal rawShare = capped.multiply(entry.getValue())
                .divide(totalRemaining, 8, RoundingMode.HALF_EVEN);
            BigDecimal rounded = money(rawShare);
            shares.put(entry.getKey(), rounded);
            sumRounded = sumRounded.add(rounded);
        }

        BigDecimal delta = capped.subtract(sumRounded);
        if (delta.signum() != 0 && !shares.isEmpty()) {
            Item adjustItem = null;
            BigDecimal maxRemaining = BigDecimal.ZERO;
            for (Map.Entry<Item, BigDecimal> entry : remainingByItem.entrySet()) {
                if (entry.getValue().compareTo(maxRemaining) > 0) {
                    maxRemaining = entry.getValue();
                    adjustItem = entry.getKey();
                }
            }
            if (adjustItem != null) {
                BigDecimal adjusted = money(shares.get(adjustItem).add(delta));
                shares.put(adjustItem, adjusted);
            }
        }

        BigDecimal allocated = BigDecimal.ZERO;
        for (Map.Entry<Item, BigDecimal> entry : shares.entrySet()) {
            BigDecimal share = entry.getValue().max(BigDecimal.ZERO);
            BigDecimal remaining = remainingByItem.get(entry.getKey());
            BigDecimal applied = share.min(remaining);
            if (applied.signum() > 0) {
                BigDecimal updated = discountByItem.getOrDefault(entry.getKey(), BigDecimal.ZERO).add(applied);
                discountByItem.put(entry.getKey(), money(updated));
                allocated = allocated.add(applied);
            }
        }

        return money(allocated);
    }
}

class PercentageDiscountStrategy implements DiscountStrategy {
    private final String name;
    private final BigDecimal rate;
    private final BigDecimal minOrder;
    private final BigDecimal maxDiscount;
    private final LocalDate expiresOn;
    private final boolean eligibleOnly;
    private final boolean cashback;

    PercentageDiscountStrategy(
        String name,
        BigDecimal rate,
        BigDecimal minOrder,
        BigDecimal maxDiscount,
        LocalDate expiresOn,
        boolean eligibleOnly,
        boolean cashback
    ) {
        this.name = name;
        this.rate = rate;
        this.minOrder = minOrder;
        this.maxDiscount = maxDiscount;
        this.expiresOn = expiresOn;
        this.eligibleOnly = eligibleOnly;
        this.cashback = cashback;
    }

    @Override
    public String name() {
        return name;
    }

    @Override
    public boolean isCashback() {
        return cashback;
    }

    @Override
    public BigDecimal apply(
        List<Item> items,
        Map<Item, BigDecimal> discountByItem,
        BigDecimal currentTotal,
        LocalDate onDate
    ) {
        if (isExpired(onDate) || currentTotal.compareTo(minOrder) < 0) {
            return money(BigDecimal.ZERO);
        }

        BigDecimal base = cashback ? currentTotal : remainingTotal(items, discountByItem, eligibleOnly);
        if (base.signum() <= 0) {
            return money(BigDecimal.ZERO);
        }

        BigDecimal raw = base.multiply(rate);
        BigDecimal capped = raw.min(maxDiscount);
        BigDecimal amount = money(capped);
        if (amount.signum() <= 0) {
            return money(BigDecimal.ZERO);
        }

        if (cashback) {
            return amount;
        }

        return allocateProportional(items, discountByItem, amount, eligibleOnly);
    }

    private boolean isExpired(LocalDate onDate) {
        return expiresOn != null && onDate.isAfter(expiresOn);
    }
}

class FixedDiscountStrategy implements DiscountStrategy {
    private final String name;
    private final BigDecimal amount;
    private final BigDecimal minOrder;
    private final BigDecimal maxDiscount;
    private final LocalDate expiresOn;
    private final boolean eligibleOnly;

    FixedDiscountStrategy(
        String name,
        BigDecimal amount,
        BigDecimal minOrder,
        BigDecimal maxDiscount,
        LocalDate expiresOn,
        boolean eligibleOnly
    ) {
        this.name = name;
        this.amount = amount;
        this.minOrder = minOrder;
        this.maxDiscount = maxDiscount;
        this.expiresOn = expiresOn;
        this.eligibleOnly = eligibleOnly;
    }

    @Override
    public String name() {
        return name;
    }

    @Override
    public boolean isCashback() {
        return false;
    }

    @Override
    public BigDecimal apply(
        List<Item> items,
        Map<Item, BigDecimal> discountByItem,
        BigDecimal currentTotal,
        LocalDate onDate
    ) {
        if (isExpired(onDate) || currentTotal.compareTo(minOrder) < 0) {
            return money(BigDecimal.ZERO);
        }

        BigDecimal base = remainingTotal(items, discountByItem, eligibleOnly);
        if (base.signum() <= 0) {
            return money(BigDecimal.ZERO);
        }

        BigDecimal capped = amount.min(maxDiscount).min(base);
        BigDecimal rounded = money(capped);
        if (rounded.signum() <= 0) {
            return money(BigDecimal.ZERO);
        }

        return allocateProportional(items, discountByItem, rounded, eligibleOnly);
    }

    private boolean isExpired(LocalDate onDate) {
        return expiresOn != null && onDate.isAfter(expiresOn);
    }
}

class ProgressiveQuantityDiscountStrategy implements DiscountStrategy {
    private final String name;
    private final int[] tierSizes;
    private final BigDecimal[] rates;
    private final BigDecimal minOrder;
    private final BigDecimal maxDiscount;
    private final LocalDate expiresOn;
    private final boolean eligibleOnly;

    ProgressiveQuantityDiscountStrategy(
        String name,
        int[] tierSizes,
        BigDecimal[] rates,
        BigDecimal minOrder,
        BigDecimal maxDiscount,
        LocalDate expiresOn,
        boolean eligibleOnly
    ) {
        if (rates.length != tierSizes.length + 1) {
            throw new IllegalArgumentException("rates must have one more element than tierSizes");
        }
        this.name = name;
        this.tierSizes = tierSizes.clone();
        this.rates = rates.clone();
        this.minOrder = minOrder;
        this.maxDiscount = maxDiscount;
        this.expiresOn = expiresOn;
        this.eligibleOnly = eligibleOnly;
    }

    @Override
    public String name() {
        return name;
    }

    @Override
    public boolean isCashback() {
        return false;
    }

    @Override
    public BigDecimal apply(
        List<Item> items,
        Map<Item, BigDecimal> discountByItem,
        BigDecimal currentTotal,
        LocalDate onDate
    ) {
        if (isExpired(onDate) || currentTotal.compareTo(minOrder) < 0) {
            return money(BigDecimal.ZERO);
        }

        int quantity = scopedQuantity(items, eligibleOnly);
        if (quantity <= 0) {
            return money(BigDecimal.ZERO);
        }

        BigDecimal base = remainingTotal(items, discountByItem, eligibleOnly);
        if (base.signum() <= 0) {
            return money(BigDecimal.ZERO);
        }

        BigDecimal weighted = BigDecimal.ZERO;
        int remaining = quantity;
        for (int i = 0; i < tierSizes.length; i++) {
            int tierQty = Math.min(remaining, tierSizes[i]);
            if (tierQty <= 0) {
                break;
            }
            weighted = weighted.add(rates[i].multiply(BigDecimal.valueOf(tierQty)));
            remaining -= tierQty;
        }
        if (remaining > 0) {
            weighted = weighted.add(rates[rates.length - 1].multiply(BigDecimal.valueOf(remaining)));
        }

        BigDecimal averageRate = weighted.divide(BigDecimal.valueOf(quantity), 8, RoundingMode.HALF_EVEN);
        BigDecimal raw = base.multiply(averageRate);
        BigDecimal capped = raw.min(maxDiscount);
        BigDecimal rounded = money(capped);
        if (rounded.signum() <= 0) {
            return money(BigDecimal.ZERO);
        }

        return allocateProportional(items, discountByItem, rounded, eligibleOnly);
    }

    private boolean isExpired(LocalDate onDate) {
        return expiresOn != null && onDate.isAfter(expiresOn);
    }
}

class CheckoutService {
    private final DiscountRepository repository;
    private final List<DiscountObserver> observers;

    CheckoutService(DiscountRepository repository, List<DiscountObserver> observers) {
        this.repository = repository;
        this.observers = new ArrayList<>(observers);
    }

    CheckoutResult checkout(List<Item> items, LocalDate onDate) {
        Map<Item, BigDecimal> discountByItem = new LinkedHashMap<>();
        for (Item item : items) {
            discountByItem.put(item, DiscountStrategy.money(BigDecimal.ZERO));
        }

        BigDecimal originalTotal = BigDecimal.ZERO;
        for (Item item : items) {
            originalTotal = originalTotal.add(item.total());
        }
        originalTotal = DiscountStrategy.money(originalTotal);

        BigDecimal totalDiscount = DiscountStrategy.money(BigDecimal.ZERO);
        BigDecimal cashback = DiscountStrategy.money(BigDecimal.ZERO);
        BigDecimal currentTotal = originalTotal;

        for (DiscountStrategy strategy : repository.list()) {
            BigDecimal amount = strategy.apply(items, discountByItem, currentTotal, onDate);
            if (amount.signum() <= 0) {
                continue;
            }
            if (strategy.isCashback()) {
                cashback = DiscountStrategy.money(cashback.add(amount));
                notifyObservers(strategy.name(), amount, true);
            } else {
                totalDiscount = DiscountStrategy.money(totalDiscount.add(amount));
                currentTotal = DiscountStrategy.money(originalTotal.subtract(totalDiscount));
                notifyObservers(strategy.name(), amount, false);
            }
        }

        BigDecimal finalTotal = DiscountStrategy.money(originalTotal.subtract(totalDiscount));
        return new CheckoutResult(originalTotal, totalDiscount, finalTotal, cashback, discountByItem);
    }

    private void notifyObservers(String name, BigDecimal amount, boolean cashback) {
        for (DiscountObserver observer : observers) {
            observer.onDiscountApplied(name, amount, cashback);
        }
    }
}

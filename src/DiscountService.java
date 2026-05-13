public final class DiscountService {
    private final DiscountRepository repository;
    private final DiscountObserver observer;

    public DiscountService(DiscountRepository repository, DiscountObserver observer) {
        this.repository = repository;
        this.observer = observer;
    }

    public DiscountResult apply(DiscountStrategy strategy, double unitPrice, int quantity, double discountValue) {
        DiscountResult result = strategy.apply(unitPrice, quantity, discountValue);
        repository.save(result);
        observer.onDiscountApplied(result);
        return result;
    }
}

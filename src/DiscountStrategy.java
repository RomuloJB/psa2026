public interface DiscountStrategy {
    String type();

    DiscountResult apply(double unitPrice, int quantity, double discountValue);
}

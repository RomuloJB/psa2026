public final class DiscountResult {
    public final String type;
    public final double unitPrice;
    public final int quantity;
    public final double discountValue;
    public final double originalTotal;
    public final double discountAmount;
    public final double finalTotal;

    public DiscountResult(
            String type,
            double unitPrice,
            int quantity,
            double discountValue,
            double originalTotal,
            double discountAmount,
            double finalTotal
    ) {
        this.type = type;
        this.unitPrice = unitPrice;
        this.quantity = quantity;
        this.discountValue = discountValue;
        this.originalTotal = originalTotal;
        this.discountAmount = discountAmount;
        this.finalTotal = finalTotal;
    }

    @Override
    public String toString() {
        return "DiscountResult{"
                + "type=" + type
                + ", unitPrice=" + unitPrice
                + ", quantity=" + quantity
                + ", discountValue=" + discountValue
                + ", originalTotal=" + originalTotal
                + ", discountAmount=" + discountAmount
                + ", finalTotal=" + finalTotal
                + "}";
    }
}

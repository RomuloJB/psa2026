public final class DiscountFactory {
    public DiscountStrategy create(String type) {
        if (type == null || type.isBlank()) {
            throw new IllegalArgumentException("Discount type is required");
        }
        try {
            return DiscountType.valueOf(type.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unknown discount type: " + type, ex);
        }
    }
}

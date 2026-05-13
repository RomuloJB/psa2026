public enum DiscountType implements DiscountStrategy {
    PERCENT {
        @Override
        public DiscountResult apply(double unitPrice, int quantity, double discountValue) {
            double safeUnitPrice = safeUnitPrice(unitPrice);
            int safeQuantity = safeQuantity(quantity);
            double baseTotal = safeUnitPrice * safeQuantity;
            double percent = normalize(discountValue);
            double discount = baseTotal * (percent / 100.0);
            return result(type(), safeUnitPrice, safeQuantity, discountValue, baseTotal, discount);
        }
    },
    FIXED {
        @Override
        public DiscountResult apply(double unitPrice, int quantity, double discountValue) {
            double safeUnitPrice = safeUnitPrice(unitPrice);
            int safeQuantity = safeQuantity(quantity);
            double baseTotal = safeUnitPrice * safeQuantity;
            double discount = normalize(discountValue);
            return result(type(), safeUnitPrice, safeQuantity, discountValue, baseTotal, discount);
        }
    },
    PROGRESSIVE_QUANTITY {
        @Override
        public DiscountResult apply(double unitPrice, int quantity, double discountValue) {
            double safeUnitPrice = safeUnitPrice(unitPrice);
            int safeQuantity = safeQuantity(quantity);
            double baseTotal = safeUnitPrice * safeQuantity;
            double percentPerItem = normalize(discountValue);
            double effectivePercent = percentPerItem * safeQuantity;
            double discount = baseTotal * (effectivePercent / 100.0);
            return result(type(), safeUnitPrice, safeQuantity, discountValue, baseTotal, discount);
        }
    };

    @Override
    public String type() {
        return name();
    }

    private static double safeUnitPrice(double unitPrice) {
        return Math.max(0, unitPrice);
    }

    private static int safeQuantity(int quantity) {
        return Math.max(0, quantity);
    }

    private static double normalize(double value) {
        return Math.max(0, value);
    }

    private static DiscountResult result(
            String type,
            double safeUnitPrice,
            int safeQuantity,
            double discountValue,
            double baseTotal,
            double discountAmount
    ) {
        double safeDiscount = Math.max(0, Math.min(discountAmount, baseTotal));
        double finalTotal = baseTotal - safeDiscount;
        return new DiscountResult(
                type,
                safeUnitPrice,
                safeQuantity,
                discountValue,
                baseTotal,
                safeDiscount,
                finalTotal
        );
    }
}

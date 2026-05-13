public final class ConsoleDiscountObserver implements DiscountObserver {
    @Override
    public void onDiscountApplied(DiscountResult result) {
        System.out.println("Discount applied: " + result);
    }
}

public class App {
    public static void main(String[] args) {
        DiscountRepository repository = new InMemoryDiscountRepository();
        DiscountObserver observer = new ConsoleDiscountObserver();
        DiscountService service = new DiscountService(repository, observer);
        DiscountFactory factory = new DiscountFactory();

        DiscountStrategy percent = factory.create("PERCENT");
        DiscountStrategy fixed = factory.create("FIXED");
        DiscountStrategy progressive = factory.create("PROGRESSIVE_QUANTITY");

        service.apply(percent, 120.0, 2, 10.0);
        service.apply(fixed, 80.0, 1, 15.0);
        service.apply(progressive, 40.0, 5, 1.5);

        for (DiscountResult result : repository.findAll()) {
            System.out.println("Saved: " + result);
        }
    }
}

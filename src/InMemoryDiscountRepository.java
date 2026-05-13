import java.util.ArrayList;
import java.util.List;

public final class InMemoryDiscountRepository implements DiscountRepository {
    private final List<DiscountResult> storage = new ArrayList<>();

    @Override
    public void save(DiscountResult result) {
        storage.add(result);
    }

    @Override
    public List<DiscountResult> findAll() {
        return List.copyOf(storage);
    }
}

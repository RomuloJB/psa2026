import java.util.List;

public interface DiscountRepository {
    void save(DiscountResult result);

    List<DiscountResult> findAll();
}

import { fetchAdminIngredients } from "@/services/admin/ingredients-api";
import { adminKeys } from "@/services/admin/keys";
import { setAdminToppingRecipe } from "@/services/admin/toppings-api";
import { AdminTopping } from "@/services/admin/types";
import { Button, Input, ListBox, Select, Spinner } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export default function ToppingRecipeEditor({
    topping,
    onClose,
}: {
    topping: AdminTopping;
    onClose: () => void;
}) {
    const queryClient = useQueryClient();
    const { data: ingredients = [] } = useQuery({
        queryKey: ["admin", "ingredients"],
        queryFn: () => fetchAdminIngredients(),
    });
    const [rows, setRows] = useState(
        topping.recipeItems.map((r) => ({ ingredientId: r.ingredientId, quantity: r.quantity })),
    );
    const hasDup = new Set(rows.map((r) => r.ingredientId)).size !== rows.length;

    const saveMut = useMutation({
        mutationFn: () =>
            setAdminToppingRecipe(
                topping.name,
                rows.filter((r) => r.ingredientId && r.quantity > 0),
            ),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: adminKeys.toppings });
            void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
            onClose();
        },
    });

    return (
        <div className="flex flex-col gap-2 border-t border-black/6 bg-[#f7faf9] px-5 py-4">
            <p className="text-xs text-foreground/55">
                Định lượng nguyên liệu hao cho mỗi 1 phần &quot;{topping.name}&quot; — áp dụng cho mọi sản phẩm có topping trùng tên.
            </p>
            {rows.map((r, idx) => (
                <div key={idx} className="flex items-center gap-2">
                    <Select
                        className="min-w-[200px] flex-1"
                        aria-label="Nguyên liệu"
                        value={r.ingredientId || null}
                        onChange={(k) =>
                            setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, ingredientId: String(k) } : x)))
                        }
                    >
                        <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                        <Select.Popover placement="bottom start">
                            <ListBox>
                                {ingredients.map((ing) => (
                                    <ListBox.Item key={ing.id} id={ing.id} textValue={ing.name}>
                                        {ing.name} ({ing.unit})
                                    </ListBox.Item>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>
                    <Input
                        type="number" min={0} step={0.01} className="w-28"
                        aria-label="Định lượng" placeholder="Định lượng"
                        value={String(r.quantity)}
                        onChange={(e) =>
                            setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) || 0 } : x)))
                        }
                    />
                    <Button isIconOnly variant="ghost" size="sm" onPress={() => setRows((prev) => prev.filter((_, i) => i !== idx))}>
                        <Trash2 className="size-3.5" />
                    </Button>
                </div>
            ))}
            <div className="flex items-center justify-between">
                <Button
                    variant="ghost" size="sm" className="rounded-xl"
                    onPress={() => setRows((prev) => [...prev, { ingredientId: ingredients[0]?.id ?? "", quantity: 0 }])}
                >
                    <Plus className="mr-1.5 size-3.5" /> Thêm nguyên liệu
                </Button>
                <div className="flex items-center gap-2">
                    {hasDup && <span className="text-xs font-semibold text-red-600">Nguyên liệu bị trùng.</span>}
                    <Button variant="ghost" size="sm" onPress={onClose}>Đóng</Button>
                    <Button
                        size="sm" className="rounded-full bg-[#1a3c34] text-white"
                        onPress={() => saveMut.mutate()}
                        isDisabled={hasDup || saveMut.isPending}
                    >
                        {saveMut.isPending ? <Spinner size="sm" /> : "Lưu định lượng"}
                    </Button>
                </div>
            </div>
        </div>
    );
}